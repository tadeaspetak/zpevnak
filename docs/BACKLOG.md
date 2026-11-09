# Backlog

Agreed next changes, in the owner's words where it matters. Move an item to `DECISIONS.md` when
it ships and settles something.

## Deployment (in progress, 2026-11-09)

- [x] GCP project `zpevnak`: APIs enabled, image repository with cleanup policy (keeps 3).
- [x] Budget: 50 SEK/month (the billing account is in SEK; ≈ $5), alerts at 50/90/100% and
      forecast 100%. Budgets alert, they don't stop spending: the cap is max 2 instances.
- [ ] Region europe-west4: Cloud Run custom domains aren't available in europe-west3.
- [ ] Deploy to Cloud Run, map `zpevnak.tadeaspetak.com` (testing it at the Christmas carol gig
      in ~3 weeks; buy `zpevnak.cz` if it works out).
- [ ] Resend for email from the subdomain (needs an account + DNS records).

## UI feedback (2026-11-09)

All eight shipped the same day: see D50–D58 in `DECISIONS.md`.
