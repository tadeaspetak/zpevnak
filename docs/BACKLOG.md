# Backlog

Agreed next changes, in the owner's words where it matters. Move an item to `DECISIONS.md` when
it ships and settles something.

## Deployment (done, 2026-11-09)

- [x] GCP project `zpevnak`: APIs enabled, image repository with cleanup policy (keeps 3).
- [x] Budget: 50 SEK/month (the billing account is in SEK; ≈ $5), alerts at 50/90/100% and
      forecast 100%. Budgets alert, they don't stop spending: the cap is max 2 instances.
- [x] Region europe-west4: Cloud Run custom domains aren't available in europe-west3.
- [x] Deploy to Cloud Run (`yarn deploy`), map `zpevnak.tadeaspetak.com` (testing it at the Christmas carol gig
      in ~3 weeks; buy `zpevnak.cz` if it works out).
- [x] Resend for email from the subdomain.

## UI feedback (2026-11-09)

All eight shipped the same day: see D50–D58 in `DECISIONS.md`.

## Bigger work

- Song history, credits and suggested changes: `.planning/next/song-history-credits-suggestions.md`.

## State and loose ends (2026-11-09, end of the first long session)

- **Not deployed yet:** two local commits on `main` (rejected-song resubmit fix, status banners,
  schválit wording, chords switch, diagrams off by default, modal titles, yarn verify). The live
  site runs `0c52da6`; `bf9ac87` (listmates) is pushed but not deployed. Push + `yarn deploy`
  when the owner says so.
- **The `/ux` agent hasn't run yet.** A first walk of the song view and of a playlist session on a
  phone is the natural next step before the gig.
- **Home-screen app and updates:** no reload in an installed app; the ↻ button fetches data and
  checks for a new app version (D74, D75). If that proves not enough, consider pull-to-refresh.
- **Playlist header on a phone:** an owner's four icons squeeze the title ("Vršek 2…"). If it
  bothers in real use, put the title on its own line under the icons on narrow screens.
- **Importing the old songbook:** deliberately not done (D11). Songs get added one by one, which is
  also how they get checked; `~/dev/projects/songbook` has ~430 ChordPro files to draw from.
- **Plans:** song history, credits and suggestions in `.planning/next/`.
