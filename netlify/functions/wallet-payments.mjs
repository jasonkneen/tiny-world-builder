import { randomBytes } from 'node:crypto';
import { requireAuthUser } from './lib/auth.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { ensureProfile } from './lib/profiles.mjs';
import { bytesToBase58, isSolanaPublicKey, solanaEnv, solanaPayUrl } from './lib/solana.mjs';

export const config = { path: '/api/wallet/payments' };

const AMOUNT_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/;
const WALLET_PAYMENT_SCHEMA_RELATIONS = ['wallet_accounts', 'wallet_payment_intents'];

function isMissingWalletPaymentSchema(err) {
  return isMissingRelations(err, WALLET_PAYMENT_SCHEMA_RELATIONS);
}

function paymentDto(row) {
  return {
    id: row.id,
    reference: row.reference_key,
    payerWallet: row.payer_wallet || '',
    recipientWallet: row.recipient_wallet,
    tokenMint: row.token_mint || '',
    amount: row.amount,
    label: row.label,
    message: row.message,
    memo: row.memo,
    solanaPayUrl: row.solana_pay_url,
    status: row.status,
    signature: row.signature || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cleanAmount(value) {
  const text = String(value || '').trim();
  if (!AMOUNT_RE.test(text)) return '';
  if (Number(text) <= 0) return '';
  return text;
}

async function linkedWallet(sql, profileId) {
  const rows = await sql`
    SELECT public_key
    FROM wallet_accounts
    WHERE profile_id = ${profileId} AND provider = 'phantom'
    ORDER BY verified_at DESC
    LIMIT 1
  `;
  return rows[0] ? rows[0].public_key : '';
}

export default async function walletPaymentsFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);

  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;

  try {
    const sql = getSql();
    const profile = await ensureProfile(auth.user);

    if (request.method === 'GET') {
      const rows = await sql`
        SELECT *
        FROM wallet_payment_intents
        WHERE profile_id = ${profile.id}
        ORDER BY created_at DESC
        LIMIT 50
      `;
      return jsonResponse(rows.map(paymentDto), origin);
    }

    if (request.method !== 'POST') return errorResponse('Method not allowed', 405, origin);
    if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);

    const body = await readJson(request);
    const action = String((body && body.action) || 'create').trim();

    if (action === 'confirm') {
      const id = Number(body && body.id);
      const signature = String((body && body.signature) || '').trim().slice(0, 120);
      if (!Number.isInteger(id) || id < 1 || !signature) return errorResponse('Invalid payment confirmation', 400, origin);
      const rows = await sql`
        UPDATE wallet_payment_intents
        SET signature = ${signature},
            status = 'submitted',
            updated_at = NOW()
        WHERE id = ${id} AND profile_id = ${profile.id}
        RETURNING *
      `;
      if (!rows.length) return errorResponse('Payment not found', 404, origin);
      return jsonResponse(paymentDto(rows[0]), origin);
    }

    if (action !== 'create') return errorResponse('Unknown payment action', 400, origin);

    const recipient = String(solanaEnv('TINYWORLD_PAYMENT_WALLET', '')).trim();
    if (!isSolanaPublicKey(recipient)) {
      return errorResponse('TINYWORLD_PAYMENT_WALLET is not configured', 501, origin);
    }
    const amount = cleanAmount(body && body.amount);
    if (!amount) return errorResponse('Invalid payment amount', 400, origin);
    const defaultMint = solanaEnv('TINYWORLD_TOKEN_MINT', '');
    const tokenMint = String((body && body.tokenMint) || defaultMint || '').trim();
    if (tokenMint && !isSolanaPublicKey(tokenMint)) return errorResponse('Invalid SPL token mint', 400, origin);

    const payerWallet = String((body && body.payerWallet) || await linkedWallet(sql, profile.id) || '').trim();
    if (payerWallet && !isSolanaPublicKey(payerWallet)) return errorResponse('Invalid payer wallet', 400, origin);

    const reference = bytesToBase58(randomBytes(32));
    const label = String((body && body.label) || 'Tiny World Builder').trim().slice(0, 80) || 'Tiny World Builder';
    const message = String((body && body.message) || 'TinyWorld payment').trim().slice(0, 140) || 'TinyWorld payment';
    const memo = String((body && body.memo) || ('tinyworld:' + reference.slice(0, 18))).trim().slice(0, 120);
    const url = solanaPayUrl({
      recipient,
      amount,
      splToken: tokenMint,
      reference,
      label,
      message,
      memo,
    });

    const rows = await sql`
      INSERT INTO wallet_payment_intents
        (profile_id, reference_key, payer_wallet, recipient_wallet, token_mint, amount, label, message, memo, solana_pay_url, status)
      VALUES
        (${profile.id}, ${reference}, ${payerWallet || null}, ${recipient}, ${tokenMint || null}, ${amount}, ${label}, ${message}, ${memo}, ${url}, 'pending')
      RETURNING *
    `;
    return jsonResponse(paymentDto(rows[0]), origin, 201);
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return errorResponse('Netlify Database is not available in this local session.', 503, origin);
    }
    if (isMissingWalletPaymentSchema(err)) {
      return errorResponse('Wallet payment database tables are missing. Run the Netlify database migrations for wallet/social features.', 503, origin);
    }
    console.error('[wallet-payments]', err);
    return errorResponse('Payment request failed', 500, origin);
  }
}
