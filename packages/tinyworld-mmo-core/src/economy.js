export const TINYWORLD_TOKEN_SYMBOL = '$TINYWORLD';
export const GOLD_SYMBOL = 'GOLD';

export const CURRENT_WORLD_RESOURCES = Object.freeze(['fish', 'meat', 'plants', 'ore']);
export const SPEC_WORLD_RESOURCES = Object.freeze(['wood', 'ore', 'crystal', 'energy', 'fish', 'meat', 'plants']);

export const DEFAULT_GOLD_TIERS = Object.freeze([
  Object.freeze({ id: 'none', minTinyworld: 0n, allowance: 0 }),
  Object.freeze({ id: 'bronze', minTinyworld: 1_000n, allowance: 100 }),
  Object.freeze({ id: 'silver', minTinyworld: 10_000n, allowance: 500 }),
  Object.freeze({ id: 'gold', minTinyworld: 50_000n, allowance: 1500 }),
  Object.freeze({ id: 'mythic', minTinyworld: 100_000n, allowance: 2500 }),
]);

export const DEFAULT_ECONOMY_POLICY = Object.freeze({
  cycleCadence: 'weekly',
  goldModel: 'tiered',
  sqrtMultiplier: 10,
  islandBonusBps: 1000,
  islandBonusCapBps: 2500,
  maxTaxRate: 0.2,
  defaultTaxRate: 0.05,
  taxChangeCooldownMs: 24 * 60 * 60 * 1000,
  officialMarketplaceFeeBps: 500,
});

export const ECONOMY_SAFETY_RULES = Object.freeze([
  'GOLD is non-withdrawable gameplay spending power.',
  'GOLD has no fixed cash value and is not redeemable for SOL, USDC, or $TINYWORLD.',
  'The backend never trusts client-provided balances, ownership, or settlement.',
  'Wallet changes affect future or remaining allowance, not already-completed actions.',
  'Island taxes pay internal resources by default, not automatic token yield.',
  'Ownership and settlement live on chain; high-frequency gameplay lives off chain.',
]);

export function toNonNegativeBigInt(value) {
  if (typeof value === 'bigint') return value < 0n ? 0n : value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0n;
    return BigInt(Math.floor(value));
  }
  const text = String(value == null ? '' : value).trim();
  if (!text) return 0n;
  try {
    const parsed = BigInt(text.replace(/[,_\s]+/g, ''));
    return parsed < 0n ? 0n : parsed;
  } catch (_) {
    return 0n;
  }
}

// Convert an on-chain atomic token amount (smallest units) to whole $TINYWORLD,
// flooring fractional tokens. GOLD tiers are expressed in whole tokens, so this is
// the bridge between wallet_accounts.token_balance_atomic and calculateGoldAllowance.
// Uses BigInt throughout — a 100M-token balance at 9 decimals overflows Number.
export function wholeTokensHeld(atomicAmount, decimals = 0) {
  const atomic = toNonNegativeBigInt(atomicAmount);
  const dec = Math.max(0, Math.min(36, Math.floor(Number(decimals) || 0)));
  if (dec === 0) return atomic.toString();
  const divisor = 10n ** BigInt(dec);
  return (atomic / divisor).toString();
}

export function currentCycleId(now = new Date(), cadence = DEFAULT_ECONOMY_POLICY.cycleCadence) {
  const date = now instanceof Date ? now : new Date(now);
  const t = Number.isFinite(date.getTime()) ? date.getTime() : Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (cadence === 'daily') return 'daily:' + Math.floor(t / dayMs);
  if (cadence === 'seasonal') {
    const d = new Date(t);
    const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
    return 'season:' + d.getUTCFullYear() + '-q' + quarter;
  }
  return 'weekly:' + Math.floor(t / (7 * dayMs));
}

export function getTierAllowance(tinyworldHeld, tiers = DEFAULT_GOLD_TIERS) {
  const held = toNonNegativeBigInt(tinyworldHeld);
  let chosen = tiers[0];
  for (const tier of tiers) {
    if (held >= toNonNegativeBigInt(tier.minTinyworld)) chosen = tier;
  }
  return { tier: chosen.id, allowance: Math.max(0, Math.floor(Number(chosen.allowance) || 0)) };
}

export function integerSqrt(value) {
  const n = toNonNegativeBigInt(value);
  if (n < 2n) return n;
  let x0 = n / 2n;
  let x1 = (x0 + n / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + n / x0) / 2n;
  }
  return x0;
}

export function calculateGoldAllowance(input = {}, policy = DEFAULT_ECONOMY_POLICY) {
  const held = toNonNegativeBigInt(input.tinyworldHeld);
  const locked = toNonNegativeBigInt(input.lockedTinyworld);
  const balance = held + locked;
  const cycleId = String(input.cycleId || currentCycleId(input.now, policy.cycleCadence));
  let tier = 'sqrt';
  let baseAllowance = 0;

  if (policy.goldModel === 'sqrt') {
    baseAllowance = Number(integerSqrt(balance)) * Math.max(0, Number(policy.sqrtMultiplier) || 0);
  } else {
    const tiered = getTierAllowance(balance, input.tiers || DEFAULT_GOLD_TIERS);
    tier = tiered.tier;
    baseAllowance = tiered.allowance;
  }

  const islandCount = Math.max(0, Math.floor(Number(input.islandCount) || 0));
  const rankBonus = Math.max(0, Math.floor(Number(input.rankBonus) || 0));
  const questBonus = Math.max(0, Math.floor(Number(input.questBonus) || 0));
  const nftBonus = Array.isArray(input.nftBonuses)
    ? input.nftBonuses.reduce((sum, bonus) => sum + Math.max(0, Math.floor(Number(bonus.amount) || 0)), 0)
    : 0;
  const islandBonusBps = Math.max(0, Math.floor(Number(policy.islandBonusBps) || 0));
  const islandBonusCapBps = Math.max(0, Math.floor(Number(policy.islandBonusCapBps) || islandBonusBps));
  const unclampedIslandBonus = Math.floor(baseAllowance * islandBonusBps * islandCount / 10_000);
  const islandBonus = Math.min(unclampedIslandBonus, Math.floor(baseAllowance * islandBonusCapBps / 10_000));
  const totalAllowance = Math.max(0, Math.floor(baseAllowance + islandBonus + rankBonus + questBonus + nftBonus));
  const spent = Math.max(0, Math.floor(Number(input.spentThisCycle) || 0));
  const available = Math.max(0, totalAllowance - spent);

  return {
    cycleId,
    tier,
    baseAllowance,
    bonuses: [
      { source: 'island_owner', amount: islandBonus },
      { source: 'season_rank', amount: rankBonus },
      { source: 'quest_progress', amount: questBonus },
      { source: 'nft_bonus', amount: nftBonus },
    ].filter(b => b.amount > 0),
    totalAllowance,
    spent,
    available,
    tinyworldHeld: held.toString(),
    lockedTinyworld: locked.toString(),
  };
}

export function createGoldLedgerEvent(type, fields = {}, now = new Date()) {
  const eventType = String(type || '').trim().toUpperCase();
  if (!['ALLOWANCE_RECALCULATED', 'GOLD_SPENT', 'GOLD_REFUNDED'].includes(eventType)) {
    throw new Error('Unsupported GOLD ledger event type: ' + eventType);
  }
  const amount = Math.max(0, Math.floor(Number(fields.amount) || 0));
  if (amount <= 0) throw new Error('GOLD ledger event amount must be positive');
  const wallet = String(fields.wallet || '').trim();
  if (!wallet) throw new Error('GOLD ledger event wallet is required');
  const cycleId = String(fields.cycleId || currentCycleId(now)).trim();
  return {
    type: eventType,
    wallet,
    cycleId,
    amount,
    reason: String(fields.reason || fields.action || eventType).trim(),
    referenceId: fields.referenceId == null ? null : String(fields.referenceId),
    createdAt: (now instanceof Date ? now : new Date(now)).toISOString(),
  };
}

export function reduceGoldLedger(events = [], { wallet, cycleId } = {}) {
  const out = { wallet: wallet || '', cycleId: cycleId || '', allowance: 0, spent: 0, refunded: 0, available: 0 };
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    if (wallet && event.wallet !== wallet) continue;
    if (cycleId && event.cycleId !== cycleId) continue;
    if (!out.wallet) out.wallet = event.wallet || '';
    if (!out.cycleId) out.cycleId = event.cycleId || '';
    const amount = Math.max(0, Math.floor(Number(event.amount) || 0));
    if (event.type === 'ALLOWANCE_RECALCULATED') out.allowance = amount;
    else if (event.type === 'GOLD_SPENT') out.spent += amount;
    else if (event.type === 'GOLD_REFUNDED') out.refunded += amount;
  }
  out.available = Math.max(0, out.allowance - out.spent + out.refunded);
  return out;
}

export function spendGold(allowance, amount, { wallet, action, referenceId, now } = {}) {
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  const available = Math.max(0, Math.floor(Number(allowance && allowance.available) || 0));
  if (cost <= 0) return { ok: false, reason: 'invalid-amount', available };
  if (available < cost) return { ok: false, reason: 'insufficient-gold', available };
  return {
    ok: true,
    available: available - cost,
    event: createGoldLedgerEvent('GOLD_SPENT', {
      wallet: wallet || allowance.wallet,
      cycleId: allowance.cycleId,
      amount: cost,
      action,
      referenceId,
    }, now || new Date()),
  };
}

export function clampTaxRate(rate, policy = DEFAULT_ECONOMY_POLICY) {
  let n = Number(rate);
  if (!Number.isFinite(n)) n = Number(policy.defaultTaxRate);
  if (n > 1) n = n / 100;
  const max = Math.max(0, Number(policy.maxTaxRate) || 0);
  return Math.max(0, Math.min(max, n));
}

export function applyIslandTax(event = {}, island = {}, policy = DEFAULT_ECONOMY_POLICY) {
  const grossAmount = Math.max(0, Math.floor(Number(event.grossAmount) || 0));
  const minerWallet = String(event.minerWallet || event.wallet || '').trim();
  const ownerWallet = String(island.ownerWallet || '').trim();
  const sameOwner = ownerWallet && minerWallet && ownerWallet.toLowerCase() === minerWallet.toLowerCase();
  const taxRate = ownerWallet && !sameOwner ? clampTaxRate(island.taxRate, policy) : 0;
  const taxAmount = Math.floor(grossAmount * taxRate);
  const minerAmount = grossAmount - taxAmount;
  const resource = String(event.resource || '').trim().toLowerCase();
  return {
    islandId: String(event.islandId || island.id || ''),
    resource,
    taxRate,
    grossAmount,
    miner: { wallet: minerWallet, resource, amount: minerAmount },
    islandOwner: { wallet: ownerWallet, resource, amount: taxAmount },
  };
}

export function createResourceLedgerEvents(split, { referenceId, now = new Date() } = {}) {
  if (!split || typeof split !== 'object') return [];
  const createdAt = (now instanceof Date ? now : new Date(now)).toISOString();
  const events = [];
  for (const side of ['miner', 'islandOwner']) {
    const row = split[side];
    if (!row || !row.wallet || row.amount <= 0) continue;
    events.push({
      type: 'RESOURCE_CREDIT',
      wallet: row.wallet,
      resource: row.resource,
      amount: row.amount,
      reason: side === 'miner' ? 'harvest' : 'island_tax',
      islandId: split.islandId,
      referenceId: referenceId == null ? null : String(referenceId),
      createdAt,
    });
  }
  return events;
}
