# Security notes — must-fix before economy launch

Findings surfaced by the adversarial review pipeline that are **outside the scope of the
slice that found them** but should be resolved before the economy goes live.

## CRITICAL — `profiles.email` used for authorization — ✅ FIXED & SHIPPED (PR #87, prod)
**Found during:** G1 (referrals) Codex review, 2026-06-24. **Not introduced by G1.**
**Fixed:** PR #87 (merged to prod) — `worlds.mjs` + `admin-users.mjs` now authorize on the
verified `user.email` only; regression test added; Codex review SHIP. The launch blocker
is removed. (Original finding retained below for the record.)

- `/api/profile` accepts a **client-supplied `email`** and writes it to `profiles.email`
  (`netlify/functions/profile.mjs` ~line 49).
- `/api/worlds` (and the Tinyverse access path) trust `user.email || profile.email`
  for access decisions (`netlify/functions/worlds.mjs` ~line 115, `isTinyverseAccessEmail`).

**Exploit:** a wallet-authenticated user (whose auth-provider email is empty) sets their
`profiles.email` to an allowlisted address and gains Tinyverse owner/access paths. With
the economy live, this also amplifies referral/marketplace farming (each Sybil wallet can
self-grant access).

**Fix:** never authorize on the editable `profiles.email`. Use the **verified
auth-provider email only** (or `accountMeetsCriteria` + a confirmed wallet/payment proof).
Keep `profiles.email` as display/contact data, not an authorization input.

**Interim mitigations already in place:** G1 referral payout requires a **verified
wallet** (not just an email), which blunts referral farming specifically — but the
underlying access-escalation remains and should be fixed centrally.

---

_Add new cross-cutting findings here as the review pipeline surfaces them._
