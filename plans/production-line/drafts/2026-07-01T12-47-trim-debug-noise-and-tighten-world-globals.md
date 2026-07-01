# DRAFT (review before publishing) — Wed, 01 Jul 2026 12:47:50 GMT

## News draft
**Headline:** Trim debug noise and tighten world globals

Refactors several world modules to use `const`/`let` instead of `var`, reducing accidental global reassignments while preserving behavior. It also removes or gates non-essential console logging behind `window.__tinyworldDebug`, drops the temporary MMO preview HUD marker, and turns castle auto-promotion helpers into explicit no-ops to avoid unnecessary adjacency scans. `tools/check.js` was updated so static checks accept `var`, `let`, or `const` declarations for the affected constants/lights.

## Tweet draft
Trim debug noise and tighten world globals just shipped on TinyWorld. Refactors several world modules to use `const`/`let` instead of `var`, reducing accidental global reassignments while preserving behavior. It also removes or ga

_Source commit: ad6864b — Trim debug noise and tighten world globals_
