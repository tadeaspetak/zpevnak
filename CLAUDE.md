# Zpěvňák

A songbook for playing together: verified ChordPro songs, playlists, and a song view made for
a phone on a music stand. Web only, nothing to install; works offline. Czech first, English too.

One developer (Tadeáš). Commit finished, gates-green work straight to `main`; no branches or PRs.

**Prioritise correctness and maintainability over minimal spec compliance.**

## Commands

```sh
yarn db:up              # local Postgres 17 in Docker, port 5434
yarn migrate            # migrations to latest (yarn migrate:rollback to undo the last batch)
yarn seed               # the verified seed songs; on a local DB also the dev personas
yarn dev                # http://localhost:3100 (server + Vite, port 3100 so deedmob's 3000 stays free)
yarn test               # every Vitest project: unit, server (real Postgres), client (jsdom)
yarn lint               # tsc, ESLint, knip, Prettier: the gates
yarn verify             # the gates, every test and e2e; exits non-zero on any failure. Before every commit
yarn build              # the client into dist/ (the server needs no build)
yarn ux:probe --url /song/1 [--email user@zpevnak.test]   # measure one page state, see /ux
node src/server/cli/set-role.ts <email> admin          # make the first admin
```

Dev personas, all on the password `zpevnak-dev-password` (`src/server/db/devPersonas.ts`):
`admin@`, `editor@`, `user@`, `new@` (unverified) `zpevnak.test`. In development, emails are
printed to the server log.

## Planning

- **`docs/DECISIONS.md`**: what has been settled and why (D-numbers). Binding; cite them.
- **`.planning/{next,ongoing,later,done}/`**: plans by state; `done/` is the read-only archive.
  How a plan is written, kept up as it ships and archived: `.planning/README.md`. Follow it.
- **`docs/BACKLOG.md`**: small agreed changes not big enough for a plan.

## How it is built

- **Node 24 runs the TypeScript directly** (type stripping): no build step for the server, and
  imports carry their `.ts` extension. So only erasable syntax: no `enum`, no parameter
  properties, no namespaces (`erasableSyntaxOnly` enforces it).
- **Import aliases** are package.json `imports`: `#shared/…`, `#server/…`, `#client/…`,
  `#tests/…`. The client imports server **types** only (`import type`), never server code.
- **Server:** Express 5 + tRPC 11 + zod 4, knex on Postgres. One procedure per file:
  `src/server/routers/{domain}/{domain}.{procedure}.ts`, specs in `__tests__/` beside them.
- **Client:** React 19, Vite, React Router, tRPC + React Query, Mantine for everything around
  the song. The song sheet itself (`src/client/song/`) is plain CSS: it has to be fast and quiet.
  The providers (theme, translations, queries, toasts, the error boundary) are in
  `src/client/Providers.tsx`; tests render inside the same ones.
- **Rules both sides need live in `src/shared/` and nowhere else:** who may change a song
  (`songs.ts`: `canChangeSong`, `canDeleteSong`, `isEditor`), who someone is to a shared
  playlist or private song (`roles.ts`: `MemberRole`, `editsAsMember`), every path (`urls.ts`, emails included), the
  rejection reasons' wording (`rejectionReasons.ts`), validators and limits
  (`validators/index.ts`), the ChordPro parser, tags (`chordpro/tags.ts`: one tag is every
  spelling with one `tagKey`; `setTags` edits the `{tag}` lines), transposing a song's text
  (`transposeSource`, the same mapping as the view), playlist edits (`playlistOps.ts`:
  `applyOp`, `toggleOp`), where a note on a song sits (`notes.ts`: `notePlaces`, `placeOf`,
  found again after an edit by its line's words). Never re-derive one of these in a page or a
  procedure.
- **Offline first.** The whole catalog (songs, playlists and notes the viewer can see) lives in
  IndexedDB (`src/client/data/`) and is searched on the device with MiniSearch. `songs.sync`
  sends what changed since a cursor; `playlists.all` and `notes.visible` send everything (they
  are small). Reads go through `useCatalog()`, not tRPC queries. After a mutation, put the
  returned record into the catalog (`putSong`, `putPlaylist`, `putNote`). A change of viewer
  (sign-in, sign-out) clears the device copy before fetching (`syncCatalog`). Offline, requests
  that write wait for the connection and say so (`notifyIfQueued`, D133); a note's change also
  shows at once, marked waiting, in memory only (`waitNote`, D138). A new IndexedDB version
  must not hang on a tab still open on the old one (`blocked`/`blocking` in `store.ts`).
- **The ChordPro text is the only truth about a song.** Title and artist are read from its
  header on every save (`src/server/songs/header.ts`); never edit them separately.
- **Changing a song** (save, approve, reject, delete) locks its row and decides on it inside the
  transaction (D104). Save, approve and reject also carry `seenAt`, the song's `updatedAt` as the
  page loaded it; the server refuses with `SONG_CHANGED` if it moved on (D106).
- **Requests that write are mutations,** never GETs. Email the request doesn't depend on goes out
  with `sendEmailInBackground` (a failure is logged; the request stands).
- **Production:** Cloud Run (GCP project `zpevnak`, europe-west4) and Neon Postgres. Local
  development and tests never touch Neon: the app does not load `.env.local`.

## Process

- **Reuse before writing.** Search for an existing helper, component or pattern first. No
  parallel implementations that can drift.
- **No silent data degradation.** Never substitute missing data with `null` or a placeholder.
  Fix the source, derive the value, or stop and ask.
- **When a spec is ambiguous, ask** before implementing. Don't invent behaviour.
- **Before calling work done:** `yarn lint` and `yarn test` green, then read your own `git diff`
  for dead code, debug logs, TODOs and naming. Fix what you find before presenting the work.
- **Look at UI changes.** Run `yarn ux:probe` on every state you changed and look at the
  screenshots at 390 px and 1280 px. A green build says nothing about how a page looks.

## Tests

Every change to behaviour ships with its tests in the same commit.

- **Prove logic where it lives.** Parser, transposition, layout and search are pure functions
  with unit specs. API behaviour is tested through the tRPC caller against a real Postgres
  (`tests/server/helpers.ts`: `useCleanDatabase`, `createUser`, `callerFor`, `withCookies`,
  `seenAt`). Components render with `renderApp` (`tests/client/render.tsx`: the app's own
  providers and a router, and the location state a link carries). The device's database is
  tested on `fake-indexeddb`. Every test run migrates down and up again (`global-setup.ts`).
  End-to-end (`tests/e2e/`) is for the main paths through the app, not for permutations.
- **Every bug caught gets a test** that fails without its fix, in the same commit. Only CSS that
  a test can't reasonably see (an indent, a tap target) is left to `yarn ux:probe`.
- **Every guard ships a false-reject test.** A permission check, validator or rate limit gets a
  test proving the legitimate request still succeeds, built the way the real client builds it.
  The negative case is the one you are thinking about; the happy path is the one that breaks.
- **Real songs, made-up words.** Fixtures in specs use invented lyrics ("la la [D]la"). Real
  song text only lives in `seeds/songs/`, copied by file, never typed out.

## Code style

- **SQL:** raw SQL tagged `/* sql */`, named bindings (`:id`), not the query builder. Migrations
  are one `knex.raw` per direction, import nothing but the knex type, and write every value
  as a literal (a migration is a snapshot; an imported constant can change under it).
- **Allow-lists at the boundary.** Every API response is built field by field
  (`toSongRecord`, `toPlaylistRecord`, `toMe`). Never spread a database row into a response.
- **Errors are codes.** The server throws `fail(code, 'ERROR_CODE')` with a code from
  `src/shared/errors.ts`; the client translates it (`tError`). The server never sends prose.
- **Hide existence.** A private playlist or a private song answers NOT_FOUND to someone who
  may not see it, not FORBIDDEN; a private song does so to the songbook's editors too. Song
  reads go through `loadSongRow` / `SONG_READABLE` (`src/server/songs/`), never a bare SELECT;
  notes through `loadNote` / `loadVisibleNotes` (`src/server/notes/`), which keep a private
  song's notes to those who may read it, and a report (D143) to its reporter, the editors and
  the song's author.
- **Sharing is one router** (`sharing`, with a `kind`: playlist or song): invites, joining,
  people, roles. Each kind's tables are in `SHARED_TABLES` (`src/server/sharing/`).
- **URLs come from `src/shared/urls.ts`** (`url.song(…)`, `routes`), on the client and in the
  server's emails alike. Never build a path by hand.
- **Translations ship with the code, both languages, every time.** `cs.ts` is the source; `en.ts`
  is typed against it, so a missing key fails `tsc`. Czech: mind the grammar a placeholder lands
  in (prepositions and cases change with the noun; prefer neutral phrasings like `Zpět: {name}`).
- **Braces on every `if`/`else`/loop**, on their own lines (ESLint `curly`).
- **Comments say why, not what.**
- **Musical notation:** the song's text keeps H/B as it writes them. Czech songs use german
  notation (H = B natural, B = B♭); transposition keeps the song's system
  (`src/shared/chordpro/chord.ts`). The reader sees chords in their own notation (D132,
  `chordIn`, `useNotation`): H in Czech, B in English, by the app's language (D134). A
  song is read as german only if it uses H somewhere; one with B♭ written `B` and no H needs
  `{+notes.system: german}`, or its B is taken for B natural. Flats are `Ab`, `Eb`: the parser
  doesn't know the Czech names `As`, `Es`.

## Writing songs

How a song's ChordPro is laid out, so songs read alike (the first pass: 2026-11-23).

- Header: `{title}`, `{artist}` (a real artist only, or none), `{key}` (always: the tonic, `Am`
  for a minor song), then `{tag}` lines. A category ("Koledy", "Pohádky") is a tag, never an
  artist (D120).
- Every verse and chorus is a section (`{start_of_verse}`, `{start_of_chorus}`, `bridge`),
  without English labels or numbers ("Verse 1", "1.", "Ref:"). A chorus sung again unchanged is
  `{chorus}`: the sheet shows it whole, marked Refrén (D122). Instrumental parts are labelled in
  Czech: `{start_of_intro: Předehra}`, `{start_of_interlude: Mezihra}`, `{start_of_outro: Dohra}`.
- No indents, single spaces, a space after a comma, a chord on the syllable it's sung on
  (`jistě [Am]rozezná`, not `jistě[Am] rozezná`). Repeat marks as the song has them (`/: … :/`).
- Fix the shape, never the words. A change to the words (a typo, two spellings of one word made
  one) is named to the owner, who approves the song.

## UI conventions

- **Mobile first** for playing: phones and tablets on a stand are the main screen; check 390 px
  first. Adding, editing and reviewing songs happens mostly on wider screens: check 1280 px too.
- **Theme first, then one shared component (D105).** A default that holds everywhere goes in
  `src/client/theme.ts` (`ActionIcon` subtle grey, `Badge` neutral, `Alert` grey, a `Modal`
  header tinted and ruled); what a theme can't do gets one component, not a copy per page:
  `IconButton` (an icon with its tooltip and name), `ConfirmModal`, `showUndoToast`, `InstallButton` (D141), `SongLabel`, `PageLoader`,
  `SettingsButton` (every setting, and "Načíst novinky", on every page). Breakpoints are the theme's: `useWide`,
  `usePhone` in code, `$mantine-breakpoint-*` in CSS.
- **The song is played with gestures, not menus:** a tap hides the bars (D93, D109), a swipe
  turns the song, a pinch (fingers, or a laptop's touchpad) changes the text size (D130,
  D137), a long-press or right-click on a line opens its menu: a note, copying it (D135). So
  text on the song view can't be selected on touch. ⋯ keeps a way to each for a keyboard.
- **The back arrow goes one level up** to a fixed parent, and says where ("Back to Vršek
  2026"); history is the browser's back (D60). **Search is
  the last icon at top right on every page**, song view included, so it is always in one place.
- **Undo, not a question, for small frequent changes (D87, D139):** taking a song out of a
  playlist, a listmate out, deleting a note happen at once, "Beru zpátky" in the toast
  (`showUndoToast`; `onKept` sends a delete only when the toast goes, so nothing has to be
  rebuilt). `ConfirmModal` stays for what is rare, heavy and reaches others (a song, a
  playlist) or can't be undone (leaving a shared one).
- **A list's own things are changed in the list** (D139): a note's text in place, its bin
  beside it, not a dialog per change.
- Buttons inside a row or card are `size="sm"`; `md` is for page-level calls to action.
- **One orange (D61, D103):** filled = primary, `variant="default"` = secondary, never `light`
  on buttons or badges. Alerts are coloured by meaning (green/yellow/red) or neutral. The
  palette is `BRAND` in `theme.ts`, built to pass AA (a spec checks it); orange as text is
  `var(--brand-text)`, lighter on dark.
- Secondary text uses `c="dimmed"`, which the theme sets to pass WCAG AA in light and dark
  (Mantine's defaults do not; a spec checks both). Chords use `var(--chord-color)`. A note on
  the song is meant to be read from the stand: the text's colour on a neutral tint
  (`--note-bg`, `--note-rule`, D139), never dimmed and never orange.

## Deployment and production

Live at **https://zpevnak.cz** (D140; first played at a Christmas carol gig, early December
2026). The old `zpevnak.tadeaspetak.com` and `www.zpevnak.cz` send pages on to it
(`movedTo` in `urls.ts`). Everything on personal accounts.

- **Deploy:** `yarn deploy` (`scripts/deploy.sh`): builds the current commit on Cloud Build and
  deploys it; refuses uncommitted work. Push and deploy only when the owner asks (batch commits
  locally in between).
- **GCP:** project `zpevnak`, gcloud configuration `zpevnak` (never activate it; the machine's
  default config is work). Cloud Run service `zpevnak` in **europe-west4** (custom domains aren't
  offered in europe-west3), at most 2 instances; service account
  `zpevnak-run@zpevnak.iam.gserviceaccount.com`; images in Artifact Registry `zpevnak`
  (europe-west4, cleanup keeps the newest 3). Domain mappings: `zpevnak.cz` (Cloud Run's A and
  AAAA records) and `www.zpevnak.cz` (CNAME `ghs.googlehosted.com.`), DNS at Wedos, the domain
  verified in Search Console; the old `zpevnak.tadeaspetak.com` (CNAME at Namecheap) stays
  mapped for its redirect. Budget: 50 SEK/month (the billing account is in SEK),
  alerts only.
- **Secrets** (Secret Manager): `database-url` (Neon, pooled), `resend-api-key`.
- **Database:** Neon project `wild-sun-64413204` (org `org-dawn-hill-52311853`), aws-eu-central-1.
  `.env.local` (git-ignored, from `neon init`) holds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`;
  the app never loads it, so local work can't touch production. Migrations run on boot in the
  container. To act on production by hand, pass the unpooled URL explicitly, e.g.
  `DATABASE_URL="$(…UNPOOLED…)" node src/server/cli/set-role.ts <email> admin`. Never print it.
- **Changing songs in production by hand** (a fix the owner asked for): through the app's own
  procedures, never raw SQL. A one-off script sets `DATABASE_URL` from the unpooled URL in
  `.env.local` itself, then calls `appRouter.createCaller` as the owner: `songs.update` with
  `seenAt` from when the song was read, `songs.delete`. The change is then checked like any edit
  and recorded as a version (D86). Read first, dry-run, then apply.
- **Email:** Resend, sending from `noreply@zpevnak.tadeaspetak.com`.
- **Users:** the owner (`tadeaspetak@gmail.com`) is admin in production.
- **Free tier:** Cloud Build ~3 min a build (2,500 free min/month), images within 0.5 GB.

## Guard rails

`.claude/hooks/bash-guard.ts` (tested in its spec) blocks force pushes, remote `psql` (a host
in the arguments, `PGHOST=…`, or a `$VARIABLE` that could hold any), commands hidden in `$(…)`, and
anything that changes the machine's global gcloud state: the default configuration is the
owner's work setup and must never change. This repo's gcloud commands run under its own
`zpevnak` configuration through `CLOUDSDK_ACTIVE_CONFIG_NAME` (`.claude/settings.json`).

## The UX agent

`/ux <surface>` runs the `ux` agent (`.claude/agents/ux.md`): a critical walk of one part of the
app in a real browser, as the people who use it, ending in a triaged report and a handover.
It never edits code. `yarn ux:probe` is its measuring instrument.
