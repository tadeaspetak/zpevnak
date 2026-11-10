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

## Add-a-song walk: waiting on the owner (2026-11-10)

The second `/ux` walk (adding, fixing and reviewing a song; report
https://claude.ai/artifact/QWWAqmVUVUgYQB1JnmWmZ7, handover `.ux-walk/handover-add-a-song-2026-11-10.md`).
Its obvious fixes shipped as D94–D98. These five are the owner's call, still to take. The
agent's pick is first.

- [ ] **F11 Long songs in the editor.** A: on wide screens the source and the preview are as tall
      as the window, each scrolls on its own, the preview follows the cursor's section. B: only a
      sticky preview. C: leave it.
- [ ] **F13 Telling the author about a rejection.** A: one email on reject (reason, note, link to
      fix it), none on approval. B: a count on the account icon. C: after the gig.
- [ ] **F14 Rejection reasons.** A: no reason preselected; a note required for "jiný důvod".
      B: also a new reason "Není ve formátu ChordPro" (an enum migration).
- [ ] **F15 Context in the review queue.** A: a dimmed line "v playlistu {name}" and "opraveno po
      zamítnutí" (from `song_versions`, D86), and the previous rejection note on the review
      screen. B: also sort songs that are in playlists first.
- [ ] **F16 Join page and orange contrast (D61).** A: sign-up is the primary button on `/join`.
      Separately: white on filled orange (#E8590C) is 3.6:1, under AA's 4.5:1; #C2410C gives
      5.2:1 but changes every primary button.

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
