import { requireAuthUser } from './lib/auth.mjs';
import { getSql, isDatabaseUnavailable, isMissingRelations } from './lib/db.mjs';
import { corsResponse, errorResponse, jsonResponse, readJson, sameOriginWriteGuard } from './lib/http.mjs';
import { ensureProfile } from './lib/profiles.mjs';
import {
  computeWorldPrice, worldDto, worldsUsdcMint, onchainVerificationRequired, verifyUsdcTransfer,
} from './lib/worlds.mjs';

export const config = { path: '/api/worlds/claim' };

const CLAIM_RELATIONS = ['worlds', 'world_economy_state', 'world_claims', 'wallet_payment_intents', 'wallet_accounts'];
const isMissingClaimSchema = (err) => isMissingRelations(err, CLAIM_RELATIONS);

async function loadEconomy(sql) {
  const rows = await sql`SELECT * FROM world_economy_state WHERE id = 1 LIMIT 1`;
  return rows[0] || {};
}

// Test mode: claim works for real (ownership flip, claim record, economy bump)
// but skips the wallet/payment/on-chain steps. Enable with WORLDS_TEST_BYPASS_PAYMENT=1.
function testBypassPayment() {
  try {
    if (globalThis.Netlify && Netlify.env && typeof Netlify.env.get === 'function') {
      const v = Netlify.env.get('WORLDS_TEST_BYPASS_PAYMENT');
      if (v != null && v !== '') return v === '1' || v === 'true';
    }
  } catch (_) {}
  return process.env.WORLDS_TEST_BYPASS_PAYMENT === '1' || process.env.WORLDS_TEST_BYPASS_PAYMENT === 'true';
}

async function linkedWallet(sql, profileId) {
  const rows = await sql`
    SELECT public_key FROM wallet_accounts
    WHERE profile_id = ${profileId} AND provider = 'phantom'
    ORDER BY verified_at DESC LIMIT 1
  `;
  return rows[0] ? rows[0].public_key : '';
}

export default async function worldClaimFunction(request) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return corsResponse(origin);
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405, origin);

  const auth = await requireAuthUser(request, origin);
  if (auth.response) return auth.response;
  if (!sameOriginWriteGuard(request)) return errorResponse('Forbidden', 403, origin);

  try {
    const sql = getSql();
    const profile = await ensureProfile(auth.user);
    const body = await readJson(request);
    const action = String((body && body.action) || 'quote').trim();
    const worldId = Number(body && body.worldId);
    if (!Number.isInteger(worldId) || worldId < 1) return errorResponse('Invalid world id', 400, origin);

    const economy = await loadEconomy(sql);
    const worldRows = await sql`SELECT * FROM worlds WHERE id = ${worldId} LIMIT 1`;
    if (!worldRows.length) return errorResponse('World not found', 404, origin);
    const world = worldRows[0];
    const price = computeWorldPrice(world.tile_count, economy);

    if (action === 'quote') {
      if (world.status !== 'unclaimed') return errorResponse('World is not for sale', 409, origin);
      return jsonResponse({
        worldId,
        priceUsdc: String(price),
        recipientWallet: process.env.TINYWORLD_PAYMENT_WALLET || '',
        tokenMint: worldsUsdcMint(),
      }, origin);
    }

    if (action !== 'confirm') return errorResponse('Unknown claim action', 400, origin);
    if (world.status !== 'unclaimed') return errorResponse('World is no longer for sale', 409, origin);

    // Test bypass: real ownership flip + full records, no wallet/payment required.
    if (testBypassPayment()) {
      const claimed = await sql`
        UPDATE worlds
        SET status = 'draft', owner_profile_id = ${profile.id}, price_usdc = ${price}, updated_at = NOW()
        WHERE id = ${worldId} AND status = 'unclaimed'
        RETURNING *
      `;
      if (!claimed.length) return errorResponse('World was just claimed by someone else', 409, origin);
      await sql`
        INSERT INTO world_claims (world_id, buyer_profile_id, seller_profile_id, payment_intent_id, price_usdc, signature, status)
        VALUES (${worldId}, ${profile.id}, NULL, NULL, ${price}, 'test-bypass', 'completed')
      `;
      await sql`UPDATE world_economy_state SET claimed_count = claimed_count + 1, updated_at = NOW() WHERE id = 1`;
      await sql`INSERT INTO player_resources (profile_id) VALUES (${profile.id}) ON CONFLICT (profile_id) DO NOTHING`;
      return jsonResponse({ world: worldDto(claimed[0], { includeData: true }), verified: false }, origin, 201);
    }

    const paymentIntentId = Number(body && body.paymentIntentId);
    const signature = String((body && body.signature) || '').trim().slice(0, 120);
    if (!Number.isInteger(paymentIntentId) || paymentIntentId < 1) return errorResponse('Missing payment intent', 400, origin);

    const intentRows = await sql`
      SELECT * FROM wallet_payment_intents
      WHERE id = ${paymentIntentId} AND profile_id = ${profile.id}
      LIMIT 1
    `;
    if (!intentRows.length) return errorResponse('Payment intent not found', 404, origin);
    const intent = intentRows[0];

    // The amount paid must cover the live price.
    if (Number(intent.amount) + 1e-9 < price) return errorResponse('Payment amount is below the world price', 402, origin);

    // The paying wallet must match the signed-in player's linked wallet.
    const myWallet = await linkedWallet(sql, profile.id);
    if (!myWallet) return errorResponse('Link a wallet before buying a world', 400, origin);
    if (intent.payer_wallet && intent.payer_wallet !== myWallet) {
      return errorResponse('The paying wallet must be your linked wallet', 403, origin);
    }

    // On-chain verification (real USDC). Fails closed unless explicitly disabled.
    let verified = false;
    if (onchainVerificationRequired()) {
      const check = await verifyUsdcTransfer({
        signature,
        recipient: intent.recipient_wallet,
        mint: worldsUsdcMint() || intent.token_mint || '',
        minAmount: price,
        reference: intent.reference_key,
      });
      if (!check.ok) return errorResponse('Payment not verified on chain: ' + check.reason, 402, origin);
      verified = true;
    }

    // Race-safe ownership flip: only one concurrent confirm wins the single
    // conditional UPDATE; the loser sees zero rows and a 409.
    const claimed = await sql`
      UPDATE worlds
      SET status = 'draft', owner_profile_id = ${profile.id}, price_usdc = ${price}, updated_at = NOW()
      WHERE id = ${worldId} AND status = 'unclaimed'
      RETURNING *
    `;
    if (!claimed.length) return errorResponse('World was just claimed by someone else', 409, origin);

    // Best-effort bookkeeping after the atomic win.
    await sql`
      UPDATE wallet_payment_intents
      SET status = 'paid', signature = ${signature || intent.signature}, updated_at = NOW()
      WHERE id = ${paymentIntentId} AND profile_id = ${profile.id}
    `;
    await sql`
      INSERT INTO world_claims (world_id, buyer_profile_id, seller_profile_id, payment_intent_id, price_usdc, signature, status)
      VALUES (${worldId}, ${profile.id}, NULL, ${paymentIntentId}, ${price}, ${signature || null}, ${verified ? 'completed' : 'verified'})
    `;
    await sql`
      UPDATE world_economy_state SET claimed_count = claimed_count + 1, updated_at = NOW() WHERE id = 1
    `;
    await sql`
      INSERT INTO player_resources (profile_id) VALUES (${profile.id}) ON CONFLICT (profile_id) DO NOTHING
    `;

    return jsonResponse({ world: worldDto(claimed[0], { includeData: true }), verified }, origin, 201);
  } catch (err) {
    if (isDatabaseUnavailable(err)) {
      return errorResponse('Netlify Database is not available in this local session.', 503, origin);
    }
    if (isMissingClaimSchema(err)) {
      return errorResponse('World/payment tables are missing. Run the Netlify migrations.', 503, origin);
    }
    console.error('[world-claim]', err);
    return errorResponse('Claim failed', 500, origin);
  }
}
