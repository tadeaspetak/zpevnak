# Song history, credits and suggested changes

**State:** ongoing. Agreed in conversation on 2026-11-09. Slice 1 shipped 2026-11-10 (D86);
slices 2 and 3 wait until after the Christmas carol gig.

## Why

Three questions came up together, and they are one problem:

1. **Credits.** A song page could say who added it and who approved it. But when someone adds a
   song and someone else fixes it before it is approved, both are its authors, and today we keep
   only `created_by` and `reviewed_by`.
2. **Improving an approved song.** Someone looking at an approved song may want to change it,
   possibly for the better. Today only editors can (D3), and an editor's edit goes live at once,
   unreviewed.
3. **Safety.** With edits going live directly, a bad edit can't be undone, and nobody can see
   what changed.

All three are answered by keeping a song's versions, and building credits and suggestions on top.

## The plan, in three slices

Each slice ships on its own, in this order.

### 1. Version history, recorded quietly (shipped, D86)

As shipped, it differs from the sketch below in three ways: the kinds are only `create`, `edit`
and `approve` for now (slice 3 adds `accept_suggestion` and `revert` with the features that use
them); every approval records a version, not only one with edits; and an edit that leaves the
text unchanged records nothing. Code: `src/server/songs/versions.ts`.

Every save stores a copy of the song. Nothing shows it yet; it starts the record.

- **Data:** a `song_versions` table: `id`, `song_id` (references `songs`, cascades on delete),
  `source`, `title`, `artist`, `saved_by` (references `users`, set null on delete), `saved_at`,
  and `kind` (`create`, `edit`, `approve`, `accept_suggestion`, `revert`).
- **When:** in `songs.create`, `songs.update`, and `songs.verify` (when it saves edits), in the
  same transaction as the song's own update.
- **Cost:** songs are a few kB; 500 songs with 20 versions each is ~20 MB at worst. Fine.
- **Existing songs:** one `create` version each, from their current text, by a migration.
- **Reopens D5** ("no version history"). Record the replacement in `docs/DECISIONS.md`.
- **Tests:** each save path writes exactly one version, with the right `kind` and `saved_by`; a
  deleted song's versions go with it.

### 2. Credits on the song page

Derived from the history, so the "two authors" case needs no special handling.

- **Shown** quietly under the artist, or at the foot of the song:
  `Přidal(a) Tadeáš · upravila Ema · schválil Erik`.
  - **Přidal(a):** `songs.created_by`.
  - **Upravil(a):** everyone else who saved a version, in order of their first change.
  - **Schválil(a):** `songs.reviewed_by`, while the song is approved.
- **Names** are display names, already public on playlists.
- **Open:** show credits to everyone, or only to signed-in users? Lean: everyone, they're
  harmless and give credit where it's due.
- **Note:** the song view is "as little as possible around the song" (D20), so keep this one
  quiet line, dimmed; maybe only at the foot of the song.

### 3. Suggested changes for approved songs

Anyone who isn't an editor and edits an approved song submits a **suggestion** instead of
saving over it. The approved version stays exactly as it is until an editor accepts.

- **Data:** a `song_suggestions` table: `id`, `song_id` (cascade), `base_version_id` (the version
  it was made from), `source`, `suggested_by`, `created_at`, `status` (`pending`, `accepted`,
  `declined`), `reason` and `note` (on decline, reusing the rejection reasons), `reviewed_by`,
  `reviewed_at`.
- **Who:** signed-in users with a confirmed email, on approved songs. Editors keep editing
  directly (and every edit is now a version, so it can be rolled back). This also gives authors
  a way to improve their own approved song, which D3 doesn't allow today.
- **Editor's side:** the review queue gets a second kind of item, "Návrhy" (suggestions), next
  to new songs. The checklist badge (D63) counts both.
  - **The review screen** shows the suggestion against the current version: a line diff of the
    ChordPro (a small library such as `diff`, or our own line LCS), and the preview.
  - **Actions:** accept (it becomes a version, `kind: accept_suggestion`, credited to the person
    who suggested it), decline with a reason, or edit the suggestion before accepting.
  - **If the song changed since the suggestion was made** (`base_version_id` isn't the current
    version), say so, and show the diff against the current version.
- **Suggester's side:** "Moje návrhy" on the account page, with each suggestion's state and,
  when declined, the reason.
- **Rollback:** editors can pick an earlier version on the review screen and restore it (a new
  version, `kind: revert`). Nothing is ever lost.

## Decided already, so these stay as they are

- Rejected songs: out of search, marked everywhere else (D77). Suggestions don't change that.
- Delete is final, and takes the versions and suggestions with it (D78).
- One developer, commits to `main` (D40); every slice ships with its tests.

## Open questions

- Should a suggestion be visible to anyone besides its author and editors (e.g. "1 change
  suggested" on the song)? Lean: no, it's editorial work.
- Should suggestions be possible on songs that are still pending? Probably not: pending songs
  can be edited by their author and editors directly.
- How many versions to keep: all, or prune after N? Lean: all, they're tiny.
- Notify a suggester when their suggestion is decided? No email for now; "Moje návrhy" shows it.
