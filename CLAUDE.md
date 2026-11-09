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
yarn build              # the client into dist/ (the server needs no build)
yarn ux:probe --url /song/1 [--email user@zpevnak.test]   # measure one page state, see /ux
node src/server/cli/set-role.ts <email> admin          # make the first admin
```

Dev personas, all on the password `zpevnak-dev-password` (`src/server/db/devPersonas.ts`):
`admin@`, `editor@`, `user@`, `new@` (unverified) `zpevnak.test`. In development, emails are
printed to the server log.

## Planning

- **`docs/DECISIONS.md`**: what has been settled and why (D-numbers). Binding; cite them.
- **`.planning/{ongoing,next,later}/`**: plans by state. `next/` is shaped but not started,
  `ongoing/` has started, `later/` is parked. Move a plan along as it progresses, and record what
  it settles in the decisions log when it ships.
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
- **Offline first.** The whole catalog (songs and playlists the viewer can see) lives in
  IndexedDB (`src/client/data/`) and is searched on the device with MiniSearch. `songs.sync`
  sends what changed since a cursor; `playlists.all` sends everything (it is small). Reads go
  through `useCatalog()`, not tRPC queries. After a mutation, put the returned record into the
  catalog (`putSong`, `putPlaylist`).
- **The ChordPro text is the only truth about a song.** Title and artist are read from its
  header on every save (`src/server/songs/header.ts`); never edit them separately.
- **Production:** Cloud Run (GCP project `zpevnak`, europe-west3) and Neon Postgres. Local
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
  (`tests/server/helpers.ts`: `useCleanDatabase`, `createUser`, `callerFor`, `withCookies`).
  End-to-end is for the one happy path through the app, not for permutations.
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
- **Hide existence.** A private playlist or a rejected song answers NOT_FOUND to someone who
  may not see it, not FORBIDDEN.
- **URLs come from `src/client/urls.ts`** (`url.song(…)`, `routes`). Never build a path by hand.
- **Translations ship with the code, both languages, every time.** `cs.ts` is the source; `en.ts`
  is typed against it, so a missing key fails `tsc`. Czech: mind the grammar a placeholder lands
  in (prepositions and cases change with the noun; prefer neutral phrasings like `Zpět: {name}`).
- **Braces on every `if`/`else`/loop**, on their own lines (ESLint `curly`).
- **Comments say why, not what.**
- **Musical notation:** keep H/B as the song writes it. Czech songs use german notation (H = B
  natural, B = B♭); transposition keeps the song's system (`src/shared/chordpro/chord.ts`).

## UI conventions

- **Mobile first.** Phones and tablets on a stand are the main screen. Check 390 px first.
- **The back arrow goes one level up** to a fixed parent, and says where ("Back to Vršek
  2026"); history is the browser's back (D60). **Search is
  the last icon at top right on every page**, song view included, so it is always in one place.
- Buttons inside a row or card are `size="sm"`; `md` is for page-level calls to action.
- **One orange (D61):** filled = primary, `variant="default"` = secondary, never `light` on
  buttons or badges. Alerts are coloured by meaning (green/yellow/red) or neutral.
- Secondary text uses `c="dimmed"`, which the theme darkens to pass WCAG AA (Mantine's default
  does not). Chords use `var(--chord-color)`.

## Guard rails

`.claude/hooks/bash-guard.ts` (tested in its spec) blocks force pushes, remote `psql`, and
anything that changes the machine's global gcloud state: the default configuration is the
owner's work setup and must never change. This repo's gcloud commands run under its own
`zpevnak` configuration through `CLOUDSDK_ACTIVE_CONFIG_NAME` (`.claude/settings.json`).

## The UX agent

`/ux <surface>` runs the `ux` agent (`.claude/agents/ux.md`): a critical walk of one part of the
app in a real browser, as the people who use it, ending in a triaged report and a handover.
It never edits code. `yarn ux:probe` is its measuring instrument.
