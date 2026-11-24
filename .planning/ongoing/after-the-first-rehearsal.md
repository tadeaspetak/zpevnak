# After the first rehearsal: the song view at the stand

**State:** ongoing. Agreed in conversation on 2026-11-24, from the owner's notes after the first
rehearsal; built overnight 2026-11-24/25, unattended (forks are built the recommended way where
it is safe, and listed for the morning).

## Why

The first rehearsal with the app on music stands showed four things:

1. Changing the text size takes the settings menu; on a tablet, people reach for a pinch.
2. A band often plays a song in another key than the one it's written in, and everyone in the
   band needs to see the same key on the night. Today a key is either the song's (for everyone,
   D119) or one device's own (D24).
3. A tablet held upright never gets two columns (they need a wide screen, D25), even when the
   song would fit them easily at its text size.
4. A friend asked for ukulele chord diagrams. Today diagrams come only from a song's own
   `{define}` lines (D84), so there is no library to switch between instruments with.

## Decided

1. **Pinch to change the text size**, on the song. The owner will test on a tablet.
2. **A key per playlist.** The playlist's key is the starting point, and a player's own
   transposition shifts from there, on their device only. Per-device memory stays as it is
   (no per-user table). A transposed song offers both "save in this key for everyone" (D119)
   and "play in this key in this playlist", better phrased.
3. **Columns decided by the text, not the screen:** two columns whenever no line has to wrap
   in its column at the current text size and the whole song fits on screen (D88).
4. **Chord diagrams for guitar and ukulele**, switchable. **Czech players read H**: the owner
   prefers H notation, as the app is used mostly by Czech people.

## Proposed, settle while building

- **Pinch:** a two-finger pinch on the song steps through the existing text sizes
  (`FONT_SCALES`), snapping, live, and keeps the size when the fingers lift. The browser's own
  pinch-zoom is switched off on the sheet (`touch-action: pan-x pan-y`): ours reflows the
  text instead of spilling it sideways. One finger keeps scrolling and swiping between songs.
- **Playlist key, stored** per playlist and song, not per position: a song twice in one list
  is played in one key. In its own table (`playlist_song_keys`), as `{semitones, from}` against
  the song's starting pitch, like a device's transposition (D119), so the playlist keeps
  sounding the same when someone saves the song in a new key for everyone. It goes when the
  song leaves the playlist. Set by whoever may edit the playlist; everyone who sees the
  playlist plays from it (its people, and visitors of a public one).
- **On the song in a playlist:** the key shown is the playlist's plus the player's own shift.
  The player's own shift is one per song and device, the same in and out of playlists
  (relative to the song's own text), so a capo player's "−2" holds everywhere. The way back
  (tapping the transposed key) goes to the playlist's key. The menu offers, to those who may:
  "Uložit v tónině G pro všechny" (D119, unchanged) and "Hrát v G v tomhle playlistu"; and,
  with a playlist key set, "Hrát v tónině písničky" to clear it. Saving either resets the
  player's own shift. In the playlist's list, a song with its own key shows it.
- **Columns:** the width gate goes; the hidden measuring copy (D88) also checks that no line
  wraps in its column. Phones held upright fail that check by themselves; bigger text turns
  columns off by itself. Replaces D25's "≥ 62em".
- **Diagrams from a library:** shapes from chords-db (MIT, guitar and ukulele), boiled down by
  a script into a small table in the repo (one shape per chord, both instruments) so the
  bundle stays small and works offline. Attribution in the repo. A song's own `{define}` still
  wins for guitar. Diagrams then work transposed too (D84 kept them off while transposed only
  because the song's own shapes were for its own key). A switch in Display: Kytara / Ukulele.
- **H notation (the owner's "add the german note to everything"):** rather than rewriting every
  song, chords are **shown in the reader's notation**: a Display setting "Značení akordů"
  (H as Czech / B as international), defaulting to H in Czech and B in English. Each song's
  text stays as written; the parser already knows which notation each one is written in, and
  transposition, diagrams and display all work on the note itself. This fixes the transposed
  case too: a song in C transposed up a tone shows H, not B, to a Czech reader. Production
  check, 2026-11-24: of 29 songs, 4 are written with H, 1 declares german, 23 have neither B
  nor H, and 1 ("Vánoce, Vánoce přicházejí") writes B7 meaning B natural: it would show as H7.
  Replaces CLAUDE.md's "keep H/B as the song writes it" for display (the source keeps it).
  **A fork for the morning** if the owner prefers the songs themselves rewritten.

## Phases

Each ships on its own, gates green, committed locally; nothing is deployed without the owner.

1. **Columns by the text** (smallest; started 2026-11-24).
2. **Pinch for text size.**
3. **Key per playlist:** migration, procedure, sync in the playlist record, the song view's
   key, the menu, the playlist list.
4. **Chord library and notation:** the shapes table and its script, the instrument switch, the
   notation setting, diagrams while transposed.
5. **A code review** of the night's work (`/code-review`), its fixes.
6. **A UX walk** of the song view at the stand (phone, tablet upright and landscape, a
   playlist with its own key, diagrams on both instruments, both notations), its no-brainers.

## Tests that matter most

- Columns: a line that wraps in its column keeps one column (`columnsFit`, pure); a short song
  on a narrow screen is tried in columns at all.
- Pinch: the scale from a pinch ratio snaps along `FONT_SCALES` and stops at either end
  (pure); two pointers change the size, one doesn't (component).
- Playlist key: only playlist editors set it (and its false reject: a collaborator can);
  readers and visitors get it; it survives a reorder and goes with the song; a song's key
  saved for everyone keeps the playlist sounding the same; the combined shift (pure).
- Library: every chord name the parser accepts in the seeds finds a shape on both instruments,
  or says it has none; german H finds B-natural shapes; notation display maps H/B both ways and
  leaves everything else alone.

## Open questions

- The notation approach (above): display setting, or rewrite the songs.
- Whether a song's own `{define}` should also show for ukulele (it is a guitar shape): proposed
  no, the library's then.
