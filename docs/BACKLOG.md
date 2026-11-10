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

## Add-a-song walk: the owner's answers (2026-11-10)

The second `/ux` walk (report https://claude.ai/artifact/QWWAqmVUVUgYQB1JnmWmZ7, handover
`.ux-walk/handover-add-a-song-2026-11-10.md`). Its obvious fixes shipped as D94–D98; the owner
took the agent's pick on all five open ones; all shipped as D99–D103.

- [x] **F11** Wide screens: source and preview as tall as the window, each scrolling on its own;
      the preview follows the cursor's section.
- [x] **F13** One email to the author on a rejection (reason, note, link to fix it); none on
      approval.
- [x] **F14** No rejection reason preselected; "jiný důvod" needs a note. No new reason.
- [x] **F15** Queue rows say "v playlistu {name}" and "opraveno po zamítnutí"; the review screen
      shows the previous rejection.
- [x] **F16** Sign-up is the primary button on `/join`. The orange darkens to pass AA with white
      text (#C2410C, 5.2:1). In the owner's words: "I'm in no way attached to the colours at
      this point, let's change them while it's simple"; a theme that could become configurable.

## Bigger work

- Song history, credits and suggested changes: `.planning/ongoing/song-history-credits-suggestions.md`.
  Slice 1 (versions, recorded quietly) shipped as D86; credits and suggestions after the gig.

## State and loose ends (2026-11-09, end of the first long session)

- **First `/ux` walk done (2026-11-10)**, song view and playlist session: every finding shipped
  (D88–D92). Not walked: a cold offline start (needs a production build), the screen staying
  awake, full screen on an iPhone, a 30-song playlist. Check those on a phone against
  production before the gig.
- **Home-screen app and updates:** no reload in an installed app; the ↻ button fetches data and
  checks for a new app version (D74, D75). If that proves not enough, consider pull-to-refresh.
- **Playlist header on a phone:** an owner's four icons squeeze the title ("Vršek 2…"). If it
  bothers in real use, put the title on its own line under the icons on narrow screens.
- **Importing the old songbook:** deliberately not done (D11). Songs get added one by one, which is
  also how they get checked; `~/dev/projects/songbook` has ~430 ChordPro files to draw from.
- **Plans:** song history, credits and suggestions in `.planning/ongoing/` (slice 1 done, D86).
