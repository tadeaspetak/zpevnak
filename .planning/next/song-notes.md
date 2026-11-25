# Notes on songs

**State:** next. Agreed in conversation on 2026-11-25, from the owner's notes after the first
rehearsal. Not started.

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
4. **A note can be a TODO** ("k opravě"), and **all one's notes can be found in one place,**
   filtered to the TODOs, to fix, prune, or look back at.
5. **No mark in the playlist's list** for a song with a playlist note: showing it on the song,
   in the playlist, is enough.

## Proposed, settle while building

- **Adding:** a tap on the song already hides and shows the toolbar (D93), so a note isn't a
  plain tap. ⋯ → "Přidat poznámku" puts the song in a picking mode (lines highlight, a bar at
  the bottom says "Ťukni na řádek" with "K celé písničce" and "Zrušit"); a tap on a line opens
  the note: its text, who it's for (Jen pro mě / Pro playlist „X“, the latter only playing from
  a playlist one may edit), and "k opravě". Discoverable, and no gesture to learn.
- **A note on the page:** under its line, small and quiet, unlike the song (a note icon,
  dimmed italic; a playlist note with the playlist's mark, D133); a TODO with its own mark. A
  tap opens it: edit, mark done, delete. A whole-song note sits under the title.
- **Anchoring that survives edits:** a note keeps its line's place (its index among the song's
  lines) and its words (the lyrics without chords). Shown where both still match; else where
  the words are now (a verse added above moved it); else at the top, marked "řádek se změnil",
  never lost. A pure function, unit-tested on the cases.
- **Who:** a private note, its author alone. A playlist note: seen by the playlist's people
  (any role), not by a public one's visitors (it is the band's); added, edited and deleted by
  whoever may edit the playlist. A reader of a playlist adds private notes only. A note on a
  song the viewer can no longer read (gone private, D127) isn't shown, and comes back if they
  can again; a song deleted takes its notes with it.
- **TODO** is for private notes only (a band instruction isn't a to-do). Done keeps the note,
  marked done, until deleted: what was fixed can still be looked back at.
- **"Moje poznámky"** (`/notes`, from the account page): every note one wrote, private and in
  playlists, newest first, each with its song, its line's words and a link to that place;
  filters Vše / K opravě / Hotové. Plain list, searchable later if it grows.
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

- Who sees what: a private note to its author only; a playlist note to its people, not to a
  public playlist's visitors, an outsider or the songbook's editors; with the false rejects
  (a collaborator adds a playlist note, a reader a private one).
- Anchoring: the same line; a line moved by a verse added above; a line changed or deleted
  (to the top, marked); a whole-song note.
- A song deleted, a playlist deleted, someone leaving a playlist: notes go, or go out of sight.
- Offline: a note written offline waits and arrives; sync drops a playlist note once one has
  left the playlist.

## Open questions

- Should a public playlist's visitors see its notes? Proposed no (the band's).
- TODO on playlist notes too? Proposed no.
- May any playlist editor change another's playlist note? Proposed yes (shared work, as the
  playlist's songs are).
