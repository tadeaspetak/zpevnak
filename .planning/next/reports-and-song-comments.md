# Reports and song comments, through the note dialog

**State:** next. Agreed in conversation on 2026-11-26 with the owner, who took the recommended
pick on every question. Nothing built yet.

## Why

Notes (D135, D138, D139) gave the song view one way to write something at a line: a long-press
or a right-click, then a dialog. Two other things people write about a song still go elsewhere:

1. **A mistake in the song.** "Nahlásit chybu" (D85) opens an email to the app's author
   (`mailtoAuthor` in `src/client/contact.ts`). It leaves the app, can't point at a line, and
   nobody can see that it was reported, or whether it was fixed. It is a TODO for any editor,
   kept in someone's inbox.
2. **A remark that belongs to the song itself,** for everyone ("capo 2 in the original",
   "slowly"). That's a `{comment}` in the ChordPro, which today only the editor's text field
   can add. The notes plan said as much: "a note for everyone everywhere isn't a note: it's a
   `{comment}` in the song" (`.planning/done/song-notes.md`, Decided 2).

Both are "write something at this line", so both should start where notes do.

## Decided

1. **A report is a kind of note**, a third audience beside "jen pro mě" and "pro playlist": for
   the songbook's editors. Written at a line or on the whole song, by someone who can't edit the
   song (as "Nahlásit chybu" today, D85), a TODO for any editor.
2. **A report is seen by the editors and the song's author**, and by whoever wrote it. Not by
   players: mistakes don't clutter the song at a gig.
3. **No email on a report** (2026-11-26, replacing "an email, as today's link does"): editors
   find reports in the queue, the song's author on their song.
4. **A song comment is written through the same dialog**, as a third choice for whoever may
   change the song, but it is **an edit of the song's ChordPro**, not a note: it never shows
   in Moje poznámky, and it is saved, versioned and checked like any edit of the song (D86,
   D104, D106).
5. **Reports first, song comments second.**
6. **The editors' queue is a tab per kind** (2026-11-26): songs waiting, rejected, reports, and
   later suggested changes (`.planning/ongoing/song-history-credits-suggestions.md`, slice 3)
   as one more tab. Suggestions themselves aren't built here.

## Proposed, settle while building

### Reports

- **Who may report:** a signed-in, confirmed account (as every note, D135). A visitor without
  an account: open question 1.
- **Not on a private song:** it has no editors' review, and "Nahlásit chybu" isn't offered
  there today (D85). Whoever may change a private song edits it.
- **On the song:** an editor and the song's author see open reports under their lines with
  their own mark (a flag, not the note's icon), "Vyřešeno" one tap away. Players never see
  them. The reporter sees their own report there too, until it's resolved.
- **Resolved:** "Vyřešeno" by any editor, or by the song's author (they fixed it), records who
  and when. A resolved report leaves the song and the queue; the reporter keeps it in Moje
  poznámky, marked resolved, until they delete it. No reply text yet: the fix is the answer,
  and the song's versions show it (D86).
- **Changed or deleted** by its reporter only, while it is open.
- **In the queue:** a tab "Hlášení" beside the songs waiting, oldest first: the song, the line's
  words, the text, who and when; a tap leads to the song, scrolled to the report. The count on
  the overview's queue icon adds the open reports.
- **In Moje poznámky:** one's reports, with their mark and state (open, resolved). They are
  not TODOs of one's own: the TODO filter stays one's own TODOs.
- **Offline:** reports come in `notes.visible` with the rest (an editor gets every open
  report; there are few). Writing one offline waits, as every note does (D133, D138).

### Song comments

- **In the dialog:** "Pro koho" gets a third choice for whoever may change the song
  (`canChangeSong`), "Do písničky (uvidí všichni)", worded so nobody publishes a private
  thought by mistake. TODO doesn't apply to it.
- **Written as `{comment: …}`** on the line after the chosen line (after the song's header for
  the whole song), saved through `songs.update` with `seenAt` from when the song was loaded;
  `SONG_CHANGED` says so and reloads, as the editor does (D106).
- **On the sheet,** a song comment keeps the song's own look (it is the song), apart from the
  tinted notes (D139). Tapped by whoever may change the song, it opens in the same dialog:
  change its text, or delete it.
- **Deleting one** is a song edit everyone sees: proposed, at once with "Beru zpátky" (D139's
  rule), the undo saving the comment back as a new version.
- **The rest of the song is untouched:** only that line is added, changed or removed; nothing
  else of the source is reformatted.

## The model

- **`song_notes`** gets a `kind` (`own`, `playlist`, `report`) in place of reading the audience
  from `playlist_id`, with checks: `playlist_id` set exactly for `playlist`; `todo` only on
  `own`. A report's resolution in `resolved_at` and `resolved_by` (→ users, set null on
  delete). One migration, a literal backfill (`playlist` where `playlist_id` is set, else
  `own`).
- **Visibility** in `NOTE_SELECT` (`src/server/notes/record.ts`): a report to its author, to
  editors, and to the song's `created_by`, on a song the viewer may read; resolved ones only to
  their author. `toNoteRecord` gains `kind` and `resolvedAt`; `canChangeNote`
  (`src/client/data/notes.ts`) and `assertCanChangeNote` learn reports, together.
- **Procedures:** `notes.create` takes the kind; `notes.resolve` (an editor, or the song's
  author); the queue's reports as their own procedure, `notes.reports`, beside `songs.queue`
  (one per tab's kind).
- **Song comments:** the parser records each line's source line (`source: number` on `Line`);
  pure functions beside `setTags` in `src/shared/chordpro/` add, replace and remove a
  `{comment}` at a source line, unit-tested on real shapes (inside a section, after a chorus
  recall, at the whole song, a song with CRLF line ends). A comment added is a line among the
  song's lines, so the notes below it move one place; `placeOf` finds them again by their
  words (tested).

## Phases

Each ships on its own, gates green.

1. **Reports as notes.** The migration and visibility; create and resolve; the
   dialog's third audience for whoever can't edit the song; reports on the song for editors
   and the author; "Nahlásit chybu" in ⋯ opens the dialog for the whole song (the long-press
   menu gains it too); someone who can't write a report as open question 1 settles.
2. **Reports in the queue.** The "Hlášení" tab, the count on the queue icon, the way to the
   report on the song.
3. **Song comments through the dialog.** The parser's source lines and the pure functions
   first (a refactor with no change in behaviour, shipped on its own); then the dialog's
   choice, the comment opened from the sheet, delete with undo.
4. **A review and a UX walk** of the three, as an editor, an author, a player and a reporter.

## Tests that matter most

- **Who sees a report:** its author, editors, the song's author; never a player, a playlist's
  visitor, or anyone on a private song. With the false rejects: a confirmed user reports a
  verified song; the song's author resolves a report on their own song.
- **Resolving:** by an editor and by the song's author succeeds; by the reporter or a player
  is refused; a resolved report leaves the song and the queue but stays in its author's list.
- **The migration:** existing notes keep their audience (own, playlist) and nothing else
  changes; down and up again (every test run does).
- **Song comments:** added after the right source line in every song shape; replacing and
  removing touch that line only; a save over a song that changed meanwhile is refused
  (`SONG_CHANGED`) and the typed text isn't lost; a note below the new comment stays on its
  line.

## Open questions

1. **Without an account:** today a visitor who isn't signed in can report by email (the ⋯
   menu's "Nahlásit chybu" opens a mail to the owner). Keep that link for those who can't
   write a report (signed out, or not yet confirmed), or lead them to sign in?
