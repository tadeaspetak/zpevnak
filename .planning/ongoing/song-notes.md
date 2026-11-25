# Notes on songs

**State:** ongoing. Agreed in conversation on 2026-11-25, from the owner's notes after the first
rehearsal. Phase 1 started 2026-11-25.

## Why

At a rehearsal people find things in a song they want to keep, and today the only place is
the song's text, which is everyone's:

1. A mistake (a wrong chord, a missing verse): a TODO written into the song works while few use
   it, and not once more do; a note elsewhere has to say awkwardly which song and where.
2. A reminder for oneself: "play A → B → C before landing on the D".
3. An instruction for the band: "chorus 3 times, then end on G".

## Decided

1. **Notes are their own data, never in the ChordPro.** The song's text stays the one truth
   for everyone; nobody's notes change it, and editing it changes nobody's notes.
2. **Two audiences:** **jen pro mě** (private, the default: examples 1 and 2) and **pro
   playlist** (its people see it when playing from that playlist: example 3, "we" is the
   band, D131's sibling). A note for everyone everywhere isn't a note: it's a `{comment}` in
   the song, by whoever may edit it.
3. **On a concrete place in the song:** a line, shown right under it as you play past it.
4. **A note can be a TODO**, and **all one's notes can be found in one place,**
   filtered to the TODOs, to fix, prune, or look back at.
5. **No mark in the playlist's list** for a song with a playlist note: showing it on the song,
   in the playlist, is enough.
6. **A playlist note is for everyone who sees the playlist** (settled 2026-11-25), its
   visitors without an account too: some of the band have none and never must, and the
   playlist is the one source of truth. A note on a private song is never seen by anyone who
   can't read the song (D127, D128): a public playlist's visitors don't see the song, nor its
   notes. So a note is **private** (its author's) or **the playlist's** (whoever sees it).
7. **"TODO"**, the same word in both languages, and **only on private notes**: a band-wide
   to-do has no one to do it.
8. **Any playlist editor** may change or delete the playlist's notes: shared work, as its
   songs are.

9. **Adding a note at a line** (settled 2026-11-25): a tap stays the toolbar's (D93), so:
   - **touch: a long-press on a line** (about half a second; moving the finger cancels it, so
     scrolling and swiping between songs stay as they are) opens a small menu at the line,
     "Přidat poznámku" first. Android's long-press `contextmenu` and a timer for iOS, one
     handler. **Text on the song view can't be selected on a touch screen** for this (no
     iOS callout): the owner's call; lyrics can still be copied from the editor.
   - **mouse: a right-click on a line** opens the same menu; hovering a line shows a faint note
     icon in its margin that does the same, so it can be found.
   - **⋯ → "Přidat poznámku" stays as the fallback:** it says "Podrž prst na řádku…" (teaching
     the gesture) and starts a picking mode (lines highlight; a bar: "Ťukni na řádek", "K celé
     písničce", "Zrušit"). The way in for the keyboard and screen readers too. The empty
     "Moje poznámky" says the same.
   - The menu then opens the note: its text, who it's for (Jen pro mě / Pro playlist „X“, the
     latter only playing from a playlist one may edit), and "TODO" (private only).

## Proposed, settle while building

- **A note on the page:** under its line, small and quiet, unlike the song (a note icon,
  dimmed italic; a playlist note with the playlist's mark, D133); a TODO with its own mark. A
  tap opens it: edit, mark done, delete. A whole-song note sits under the title.
- **Anchoring that survives edits:** a note keeps its line's place (its index among the song's
  lines) and its words (the lyrics without chords). Shown where both still match; else where
  the words are now (a verse added above moved it); else at the top, marked "řádek se změnil",
  never lost. A pure function, unit-tested on the cases.
- **Who:** a private note, its author alone. A playlist note: seen by whoever sees the playlist
  (7); added, edited and deleted by whoever may edit it (9). A reader of a playlist adds private notes only. A note on a
  song the viewer can no longer read (gone private, D127) isn't shown, and comes back if they
  can again; a song deleted takes its notes with it.
- **A TODO done** keeps the note, marked done, until deleted: what was fixed can still be looked
  back at.
- **A song taken out of a playlist** keeps the playlist's notes on it, out of sight, and they come
  back with the song (a removal can be undone, D87): notes are someone's work, not a setting.
- **"Moje poznámky"** (`/notes`, from the account page): every note one wrote, private and in
  playlists, newest first, each with its song, its line's words and a link to that place;
  filters Vše / TODO / Hotové. Plain list, searchable later if it grows.
- **Offline:** notes come whole with every sync (`notes.mine`: one's own, and the playlist
  notes of one's playlists), like playlists: few per person. Stored on the device (IndexedDB
  version 2, a `notes` store). A note written offline waits and says so (`notifyIfQueued`,
  D133).
- **Display:** a "Poznámky" switch, on by default, to play clean.

## The model

`song_notes (id, song_id → songs ON DELETE CASCADE, author_id → users ON DELETE CASCADE,
playlist_id → playlists ON DELETE CASCADE NULL (null: private), text, todo boolean,
done_at timestamptz NULL, line_index int NULL (null: the whole song), line_text text NULL,
created_at, updated_at)`. Procedures in `src/server/routers/notes/`: `notes.mine`,
`notes.create`, `notes.update`, `notes.delete`. Anchoring and visibility rules in
`src/shared/notes.ts`. A record built field by field (`toNoteRecord`).

## Phases

Each ships on its own, gates green.

1. **The model and the server:** migration, procedures, permissions, sync of `notes.mine`.
2. **Notes in the song view:** shown at their lines, the picking mode, the note dialog, the
   Display switch, offline.
3. **Moje poznámky:** the page and its filters.
4. **A review and a UX walk,** their no-brainers.

## Tests that matter most

- Who sees what: a private note to its author only; a playlist note to whoever sees the
  playlist, a public one's visitors too, but never on a private song they can't read, nor on a
  private playlist to outsiders or the songbook's editors; with the false rejects (a
  collaborator adds a playlist note, a reader a private one).
- Anchoring: the same line; a line moved by a verse added above; a line changed or deleted
  (to the top, marked); a whole-song note.
- A song deleted, a playlist deleted, someone leaving a playlist: notes go, or go out of sight.
- Offline: a note written offline waits and arrives; sync drops a playlist note once one has
  left the playlist.

## Open questions

None open (2026-11-25).
