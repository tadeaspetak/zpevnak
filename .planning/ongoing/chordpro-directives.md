# What a song's ChordPro holds

**State:** ongoing. Agreed with Tadeáš on 2026-11-27. Phases 1–3 shipped (D150, D151); phase 4
waits for his and the friend's word.

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

### 2. Production's songs, once (done 2026-11-27)

Through the app's procedures as Tadeáš (CLAUDE.md), read first, dry run, then apply. What
changes: Andělská, Lajla tov, Son of a Preacher Man lose their print layout; two duplicate
subtitles go; Pásli ovce Valaši loses its verse numbers; Tygrovanej sprej's spacing. By hand,
with his word: Andělská's `{comment: COMMENT}` and `{comment: Goment}` (test leftovers?) and its
`Nerez` tag (an artist tag, and not hers); Lajla tov's `# Only the chords below get a diagram`
line (true only under the stripped `{+diagrams.show: user}`). Until then each tidies on its next
save anyway.

**As done:** Tadeáš fixed Andělská's comments and tag himself; the script (`songs.update` as him,
`seenAt` from its own read, dry run first) tidied the five and took out Lajla tov's `#` line. All
five stay verified, each with an edit version; a second run found nothing left.

### 3. A song from the songbook (on offer in the editor, like D94) (shipped, D151)

Judgement calls, so offered, never on save:

- `{c: REF}` alone before a blank line (214) → `{chorus}`; followed by lyrics without a section
  (292) → those lines as `{start_of_chorus}`; right before `{soc}` (46) → dropped.
- `{c: Intro}`, `MEZIHRA`, `Outro` with a chord line → `{start_of_intro: Předehra}`,
  `interlude: Mezihra`, `outro: Dohra`; `{c: capo 3}` → `{capo: 3}`.
- Chords `Ami` → `Am` (119 songs; they work already, `shapes.ts` reads `mi`); a band in
  `{subtitle}` with no artist (`{st:JPBand}`); a number before the title (`03 Honky tonk woman`).
- Tags by the table above.

**As built** (`src/shared/chordpro/arrange.ts`, `arrangeSong`; the editor's "Písnička je zapsaná
po staru. Upravit: …?", after the chords-above-lyrics offer and before the tidy notice;
"Upravit" arranges and tidies in one step, one undo):

- A bare paragraph with sung words becomes a verse. One of chords only becomes Předehra before
  the first sung part, Dohra after the last, Mezihra between (added after the first deploy, when
  the audit of production found four songs with such lines left between verses); in a song of
  chords only (a band's chart) it stays as it is.
- A lone `{c: REF}` takes the paragraph after it only while the song has no chorus yet; after
  that it is the chorus sung again (`{chorus}`), and only if that's the last chorus: a recalled
  "REF 1" after "REF 2" stays a comment, as no directive repeats an earlier one. Numbered
  choruses are labelled "Refrén 1", "Refrén 2".
- A heading's other words stay as a comment in the section (`{c: intro keys}` → Předehra with
  `{comment: keys}`; `REF 2x` → `{comment: 2x}`). Not a heading: "verse 3 = 2", "R. Někdo",
  `{c: REF}` twice and then a line; they stay as written. "Bridge 2" before a bridge stays.
- Tags: only the old songbook's dashed ones (genre without dashes, status gone) and one naming
  the song's own artist. Bands and other artists' names stay: nothing in the text tells a band
  from a category, so they go by hand in the tags field until phase 4.
- `{st:JPBand}` with no artist: not arranged; the tidy makes it the artist, as the app read it,
  and whoever brings the song over sees it under the title. The same holds for a real subtitle
  with no artist ("What kind of woman is this").
- `{key:Am` and `{tag:Waldemar Matuška)` are closed.

Dry run (2026-11-27): 386 of the 432 songbook songs get the offer (sections 361, tags 220,
chords 74, capo 17, title 14, unclosed 3); arranging twice changes nothing more; no song gains a
parser warning; the sung words are the same in all but 4, and those 4 gain words that were a
broken directive before or lose a literal `{soh}`. In production, 12 of 31 songs get the offer
when edited (most for bare verses), none on their own. Tadeáš tried it on three, then asked for the rest
to be done (2026-11-27): the other nine went through `songs.update` as him, dry run first, each a
version; now none of production's 29 gets the offer or the tidy.

### 4. The songbook's bands and lists as playlists

The band and event tags, and `playlists/*.lst`, as playlists for whoever plays them. Needs the
friend's and Tadeáš's word on who owns them.

## Tests that matter most

- Tidying never changes what the reader sees (a spec parses before and after).
- A tidy song saved as it was records no version, whether the client sent it tidy or not.
- The template's blanks don't raise the notice.

## Open questions

- ~~Phase 2: apply to production?~~ Yes (Tadeáš, 2026-11-27); done.
- Phase 4: whose are the band playlists? (Tadeáš and the friend)
