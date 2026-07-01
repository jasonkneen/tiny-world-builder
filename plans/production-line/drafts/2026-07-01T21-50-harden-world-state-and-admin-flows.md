# DRAFT (review before publishing) — Wed, 01 Jul 2026 21:50:10 GMT

## News draft
**Headline:** Harden world state and admin flows

Add a basic GitHub Actions CI job and tighten several security-sensitive paths across the app and Netlify functions. This centralizes admin-secret checks, hardens local dev-server CORS and dotfile access, fixes wallet/world-claim/payment idempotency and verification edge cases, and bounds world-resource/gold ingest.

## Tweet draft
Harden world state and admin flows just shipped on TinyWorld. Add a basic GitHub Actions CI job and tighten several security-sensitive paths across the app and Netlify functions. This centralizes admin-secret checks, harde

_Source commit: ce35253 — Harden world state and admin flows_

> NOTE: this change touched protected economy paths: netlify/functions/gold-payout.mjs, netlify/functions/lib/tinyverse-access.mjs, netlify/functions/resources-sell.mjs, netlify/functions/world-remix.mjs (expected only via human-reviewed flow).