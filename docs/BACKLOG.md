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

## Playlists and sharing walk: the owner's answers (2026-11-11)

The third `/ux` walk (report https://claude.ai/artifact/KxbjNZaPvxuFJ1TURcG5iB, handover
`.ux-walk/handover-playlists-sharing-2026-11-11.md`). Its "do now" list shipped as D110. The owner
took the agent's pick on all seven; shipped as D111 (the dialog renamed "Sdílení").

- [x] **F3 The playlist name cut to "Koledy …" on phones.** A: below the phone breakpoint the
      name is the page's first line (bold, wraps), not in the header. B: two-line header title.
      C: trash into the edit panel (re-opens D54).
- [x] **F5 Sharing in two places; no view-only link in the app.** A: the dialog opens with "Kdo
      ho vidí" (the public switch moves there, and "Kopírovat odkaz na playlist" when public),
      then the invite as editing access; a public playlist's join page offers "Jen se podívat";
      `navigator.share` where it exists. B: only add the view-only link to the dialog. Sub-question:
      rename the dialog "Sdílení" (D80 named it Souputníci).
- [x] **F6 Removing a song is silent, with no undo.** A: a D87-style toast "{title} je pryč ·
      Beru zpátky" (8 s), undone through the same edits (no server change). B: confirm each.
- [x] **F8 Adding to a non-empty playlist needs edit mode.** A: keep "Přidat písničky" under the
      list in view mode for editors. B: a + in the header (no room on phones).
- [x] **Undo for a removed listmate while the dialog is open.** A: the row stays, greyed, with
      "Beru zpátky" until the dialog closes (the toast is outside the dialog's focus trap). B: as is.
- [x] **New or joined playlists on the overview** (D33). A: creating or joining counts as a
      touch in recent playlists. B: only playing does.
- [x] **"od Uršula Uživatelová" doesn't decline** (re-opens D79/D70). A: "Vlastník: {name}".
      B: the name alone with a person icon.

## Notes from the phone, the owner's (2026-11-25)

Three screenshots from the live app, agreed as one pass, shipped and deployed as D139.

- [x] Moje poznámky a tab of the account, not a button above it.
- [x] Notes on the song louder: there to be seen. No "important" flag; the setting hides them.
- [x] A note changed and deleted right in the list (deleting undone from the toast).
- [x] The song's note dialog deletes the same way. Confirms stay for songs, playlists, leaving.

## Notes on songs walk: the owner's answers (2026-11-25)

The `/ux` walk of notes (report https://claude.ai/artifact/ASTrT8fBJpEDgkYtUCMxjK, handover
`.ux-walk/handover-notes-2026-11-25.md`). Its "do now" list shipped with D135's phase 4; the
owner took the agent's pick on all four, shipped as D138.

- [x] **F5** Moje poznámky grouped by song, a TODO ticked done in one tap.
- [x] **F4** A note written offline shown at once, marked waiting.
- [x] **F6** Done TODOs off the song, kept under Hotové.
- [x] **F10** A note kept on its line through a small edit of its words.

## The sharing dialog and settings, piece by piece (2026-11-12)

The owner's feedback on the live dev server, one screenshot at a time. Shipped as D114–D116
(`cccbb09`, `ddfd4ba`, `809e3b8`): the dialog's order and wording, "parťáci" for listmates in
Czech, "kdokoliv" in Czech copy, full screen and "Načíst novinky" in the settings, pasting a new
song, the role picker, three recent songs and playlists on home.

## Code review (2026-11-10)

A senior review of the whole codebase (server, client data, pages, and every bug fixed so far
against its regression test). The obvious fixes shipped the same day (D104–D107); then, from the
owner's call, seen-at checks on song changes, shared paths and reason labels, and the invite as a
mutation. Deployed as `012a8b3`. Columns for any song (D108) followed as `895b4b3`.

Agreed to leave, for now:

- Expired `sessions` and `auth_tokens` rows are never deleted. Harmless at this size; a periodic
  cleanup later.
- The editor pages (`/new`, edit, review) repeat their header-and-column skeleton; one shared
  skeleton would save little.

## Bigger work

- Song history, credits and suggested changes: `.planning/ongoing/song-history-credits-suggestions.md`.
  Slice 1 (versions, recorded quietly) shipped as D86; credits and suggestions after the gig.

## State and loose ends (updated 2026-11-26)

- **Home screen (D141):** offered on phones and tablets (Android: the browser's dialog;
  iPhone/iPad and Firefox on Android: the steps, D142). Only emulated so far: check on a real
  iPhone, Chrome on Android, and the owner's Firefox.
- **zpevnak.cz (D140):** live since 2026-11-26 (bought at Wedos that morning, verified in
  Search Console, mapped on Cloud Run with `www`). The old address and `www` send pages on.
  Everyone signs in once more there; apps on a home screen are added again from zpevnak.cz.
- **`/ux` walks done:** the song view and playlist session (D88–D92), adding a song (D94–D103),
  playlists and sharing (D110–D111), private songs and roles (D126–D128), the song view at the
  stand after the first rehearsal (D133–D134), and notes on songs (D135, D138). All shipped
  whole. The owner's phone feedback on notes since: D139, deployed 2026-11-25. Next
  candidate: the account and sign-in pages (now with the notes tab).
- **Waiting on the owner's tablet:** "fit the text to the screen" on an upright tablet (D-1 in
  `.planning/ongoing/after-the-first-rehearsal.md`); a real iPhone long-press on a line (D135),
  only emulated so far.
- **Not walked yet:** a cold offline start (needs a production build), the screen staying awake,
  full screen on an iPhone, a 30-song playlist. Check those on a phone against production
  before the gig.
- **Home-screen app and updates:** no reload in an installed app; "Načíst novinky" fetches data
  and checks for a new app version (D74, D75), from the settings on every page (D116, D117). If that proves not enough, consider pull-to-refresh.
- **Importing the old songbook:** deliberately not done (D11). Songs get added one by one, which is
  also how they get checked; `~/dev/projects/songbook` has ~430 ChordPro files to draw from.
- **Plans:** reports and song comments through the note dialog in `.planning/ongoing/` (phase 1,
  reports, shipped as D143; next the queue's tab, then song comments); song history, credits and suggestions in `.planning/ongoing/` (slice 1 done, D86);
  after the first rehearsal (all but D-1). Done: private songs and roles, notes on songs
  (`.planning/done/`).

## Found along the way (2026-11-23)

- [ ] Review screen: the red "Zamítnout" fails AA contrast (axe via `yarn ux:probe`).
- [ ] The chord parser doesn't know Czech flat names: `As` is read as A with the suffix `s`,
      so it shows but transposes as A. Songs write `Ab` for now (CLAUDE.md); reading `As`,
      `Es`, `Ges`, `Des` would let them stay as written.
