# After the first rehearsal: the song view at the stand

**State:** ongoing, everything but D-1 shipped and deployed (D129–D134; D136 and D137 built on
it). Agreed in conversation on 2026-11-24, from the owner's notes after the first rehearsal;
built overnight 2026-11-24/25, unattended (forks are built the recommended way where it is
safe, and listed for the morning).

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
  "Uložit v tónině G pro všechny" (D119, unchanged) and "Hrát v tónině G v tomhle playlistu"; and,
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

1. **Columns by the text (shipped, D129).**
2. **Pinch for text size (shipped, D130).** As built: touch events on the window, as swiping
   already uses (it ignores two fingers); checked with a real two-finger touch in Chromium.
3. **Key per playlist (shipped, D131).** As built: the shift arithmetic (`semitonesFor`,
   `KeyShift`, `nearest`) moved to `src/shared/chordpro/transpose.ts`, shared by a device's
   transposition and a playlist's key.
4. **Chord library and notation (shipped, D132).** As built: 529 guitar and 552 ukulele shapes
   (40 KB); of the 49 distinct chords in production, 46 have one, the rest (Aaddb9, F#m7+/F)
   say so. The Columns switch is now on every screen (D129 had left it to wide ones).
5. **A code review (shipped, 416c425)** of the night's work (`/code-review`), its fixes.
6. **A UX walk (shipped, ab06f36; the owner's calls D133, D134)** of the song view at the stand
   (phone, tablet upright and landscape, a playlist with its own key, diagrams on both
   instruments, both notations), its no-brainers.
7. **Later, from the owner's use:** columns no longer rearrange as the bars slide away (D136);
   text down to 60%, and a touchpad's pinch (D137).

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

Settled with the owner on 2026-11-25 (D133): notation stays as built; each playlist keeps its
own key, and setting it uses up the player's own transposition; toasts below the header; a
change made offline says it waits; the key's actions under one heading; the playlist's mark on
the key. A song's own `{define}` stays a guitar's.

- **D-1** "fit the text to the screen" on an upright tablet: after the owner's tablet test, in a
  couple of days.
