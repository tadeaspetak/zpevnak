# What a song's ChordPro holds

**State:** ongoing. Agreed with Tadeáš on 2026-11-27. Phase 1 shipped (D150); phase 2 waits for
his go on production; phases 3 and 4 are for when songs come over from the songbook.

## Why

The app is about to fill up with songs, most of them from `~/dev/projects/songbook` (432
ChordPro files kept for the friend's SongBook app and ChordPro's PDF). Those carry a printed
page's layout (`{columns}`, `{column_break}`, `{+diagrams.show: user}`, `{+pdf…}`), another
app's settings (`{zoom-iphone}`, `{soh}`), every spelling ChordPro allows for one thing (`{c}`
and `{comment}`, `{st}` repeating `{artist}`), and structure written as comments (`{c: REF}`, 559
times). Tadeáš's question: which of ChordPro's directives belong in a song's text at all, which
are an export's business, and whether tags belong in the text or the database.

## What ChordPro has, and what comes our way

From the ChordPro 6 spec, counted in the songbook (432 songs) and production (29, 2026-11-27):

| Group              | Directives                                                                                                                                          | Songbook                                              | Production                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------- |
| Metadata           | title, subtitle, artist, key, capo, tempo, time, duration, tag, composer, lyricist, arranger, album, year, copyright, sorttitle, sortartist, `meta` | title 354, subtitle 414, artist 123, key 143, tag 644 | title 29, key 28, tag 20, artist 12 |
| Sections           | verse, chorus, bridge, tab, grid, any `start_of_x`, `{chorus}`                                                                                      | 600+                                                  | 130+                                |
| Comments           | comment, comment_italic, comment_box, highlight                                                                                                     | 1,025 (`REF` 559)                                     | 15                                  |
| Diagrams           | define, chord                                                                                                                                       | 15                                                    | 17 in 3 songs                       |
| Transposition      | `{transpose}`                                                                                                                                       | 0                                                     | 0                                   |
| Print layout       | columns, column_break, new_page, new_physical_page, pagetype, titles, diagrams, grid, no_grid                                                       | 92                                                    | 6                                   |
| Fonts              | 27 `*font`, `*size`, `*colour`                                                                                                                      | 0                                                     | 0                                   |
| Config             | `{+pdf…}`, `{+diagrams…}`, `{+notes.system}`                                                                                                        | 83                                                    | 7                                   |
| Rendered as images | abc, ly, svg, textblock, `{image}`                                                                                                                  | 0                                                     | 0                                   |
| Other              | `new_song`, selectors (`{define-ukulele}`), `x_…`, `[*annotations]`, Pango markup                                                                   | 0                                                     | 0                                   |
| SongBook's own     | `{zoom-iphone}`, `{soh}`/`{eoh}`, `{solo}`, `{metronome}`                                                                                           | 6                                                     | 0                                   |

## Decided

1. **Four bins** (D150): keep what describes the song; strip a printed page's and other apps'
   settings; convert second spellings into the one way the songbook writes; refuse the rest with
   a warning.
2. **When:** on every save, and the editor says so in one line first (his pick "B": no silent
   change).
3. **Comments:** one plain style; italic and boxed ones become `{comment}`.
4. **`{define-ukulele}`:** refused for now, though D132 gave the app a ukulele.
5. **Tags stay in the text** (D118). A tag says what the song is; what someone does with it is a
   playlist. For the songbook's tags:

   | Kind             | Examples (songs)                                                            | Goes to                             |
   | ---------------- | --------------------------------------------------------------------------- | ----------------------------------- |
   | Genre, occasion  | `- Pop -` 46, `- Folk -` 31, `- Nostalgie -` 13, `- Kotlík -` 9             | a tag, without the dashes           |
   | Status, personal | `- Zpěvník -` 116, `- PS oblíbené -` 19, `- Novinky -` 19, `- !Dodělat -` 6 | someone's playlist, or nothing      |
   | Band or event    | JP Blues band 31, Filip Zoubek & The Blues Q 29, IT Music Jam 28, HTF 21    | a (shared) playlist                 |
   | Artist           | Beatles, Jaromír Nohavica, Čechomor, …                                      | dropped: `{artist}` says it         |
   | Language         | `- Po anglicku -` 25                                                        | dropped: on some English songs only |

## Phases

### 1. Tidy on save (shipped, D150)

`src/shared/chordpro/tidy.ts` (`tidySource`), applied by `readForSave` in create, update and
verify; the parser passes over the stripped kinds quietly (`droppedDirective`), shows every
comment alike, reads `{genre}` as a tag, `{metronome}` as the tempo, a `{time}` that is a length
as none, and leaves abc/LilyPond/svg/textblock out with a warning; annotations warn. The
`columnBreak` block is gone. The editor says what a save will tidy, with "Uklidit hned". Seeds
tidied, and a spec keeps them so.

**As built:**

- `{transpose}` is still refused, not converted: no song in the songbook or production has one,
  and converting the rest of a song needs its notation from the whole text. If one turns up,
  `transposeSource` on the lines after it is the way.
- `{x_…}` is stripped, not refused: it is another app's setting, like `{zoom-iphone}`.
- A subtitle with no artist becomes `{artist}`, as the app read it already; the parser's
  fallback to the subtitle stays for text not yet saved. Labels go only when they repeat the
  section's own: a verse's number or "Verse 2", a chorus's "Ref" or "Chorus". "Refrén 2" and
  "Bridge" stay (they tell two apart, or the sheet wouldn't name it).
- `{artist: }` left blank stays as it is (the editor's template has it).
- A comment written into a song from the song view (D145) saves through `songs.update`, so it
  tidies the rest of an untidy song too, unannounced there; the version shows it.

Dry run (2026-11-27): 422 of the 432 songbook songs and 5 of production's 29 change; tidying
twice changes nothing more; the sheet reads the same for all but 11 (dropped labels, and
Greensleeves no longer shows a literal `{soh}love{eoh}`).

### 2. Production's songs, once

Through the app's procedures as Tadeáš (CLAUDE.md), read first, dry run, then apply. What
changes: Andělská, Lajla tov, Son of a Preacher Man lose their print layout; two duplicate
subtitles go; Pásli ovce Valaši loses its verse numbers; Tygrovanej sprej's spacing. By hand,
with his word: Andělská's `{comment: COMMENT}` and `{comment: Goment}` (test leftovers?) and its
`Nerez` tag (an artist tag, and not hers); Lajla tov's `# Only the chords below get a diagram`
line (true only under the stripped `{+diagrams.show: user}`). Until then each tidies on its next
save anyway.

### 3. A song from the songbook (on offer in the editor, like D94)

Judgement calls, so offered, never on save:

- `{c: REF}` alone before a blank line (214) → `{chorus}`; followed by lyrics without a section
  (292) → those lines as `{start_of_chorus}`; right before `{soc}` (46) → dropped.
- `{c: Intro}`, `MEZIHRA`, `Outro` with a chord line → `{start_of_intro: Předehra}`,
  `interlude: Mezihra`, `outro: Dohra`; `{c: capo 3}` → `{capo: 3}`.
- Chords `Ami` → `Am` (119 songs; they work already, `shapes.ts` reads `mi`); a band in
  `{subtitle}` with no artist (`{st:JPBand}`); a number before the title (`03 Honky tonk woman`).
- Tags by the table above.

### 4. The songbook's bands and lists as playlists

The band and event tags, and `playlists/*.lst`, as playlists for whoever plays them. Needs the
friend's and Tadeáš's word on who owns them.

## Tests that matter most

- Tidying never changes what the reader sees (a spec parses before and after).
- A tidy song saved as it was records no version, whether the client sent it tidy or not.
- The template's blanks don't raise the notice.

## Open questions

- Phase 2: apply to production? (Tadeáš)
- Phase 4: whose are the band playlists? (Tadeáš and the friend)
