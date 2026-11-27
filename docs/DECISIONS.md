# Decisions

What has been settled, and why, so nobody (human or agent) re-litigates it without new evidence.
Each entry has a number; cite it (`D7`) when a change touches it. To overturn one, add a new
entry that says which it replaces and what changed.

## Product

- **D1. Only verified songs are trusted, but everyone sees every song.** New songs start
  _pending_ and anyone can see and play them, marked "unverified". Editors verify them or reject
  them with a reason. (2026-11-09)
- **D2. Rejected songs leave the catalog** (search, offline copy, playlists) for everyone except
  their author, who sees the reason and can fix and resubmit (back to pending). Editors find
  them in the queue's Rejected tab. (2026-11-09)
- **D3. Who edits what.** Editors and admins edit any song; an editor's edit keeps the song's
  status. An author edits their own song only while it is pending or rejected. Regular users
  never edit verified songs. (2026-11-09)
- **D4. Editing is ChordPro.** The editor and the review screen edit the ChordPro source beside
  a live preview. No WYSIWYG editor for now. (2026-11-09)
- **D5. No version history.** A save overwrites the song. (2026-11-09) _Replaced by D86._
- **D6. Tags stay in the songs and do nothing** for now: no filters, no tag UI. (2026-11-09)
  _Replaced by D118._
- **D7. Playlists are public or private**, no other sharing. Anyone, signed in or not, can open
  a public playlist. Only the owner changes it, editors included. (2026-11-09)
- **D8. Roles:** user < editor (+ verify, reject, edit any song) < admin (+ assign roles). An
  admin can't change their own role. (2026-11-09)
- **D9. Songs and playlists need a confirmed email**; browsing never needs an account.
  (2026-11-09)
- **D10. Czech and English.** Czech is the source language. Lyrics are never translated.
  (2026-11-09)
- **D11. Start small.** The old songbook is not imported; songs are added (and so verified) one
  by one. The two seed songs are Tadeáš's own verified sheets. (2026-11-09)

## The song view

- **D20. As little as possible around the song.** One toolbar, which slides away while
  scrolling down into the song and returns on scrolling up. The song gets the screen.
  (2026-11-09)
- **D21. Toolbar order:** back, then the song's controls (transpose `− key +`, text size, full
  screen, ⋯), then a divider, then search. Song controls to the left of the divider, the whole
  app to its right. (2026-11-09)
- **D22. The key shows in the chord colour inside an outlined `− A +` pill**, so it can't be
  mistaken for the text-size control. Text size is one typography icon opening a `− 100% +`
  popover, not two A−/A+ buttons, which looked like keys. (2026-11-09)
- **D23. Chord diagrams** show the song's own `{define}`d voicings above the song, names on one
  line. They hide while transposed (the voicings no longer match). The ⋯ menu item is "Chord
  diagrams" ("Diagramy akordů"). (2026-11-09)
- **D24. Transposition keeps the song's note system** (H/B in Czech songs) and is remembered per
  song, per device. (2026-11-09)
- **D25. Two columns only where they fit** (≥ 62em) and only when the song asks (`{columns}`).
  (2026-11-09) _Narrowed by D88; the song's say replaced by D108._
- **D26. The screen stays awake** on a song (Wake Lock). (2026-11-09)

## Navigation

- **D30. Search is the last icon at top right on every page**, song view included. It opens the
  overview with the search box focused. Moving it between pages was tried and rejected: a global
  control must stay in one place. (2026-11-09) _Settings sit beside search, on every page: D113._
- **D31. Back says where it goes**, in its tooltip and accessible name ("Back to Vršek 2026",
  "Back to search results", "Back home"; Czech "Zpět: …", because the preposition would change
  with the noun). Back from a song returns to the page it was opened from; search results keep
  their query. (2026-11-09)
- **D32. Leaving a playlist doesn't end it.** While a playlist is being played, a pill at the
  bottom of other pages leads back to the current song, until closed. (2026-11-09)
- **D33. Playlists sort by when they were last played** on this device. (2026-11-09) _Playlists made or joined count as recent: D111._
- **D34. In a playlist, previous/next** are a bar at the bottom, swipe, arrow keys, and Page
  Up/Down (a page-turner pedal: scroll, and at the end of the song, turn the page). (2026-11-09)
- **D35. The overview focuses the search box only with a fine pointer.** On a phone, focusing
  would throw the keyboard over the playlists the player may have come for. The search icon
  (D30) focuses it everywhere: there, searching was asked for. (2026-11-09)

## Revisions (2026-11-09, second round)

- **D50. The search icon opens a search overlay** over the current page, finding songs and
  playlists (playlists first). Closing it leaves you exactly where you were; a result's back
  arrow returns there. Replaces D30's "opens the overview": the icon's place (last at top right,
  past a divider) stands. `/` opens it anywhere but the overview, whose own box takes it.
- **D51. A "Display" popover** (sliders icon) holds text size, two columns and chord diagrams:
  everything a reader tunes, in one place. Replaces D22's text-size popover and moves D23's
  diagrams switch out of the ⋯ menu. The two-columns switch ("Dva sloupce na širokém displeji")
  shows only on screens wide enough for columns, per device, on by default (D25).
- **D52. The key control is compact and carries a treble clef** (`− 𝄞 A +`), so it reads as
  the key at a glance. _The key itself is no longer a reset button: D89._
- **D53. Settings (language, theme) live behind a cogwheel** on the overview, in a dialog. Not on
  the account page, not at the foot of the overview.
- **D54. Every page header: page actions, a divider, search.** No ⋯ menu on the playlist page:
  pencil (edit) and trash directly.
- **D55. Playlists are reordered by drag and drop**, by a grip handle (touch and keyboard).
- **D56. One page column (48rem) for every page but the song view.** The overview's sections have
  bold headings on a rule, with more space between sections.
- **D57. Back returns to the page that linked in** wherever a page is reachable from several
  places (the queue from the overview or the account; a song from anywhere), and says so.
- **D58. Full screen: a toolbar button on wide screens, a ⋯ menu item on phones.** Never both.

- **D59. No key line under the artist.** The toolbar shows the key and changes it; the line
  repeated it. A capo, which the toolbar doesn't show, keeps its line.

- **D60. The back arrow goes one level up, to a fixed parent; the browser's back is history.**
  Replaces D57 and D31's "back returns to the page it was opened from", which made the arrow a
  second browser-back whose destination you couldn't predict (song → search → song → ← went to
  the first song). Parents: a song in a playlist being played → the playlist; any other song →
  the overview, keeping the search it was found by; playlist → playlists; playlists, account,
  queue, new song → overview; review → queue; users → account; edit song → the song. Context
  survives where it's built for it: the playlist pill (D32), the overview's query, the search
  overlay (D50). The queue has one entry, the overview's checklist icon. The tooltip still says
  where the arrow goes. (2026-11-09)

- **D61. One orange.** Filled orange is the primary action (the only one on a page is
  primary too); secondary actions are the neutral outline; destructive secondaries the red
  outline. No light (tinted) orange anywhere: in dark mode it turns rust brown, reads as an
  error and clashes with the filled orange. Alerts take the colour of their meaning (green
  success, yellow warning, red error) and default to neutral grey; badges are neutral unless
  they mean something. (2026-11-09) _Its shade: D103._

- **D62. Editors approve: "Schválit" / "Approve"**, not "Ověřit", which reads like sending a
  song off to be verified. (Superseded in part by D83: the badge says "Neschváleno" too.)
  The review's actions sit together bottom right, primary last (Zamítnout · Uložit · Schválit),
  in a bar that stays on screen. (2026-11-09)
- **D63. The queue icon shows how many songs wait**, counted from the device's catalog (no
  request; right offline). (2026-11-09)

- **D64. Picking songs for a playlist is a checklist.** Each result is in the playlist or not
  (✓ or +). ↑ ↓ move the highlight (the first result is highlighted as you type), Enter
  toggles: adding and removing are symmetric, and a second Enter undoes the first. Removing
  takes out the song's last appearance. Space stays a space in the search box (searches have
  several words); on the list, reached by Tab, Space toggles. After a toggle the search text is
  selected, so typing starts the next search and the arrows carry on: the same whatever the
  number of results. (2026-11-09)
- **D65 (replaced by D70).** ~~Playlists page: "Moje" and "Od ostatních"~~ when signed in (your public playlists are
  yours, marked with a globe, not repeated under the public ones); "Veřejné playlisty" signed
  out. (2026-11-09)
- **D66. Outline buttons use their colour's text shade** (scheme-aware): Mantine's dark-mode
  outline is the palest shade, so a red outline read as white. (2026-11-09)

- **D67. Addresses say what they are, id first:** `/song/2-lajla-tov-…`, `/playlist/1-vrsek`,
  `/playlist/1-vrsek/2`. The id is what the app looks up; the slug is for people reading a
  shared link. Slugs aren't unique and don't need to be: two playlists called "Vánoce" are
  `/playlist/4-vanoce` and `/playlist/9-vanoce`, not `vanoce-2`. A renamed playlist's old links
  keep working, and a bare or stale address is corrected in place. Pure unique slugs were
  considered and rejected: they need site-wide uniqueness and break, or need remembering, on
  every rename. (2026-11-09)

- **D68. Playlists are collaborative.** The owner shares an invite link; whoever opens it
  signed in joins as a collaborator (no user search: it would reveal who has an account). The
  owner sees who joined, removes people, and can replace the link (the old one stops; joined
  people stay). Collaborators add, remove, reorder and rename; only the owner deletes, changes
  visibility and manages people. Collaborators can leave. Joining needs an account, editing a
  confirmed email. The invite token never syncs to collaborators' devices. (2026-11-09)
- **D69. Edits are operations, not whole lists** (add / remove / move, naming their song), applied
  by the server to the playlist as it is now, under a row lock: two people editing at once both
  keep their change. The device shows each change at once with the same code. Updates from
  others arrive as D72 says. The player stays on the song being played
  when the list changes under it; a song taken out stays on screen, flagged, and next is the
  song that followed it. (2026-11-09)
- **D70. Playlists page: one list, most recently played first,** as a table (playlist · role ·
  visibility, "sdíleno (n)") where it fits and rows with the same facts on a phone. Role is
  Vlastník / Spolupracovník, or "od {name}" for someone else's public playlist. (2026-11-09)
- **D71. `next` survives signing up:** an invite link sends a signed-out visitor to log in or
  sign up with `next`; sign-up returns there at once, and the confirmation email's link carries
  `next` too. Only paths inside the app are followed. (2026-11-09)

- **D72. No polling.** A playlist page loads its playlist fresh once, when it opens; nothing
  refreshes on a timer or on returning to the app. Polling every 30 s was ~1,000 requests in a
  two-hour session on four tablets, for nothing most of the time, and still too slow for
  editing together. Bring live updates back only if a real need shows, and then as something
  fast (push), not a faster timer. The catalog sync is D74. Replaces D69's 30 s refresh. (2026-11-09)
- **D73. A table row is one target.** The whole row opens the playlist; the title stays the one
  link, for keyboards. (2026-11-09)

- **D74. The catalog syncs when the app starts and when someone signs in or out**, nothing
  else: no timer, no sync on returning to the app. To see what others changed, there's a refresh
  button (↻, "Načíst novinky") at top right on the overview and on every playlist page, for
  anyone who can see it; on a playlist it fetches that playlist and the catalog. It works the
  same in an app installed to the home screen, which has no reload (no ⌘R, no pull-to-refresh),
  and keeps the reader where they are. Offline, it is greyed out. (2026-11-09)

- **D75. New app versions:** a device checks when the app starts and reloads itself onto a new
  version once installed. The refresh button (D74) asks too, so a tablet left open for days
  updates when someone taps ↻, and the reload comes when it was asked for. Verified on a local
  production build: ↻ moved an open page from one version to the next. (2026-11-09)

- **D76 (replaced by D77).** ~~A rejected song is hidden, not deleted~~, in playlists too: to everyone but its author
  it isn't in the list, the count or the player (numbers close up: 1 → 2 → 3, no gaps). It stays
  in the playlist's data, in its place, and comes back there once fixed and approved. Its author
  sees it, marked rejected. The server leaves hidden songs out of the playlist it sends, and
  applies a person's edits to the list as they see it, keeping hidden songs after the song they
  followed. The device's catalog hands out playlists of playable songs only, so the count, list
  and player always agree. No "a song is hidden" note for others (the owner's call). Removing a
  rejected song from every playlist was rejected: it would rewrite others' setlists for good.
  (2026-11-09)

- **D77. Rejected means "out of search, marked everywhere else".** A rejected song can't be
  found (search, the song lists, adding to a playlist) except by its author, who has to fix it.
  It stays in every playlist, in its place, counted and playable, marked "Zamítnuto" in the list
  and in the song view; anyone can open it by its link. The reason is for the author and
  editors; others see that it waits to be fixed. Nobody's playlist changes. Replaces D2's
  "leaves the catalog" and D76. (2026-11-09)
- **D78. Deleting a song is real and final:** the row, its place in every playlist, and every
  device's copy (through `song_deletions` on the next sync). Editors delete any song; an author
  their own until it is approved. The one change to others' playlists that isn't theirs, so the
  confirmation says how many playlists lose the song. In the song's ⋯ menu and on the review
  screen. (2026-11-09)

- **D79. Playlist details by who's looking.** Search results and the overview show a playlist
  briefly: its songs and whose it is ("3 písničky · od Tadeáš"), or the viewer's own role. The
  playlists page adds visibility, and for the playlist's own people how many souputníci it has;
  the server sends that count to nobody else. Replaces D70's "shared (n)". (2026-11-09) _"od {name}" became "Vlastník: {name}": D111._ _Playlists are grouped by whose, and someone else's names the owner alone: D112._
- **D80. Collaborators are souputníci** (listmates in English, made up on purpose: "bandmate"
  would claim band membership): a songbook with attitude, not an
  office. The role is Souputník / Listmate, the people dialog is Souputníci / Listmates, and an invite reads
  "{owner} tě zve, ať se přidáš k playlistu". (2026-11-09) _The dialog is "Sdílení" now, with "Souputníci" a section in it: D111._

- **D81. Changing a rejected song sends it back for review**, whoever changes it, an editor or
  admin too (their own song included): the rejection was of the old text. Edits keep a pending
  or verified song's status. (2026-11-09)
- **D82. A song's state sits at the top of the song, in two strengths:** not yet approved is a
  quiet one-line grey banner; rejected is a red banner (the reason for its author and editors,
  "waiting to be fixed" for others). It used to be a line at the foot of the song. (2026-11-09)
- **D83. One verb: schválit / approve.** The banner says "Tuhle písničku zatím nikdo neschválil",
  the badge "Neschváleno" / "Not approved", the opposite "Schváleno" / "Approved", matching the
  editor's "Schválit" (D62). Subtle buttons hover neutral, never in tinted orange (D61): the
  overview's Log in button is the neutral outline, like the icons around it. (2026-11-09)

- **D84. Display: chords on, diagrams off by default.** A Chords switch (Akordy) hides the
  chords to sing along: chord rows go, and sections with nothing to sing (an intro) go whole.
  Diagrams are off by default, for the few who need an unusual voicing, and can't be on while
  chords are hidden or transposed. (2026-11-09)
- **D85. Small consistencies:** a song's status banner is as wide as the song; a dialog's title
  is a real heading (set once in the theme); "Nahlásit chybu" shows only to people who can't
  edit the song themselves; delete asks "Opravdu chceš smazat …? Nejde to vzít zpátky."
  (2026-11-09) _"Nahlásit chybu" writes a report in the app now, not an email: D143._

- **D86. Every song keeps its versions** (replaces D5), recorded quietly before anyone uses the
  app, so credits, suggested changes and rollback can be built on them later
  (`.planning/ongoing/song-history-credits-suggestions.md`). A version is the text as stored,
  with its title, artist, who saved it and when, and a kind: `create`, `edit` (a save that
  changes the text; one that doesn't records nothing, so opening and saving earns no credit) or
  `approve` (every approval, edited or not: it pins the approved text and who approved it).
  Rejecting changes no text and records none. Versions go with a deleted song (D78) and stay
  when their author's account goes. Songs from before had one `create` version backfilled from
  their current text, dated and credited as when they were added; the seed's songs have no
  author, so neither do their versions. All are kept: a song is a few kB. (2026-11-10)
- **D87. Taking someone out of a playlist is one tap, undone by one tap.** The owner's × removes
  the listmate at once; a toast at the bottom (at the top it would cover the dialog) says
  "{name} už v playlistu není" with "Beru zpátky" for 8 seconds. Undo puts them back as they
  were (their join date too). The server keeps every removal (`playlist_collaborator_removals`)
  and restores only someone this playlist's owner removed in the last 10 minutes, so undo can't
  add anyone else. No confirmation dialog: an undo costs the rare mistake a tap instead of every
  removal. (2026-11-10) _Deleting a note the same way: D139._ _Every toast at the bottom: D147._

From the first UX walk of the song view and a playlist session (2026-11-10): _In the dialog the removed row offers the undo; the toast after it closes: D111._

- **D88. Two columns only when the song can be read whole in them** (narrows D25). On a wide
  screen a song is laid out in columns only if, with the song's top at the top of
  the screen, no text runs past the bottom or under a bar fixed there (the playlist bar, or the
  pill: a line may end beside the pill). The title, artist and toolbar don't count: they scroll
  and slide away. Otherwise columns would send the reader back up mid-song for the second one.
  It's measured on the text of a hidden copy in columns, so smaller text, a taller window, full
  screen, hidden chords or closing the pill can bring the columns on, and larger text takes
  them off. The switch says so: "Jen pokud se celá písnička vejde na obrazovku. Pokud je to o fous, zkus
  zmenšit písmo!"
  If this keeps surprising people, the fallback is a plain switch. (2026-11-10)
- **D89. The key shows whether the song is transposed, and is the way back.** In the song's
  own key, the key between − and + is a plain label: a tap does nothing (it used to reset
  silently). Transposed, a remembered transposition too (D24), it is a filled orange button,
  the one filled thing in the toolbar: a tap goes back to the song's key, and its tooltip names
  it ("Zpět na A"). Tried and dropped the same day: an offset beside the key ("Bm −3", busy and
  wider), an orange edge on the pill (too easy to miss), reset only in the ⋯ menu (nobody finds
  it there). The control is squared off (a small radius, not a pill) with room around the key,
  so the filled key reads as a key, not a blob. Hidden chords show as a dot on the Display icon; a disabled diagrams switch says
  why ("Jen se zapnutými akordy" / "Jen v původní tónině"). (2026-11-10)
- **D90. Keys belong to what's open.** Esc and the arrows act on the song only when no menu,
  popover or dialog has them: Esc in the ⋯ menu closes the menu and stays on the song.
  (2026-11-10)
- **D91. A wrapped lyric line hangs indented,** so on a phone its leftover words don't read as
  the song's next line. (2026-11-10)
- **D92. The playlist page shows where the player is:** the current song has an orange edge and
  number, and Hrát reads "Pokračovat" when it carries on mid-playlist. The pill's close button is
  full size. (2026-11-10)
- **D93. A tap on the song hides the toolbar, or brings it back,** for when things get tight,
  like an e-book reader. Scrolling still hides and shows it as before, and takes over again
  after a tap. No button for it: the phone toolbar has no room. A tap on a link or button, the
  end of a text selection, or a swipe to the next song doesn't count. (2026-11-10) _The playlist bar goes with it: D109._
- **D94. Chords above the lyrics are converted, on offer.** Text pasted from chord sites puts
  chords on a line of their own; the editor spots such lines and offers "Převést do ChordPro?".
  Converting puts each chord inside the line below at its column, turns `[Verse 1]`, `Refrén:`,
  `R:`, `2.` into sections, `Capo 2` into `{capo: 2}`, and a heading of one or two lines into
  title and artist. It is typed in like a paste, so undo takes it back; "Nechat" keeps the text
  as it is. In the shared editor, so new, edit and review all have it (D4 stands: still
  ChordPro). (2026-11-10)
- **D95. Unsaved ChordPro is a draft on the device,** one per page and song, kept as it is
  typed: the back arrow, search, a reload or a flat battery don't lose it, and the page says
  "Neuložené úpravy z minula" with a way to throw them away. Saved, approved or rejected, the
  draft is gone. No "leave the page?" prompt: the draft covers more. Rejecting warns that the
  editor's own unsaved edits go with it. (2026-11-10)
- **D96. The review queue goes forward.** After approving, rejecting or skipping (⏭ beside
  "2 / 4"), the song that followed opens, wrapping round at the end; a skipped song comes back
  only after the rest. Toasts name the song ("Schváleno: Koleda"). The review screen says who
  added the song and when. (2026-11-10)
- **D97. A rejected song shows how to fix it:** an "Opravit" button in its red banner for whoever
  may fix it, the banner again above the editor, and the button there says "Uložit a poslat ke
  kontrole" (D81). For "jiný důvod" the editor's note is the reason. (2026-11-10)
- **D98. The editor around the text.** Parser warnings are codes the editor translates
  ("Řádek 9: {foo} tu neumíme…"), and each leads to its line. A missing title stops the save
  and puts the caret in `{title: }`, rather than a server error; the untouched template isn't
  warned about. The buttons sit in a bar that stays on screen. The cheat sheet is four examples,
  each with what it does. A search that finds nothing offers "Přidat „…“ jako novou písničku",
  started with that title; from a playlist's song picker the new song goes into the playlist
  too. `/new` waits to know who is signed in before sending anyone to log in. (2026-11-10)
- **D99. Side by side, the editor's panes are as tall as the window** and scroll on their own;
  the preview shows the section the caret is in, moving only when it is out of sight. On a
  phone, unchanged: one at a time, and the page scrolls. (2026-11-10)
- **D100. An author hears about a rejection by email,** once, in their language: why (for
  "jiný důvod", the note), and a link to fix it. Nothing on approval. Not to an editor
  rejecting their own song. A mail that fails is logged; the rejection stands. (2026-11-10)
- **D101. No rejection reason is preselected,** and "jiný důvod" needs a note, checked on the
  server too: a reason nobody chose, or "other" with nothing said, tells the author nothing.
  No "not ChordPro" reason: the converter (D94) covers that. (2026-11-10)
- **D102. A rejection is a version** (kind `reject`, with its reason and note; extends D86). The
  song forgets it once fixed (D81); its history doesn't. So the queue says "opraveno po
  zamítnutí" and the review screen shows what was asked last time. Queue rows and the review
  screen also name the playlists a song is in, from the editor's catalog. (2026-11-10)
- **D103. The brand orange passes AA** (D61 stands; this is its shade). One palette in `theme.ts`, built
  round #C2410C: buttons are filled with it in both schemes (white on it 5.2:1; Mantine's
  orange was 3.6:1 light, 2.2:1 dark). As text it is `--brand-text`, a lighter shade on dark;
  chords use it too. In one place so it can change, or become a setting: in the owner's
  words, "I'm in no way attached to the colours at this point". The app icons keep their old
  orange until they are redrawn. On `/join`, sign-up is the primary button: someone opening
  an invite is most likely new. (2026-11-10)
- **D104. One rule for who may change a song, shared** (`canChangeSong` in `src/shared/songs.ts`):
  the server's update and delete and the client's edit and delete buttons ask the same function.
  Saves lock the song's row and decide on it inside their transaction, so two saves take turns.
  (2026-11-10)
- **D105. Theme first, then one small component.** Defaults that hold everywhere live in the
  theme (`ActionIcon` subtle and grey, `Badge` neutral, `Alert` grey and light); what a theme
  can't do gets one shared component (`IconButton`: an icon with its tooltip and name;
  `ConfirmModal`; `SongLabel`; `PageLoader`), never a copy per page. Breakpoints are the
  theme's (`useWide`, `usePhone`, `$mantine-breakpoint-*`). (2026-11-10)
- **D108. Columns are the reader's, for any song** (replaces D25's "when the song asks").
  How many columns is presentation: it depends on the screen and the reader, not the song, and
  the fit check (D88) already decides better than a line in the source. Every song on a wide
  screen goes into two columns when it fits and the reader has them on (the switch is always in
  Display). `{columns: n}` is accepted and ignored; `{column_break}` stays, as the author's word
  on where a song splits well. (2026-11-10) _`{column_break}` goes too, with the rest of a printed page: D150._
- **D109. The playlist bar goes away with the toolbar,** on the same tap or scroll (D93), for
  just the song: swipes and the arrow keys still go to the previous and next song. Out of the
  way it no longer counts against two columns (D88): the check runs again once a bar has slid,
  so a song that fits without the bar goes into columns, and back to one when the bar returns.
  The page keeps its bottom padding, so hiding never shortens it mid-scroll. (2026-11-11)
- **D110. Playlists and sharing, from the third walk.** Any member, a confirmed email or not,
  opens Souputníci to see who's in and to leave (with D68); the unconfirmed are told why they
  can't edit, with a resend button right there (`VerifyEmailAlert`). Someone taken out of a
  playlist leaves its editor. A new invite link asks first and then says the old one is dead.
  The way back to the playlist being played floats on the playlists page and other playlists'
  pages too (D32). Rename saves on Enter; an emptied name comes back. Joining and leaving say so.
  Deleting says what goes (listmates lose it) and what stays. Every dialog's and toast's close
  button is named, and moving a song is announced, in the reader's language. (2026-11-11)
- **D111. Sharing in one place, and one tap back for songs too** (the owner's picks from the
  third walk). The dialog is **Sdílení**: the owner first sets **Kdo ho vidí** (the public
  switch, moved out of the editor, and when public a link just to look), then **Souputníci**
  (the invite link, the people). Links go out through the phone's share sheet where there is
  one, else a copy. A public playlist's invite page also offers "Jen se podívat". A listmate
  removed while the dialog is open stays as a greyed row with "Beru zpátky" (the keyboard can
  reach it there); closing the dialog hands the undo to a toast. Removing a song shows "… je z
  playlistu pryč · Beru zpátky" and undoing puts it back in its place (`add` takes `at`).
  "Přidat písničky" is under the list whenever the viewer may add. On a phone a playlist's name
  is the page's first line, not squeezed into the header. A playlist made or joined on this
  device is among the recent ones on the overview. The owner is "Vlastník: {name}".
  (2026-11-11)
- **D112. Playlists are listed by whose they are,** not in a table: **Moje**, **Sdílené se
  mnou**, **Veřejné** (empty ones left out), the most recent first in each. Under the name: the
  songs; for someone else's, the owner's name alone (as an artist under a song); for one's own,
  the listmates when there are any. Public is a small globe; private, the normal case, is
  unmarked. The same line wherever a playlist shows (`playlistFacts`). (2026-11-11)
- **D113. One settings panel, everywhere; sharing in boxes; the account in tabs.** The sliders
  icon beside search on every page opens every setting on this device: how songs are shown
  (size, chords, columns, diagrams), full screen as a switch (so it says whether it's on; the
  separate icon left the song toolbar), and language and look. The sharing dialog sets who sees
  the playlist with Soukromý | Veřejný, then gives each link a box saying what it gives: an eye
  for "Odkaz na prohlížení", a pencil for "Pozvánka pro souputníky", under the listmates; the
  link shows small, so a new one visibly replaces the old. The account page puts log out beside
  the name; admins get tabs, "Moje písničky" and "Uživatelé" (the old users page; its address
  redirects there). (2026-11-11) _Everyone gets tabs, notes among them: D139._
- **D114. The sharing dialog, plainer** (refines D111, D113). Titled with the playlist
  ("Sdílení playlistu „…“"). Each link is a read-only field named by what it gives (an eye:
  "Odkaz na prohlížení"; a pencil: "Odkaz pro souputníky"), with a copy button inside it; no
  share sheet. "Souputníci" is a heading with a sentence under it, then the people, then what
  the invite does and its field, where a second icon makes a new link. That asks first, in a
  small popover on the button, rather than offering an undo: the old link is dead for everyone
  it was sent to, and taking it back would need the server to keep it. (2026-11-11)
- **D115. The sharing dialog, settled; listmates are "parťáci" in Czech** (refines D114, D80).
  "Viditelnost" first: Soukromý | Veřejný, each saying what it means inside the switch ("Vidí
  ho jen parťáci" / "Vidí ho kdokoliv i bez přihlášení"); a listmate sees it too, read-only.
  Under it, always, "Odkaz na playlist" (private, it still takes parťáci straight in). Then
  "Parťáci" with its sentence, the people in one box on one line each (only the owner marked),
  and "Odkaz pro parťáky" with what it does between its name and the field. "Souputník" read
  stiff; English keeps "listmate". Every dialog's header is tinted and ruled, in the theme.
  Elsewhere: full screen is an app setting, not a song one; a new song's untouched example
  says a song can just be pasted (and clears it); roles use the device's own picker; home shows
  3 recent songs and 3 recent playlists. Czech copy says "kdokoliv". (2026-11-12)
- **D116. "Načíst novinky" is in the settings, on every page** (refines D74). A full button at
  the bottom of the popover, which also gets the playlist being played; the song view in an
  installed app has no reload otherwise. The icon stays only on a playlist's page, where a
  bandmate's change matters most and one tap beats two; home loses it. (2026-11-12)
- **D117. "Načíst novinky" only in the settings; users listed by rank** (refines D116, D113). The
  icon on a playlist's page goes too: one place for it, and the toolbar stays for the playlist's
  own actions. The settings fetch the playlist on the page as well as the one being played. The
  admin's list of users: the viewer first, then admins, editors, users, each by name (the id
  breaks ties, so the order never shuffles). Changing a role moves the row, on purpose: the list
  shows who holds which rank. (2026-11-12)
- **D118. Tags find songs** (replaces D6; for the Christmas carols). A tag is a `{tag: …}` line
  in the song's text, the only truth (D4), so whoever may edit a song tags it (D3) and the
  device reads tags from the source it already has: no column, no API, offline. One tag is every
  spelling with the same slug ("Vánoční", "vanocni"), shown as most songs spell it; the editor's
  tags field suggests the catalog's tags and writes a known one its way, so the list doesn't
  split. Tags are free, not a list someone manages, and never translated (like lyrics, D10).
  Search matches them (a row per matching tag, and the tag a song was found by); a tag's page
  (`/tag/vanocni`) lists its songs A–Z, and a song opened there goes back to it, as one opened
  from search results does (D60). Tags show as chips on home and in the song's ⋯ menu, never on
  the sheet (D20). (2026-11-22) _Kept in the text after a look at every directive, and what a tag is for: D150._
- **D119. A transposed key can become the song's own.** Whoever may edit the song (D78) finds
  "Uložit v tónině {key}" in the ⋯ menu while it's transposed: the text is rewritten in that key
  (chords and `{key}`, in the song's notation; tabs as written; `{define}` diagrams dropped, the
  dialog says so) and saved as an ordinary edit, a version (D86) checked against `seenAt` (D106).
  A transposition kept on a device remembers the pitch the song started from (its key, or its
  first chord), so after such a save every device still plays it where its player put it. Not
  a key per playlist: a third layer of keys, for a need not yet seen. (2026-11-23)
- **D120. Tags stand beside the artist** (refines D118). Under a song's title, in every list and
  on the sheet: "Lucie Bílá | Pohádky", or the tags alone for a song with no artist. A category
  is a tag, never an artist: "Koledy" and "Písničky z pohádek" became tags and left the artist
  field. Search results no longer name the tag that found a song; the line under it does.
  (2026-11-23)
- **D121. From an unchecked song straight to its review.** An editor sees "Zkontrolovat" in the
  quiet "nobody has approved this song yet" line (D82) and lands on the song's review screen, not
  the queue to find it in. Everyone else sees the line alone. (2026-11-23)
- **D122. Every chorus is labelled "Refrén"**, the first as much as a repeat (`{chorus}`), unless
  the song names it itself. Only repeats used to say so, and the first chorus had the bar alone,
  which doesn't explain itself. (2026-11-23)
- **D123. A review opened from the song returns to the song** (refines D121, D60). Approving or
  rejecting goes back to it, not on to the next song in the queue, and the back arrow says
  "Zpět: {title}". There is no skip: that walks the queue. From the queue, nothing changes.
  (2026-11-23)
- **D124. Adding to a playlist is a checkbox per playlist.** Ticked: the song is in it; a tap
  switches it in (at the end) or out (its last appearance, as the playlist's own picker does,
  `toggleOp`), and the dialog stays open. A new playlist with the song still closes it, with a
  toast. Before, tapping a playlist that had the song added it a second time. (2026-11-23)
- **D125. A shared link says what it leads to.** Link previews (WhatsApp, Messenger) don't run
  the app, so the server writes the page into the shell's `og:title` and `og:description`
  (`pages.ts`): an invite ("Pozvánka do playlistu „Vánoce“", who invites), a song (title ·
  artist), a playlist (name, owner, how many songs), a song in a playlist (its title, its place).
  A previewer is signed out, so pages load as nobody through the app's own rules: a private
  playlist, or a song inside one, keeps the app's own preview. An invite is the permission
  itself, so it shows what the join page shows. Czech, the shell's language: a previewer brings
  no reader to choose another. Names never follow a preposition (Czech would decline them). The
  tab title stays the app's. Development serves pages the same way (Vite in `custom` mode).
  (2026-11-23)
- **D126. Someone in a playlist edits it or only reads it.** Three roles: the owner, **Může
  upravovat** (collaborator: the songs and the name, as before) and **Jen čte** (viewer: sees
  it, private too, sees who else is in it, may leave). Phrases, not nouns, so nobody needs the
  app's lingo; "parťáci" are everyone in it. Two invite links, **Odkaz pro úpravy** (the old
  link, so links already sent do what they did) and **Odkaz pro čtení**, each replaced on its
  own; the join page says which. A link never takes editing away; a link to edit makes a reader
  a collaborator. The owner changes anyone's role in Sdílení (the device's own picker), and an
  undone removal puts the person back in their role. In code `collaborator`/`viewer`, not
  "editor", which is a role in the whole songbook. First phase of
  `.planning/done/private-songs-and-roles.md`. (2026-11-23)
- **D127. A song can be private.** Public stays the default; on a new song, "Soukromá, jen pro
  mě" keeps it the author's own. A private song is outside the songbook: never reviewed (its
  status is `private`, so it can't also be approved), and it doesn't exist (NOT_FOUND) for
  anyone it isn't shared with, the songbook's editors and admins included. It is shared as a
  playlist is (D126): two invite links, Může upravovat / Jen čte, the same dialog (`sharing`
  router, `SharePeople`); its owner alone deletes it and manages its people. Making it public
  is publishing, asked first: it goes to the editors as pending. Back to private only while
  nobody else has a stake in it: every version its owner's (no one else edited, approved or
  rejected it) and in no one else's playlist; otherwise the dialog says why. Devices get every
  readable private song on every sync and drop one no longer sent; a song gone private leaves
  other devices (`song_withdrawals`); a private song's id never goes out in `song_deletions`.
  Until a playlist shares its songs (phase 3), a private song goes only into a private playlist
  whose people can all read it already. Lists mark it with a lock. Phase 2 of
  `.planning/done/private-songs-and-roles.md`. (2026-11-23)
- **D128. A playlist shares its private songs with its people.** Everyone in a playlist, a
  reader too, reads every private song in it, for as long as they are in it and the song is;
  worked out from the memberships as they are, never copied. Reading only: it gives no role in
  the song (no edits, no say in its people). Only the song's owner puts it where it reaches
  someone new; anyone else who reads it may add it only where everyone in the playlist already
  can. Outside a playlist (a public one's visitors), a private song in it isn't shown at all,
  not as a placeholder: the playlist's songs are only those the viewer may read, so nobody
  learns one is there (the plan's placeholder, dropped). Replaces D127's stopgap (only into a
  private playlist whose people all read it). Who may read a private song is written once
  (`READABLE_PRIVATE_SONG_IDS`), from the viewer's side: their own, those shared with them,
  those in their playlists. The sync reads changed public songs by `updated_at` and the
  viewer's private songs from that set, two indexed reads rather than one pass over every
  song. Phase 3 of `.planning/done/private-songs-and-roles.md`. (2026-11-23) _Narrowed the same day, after review: a playlist shares a private song only while the
  song's owner is in it, so someone who merely reads it can't pass it on through a playlist of
  their own; an owner who leaves takes their songs with them. Before a private song goes in,
  its owner is told who else will read it ("Uvidí ji i 2 parťáci"); on a public playlist its
  people see "Návštěvníci ji nevidí" under it. Each link in Sdílení says what it does: the
  link to read finds the playlist among one's own with its private songs, the plain link
  doesn't (D126)._ _Explained 2026-11-24: the song's Sdílení lists the playlists it is in, with
  who is in each, under the rule in one sentence (read, not change; later joiners too; while
  the song and its owner are in it); the line under a playlist names later joiners, so it
  shows even in a playlist with nobody else in it yet._
- **D129. Columns are decided by the text, not the screen** (replaces D25's "≥ 62em"). Two
  columns whenever no line has to wrap in its column at the current text size and the whole
  song fits on screen (D88), measured on the hidden copy; on any screen, so a tablet held upright
  gets them for a song that fits, a phone almost never does, and bigger text turns them off by
  itself. From the first rehearsal (`.planning/ongoing/after-the-first-rehearsal.md`).
  (2026-11-24) _The bars count where they're shown, slid away or not: D136._
- **D130. A pinch changes the text size** on the song, live, along the same steps as the size
  buttons (snapping), and keeps it. The page itself doesn't zoom there (`touch-action: pan-x
pan-y`, and Safari's own gesture stopped): the text reflows instead of spilling sideways. One
  finger still scrolls and swipes between songs. (2026-11-24) _And the reader keeps their place: through a pinch the line under the fingers,
  through the size buttons the line at the top, stays where it was, columns coming or going
  included; that scroll doesn't hide the toolbar._ _A laptop's touchpad too, and down to 60%: D137._
- **D131. A playlist can play a song in its own key.** The playlist's key is everyone's
  starting point there (its people's and a public one's visitors'); a player's own
  transposition shifts from it, on their device only, the same shift in and out of playlists.
  Kept per playlist and song (`playlist_song_keys`), not per place, as semitones from the
  pitch the song started from, so a key later saved for everyone (D119) keeps the playlist
  sounding the same; it leaves with the song. Whoever may edit the playlist sets it, from the
  song, in the ⋯ menu under a heading naming the key ("Tónina G"): "Hrát takhle v tomhle
  playlistu", or back with "V playlistu hrát v tónině písničky"; "Uložit pro všechny" (D119)
  says for whom. The way back on the
  key goes to the playlist's key. Setting the playlist's key from a song takes up the
  player's own transposition of it, which is one per song on a device, in the playlist and out
  of it (open for the owner: a separate own shift per playlist). The playlist's list says
  "Hraje se v tónině G". No per-user key
  across devices: per device is enough for now. (2026-11-24)
- **D132. Chord diagrams for every chord, on guitar or ukulele; chords in the reader's
  notation.** Diagrams come from a chord library (chords-db, MIT, boiled down by
  `scripts/chord-shapes.ts` into `chordShapes.ts`, one shape per chord), so every chord a song
  plays gets one, transposed too, on the instrument chosen in Display (Kytara / Ukulele). A
  song's own `{define}` still wins for guitar in its own key. A chord the library doesn't know
  says "bez diagramu" in its place rather than going missing or getting a wrong shape. Narrows
  D84: diagrams no longer need the original key. Chords are **shown** in the reader's
  notation, "Značení akordů" in Display: H and B (Czech, the default in Czech) or B and Bb
  (English, the default in English); each song's text keeps its own, and transposition,
  diagrams and the keys named everywhere follow the reader's. The owner's call was "go with H
  for Czech players"; showing rather than rewriting every song also gets a transposed song
  right (C up a tone is H). (2026-11-24)
- **D133. A key the playlist plays in is marked, and a change made offline says it waits.** The
  owner's calls after the night's build (2026-11-25). In a playlist with its own key for a song,
  the key control shows the playlist's mark in place of the clef ("Tónina playlistu"). The key's
  actions sit in the ⋯ menu under one heading that names the key. Messages (toasts) appear below
  the header, never over it: one about the key mustn't cover the key. A change that waits for
  the connection (a playlist edit, its key; requests wait offline since the offline check) says
  so: "Jsi offline: uloží se, až budeš online" (`notifyIfQueued`, the way for every such change
  from now on). Notation stays as built (D132): songs written in English notation, shown in
  Czech where that's the reader's. Each playlist keeps its own key for a song, and setting it
  uses up the player's own transposition (D131), as is. (2026-11-25) _Offline changes wait in
  memory only, lost if the app closes: D148._
- **D134. Fewer settings: notation by language, columns always.** Chords are shown with H
  and B in Czech and with B and Bb in English, by the app's language alone (narrows D132: the
  "Značení akordů" setting goes; it comes back if someone needs it). Two columns are no longer
  a switch (replaces D108's "the reader has them on"): wherever they fit (D129), a song is in
  them, and where they don't, it isn't. (2026-11-25)
- **D135. Notes on songs, one's own or a playlist's.** A note is separate from the song's text,
  at a line (its place and words) or on the whole song. One's own note is its author's alone
  and may be a TODO (the same word in both languages), marked done and kept until deleted. A
  playlist's note is for everyone who sees the playlist (its people, and a public one's
  visitors), never a TODO, added, changed and deleted by whoever may edit the playlist. A note
  goes with its song; a playlist's notes go with the playlist, and hide while their song is out
  of it. Nobody sees a note on a song they can't read (a private song's, D126). (2026-11-25) _The UX walk's calls (by song, offline at once, done off the song, small edits): D138. Louder on the song, a tab, changed in the list: D139. Reports for the editors: D143._
- **D136. The bars count where they are shown, slid away or not** (narrows D129). Whether a song
  fits in columns is decided with the bars at the bottom in place (the playlist's bar, the
  pill), so the song doesn't rearrange itself as a scroll hides them (D109). Songs that would
  fit only with the bars away stay in one column: the owner's call, a layout that never moves
  on its own over a few more songs in columns. (2026-11-25)
- **D137. Text down to 60%, and a touchpad pinches like a finger** (extends D130). The text
  sizes start at 60% (two steps below 80%), for a long song whole or a tablet read from
  further away. On a laptop, a touchpad's pinch on the song (a wheel with Ctrl held in Chrome,
  Edge and Firefox; Safari's own gesture) changes the text size instead of zooming the page,
  keeping the line under the pointer; so does Ctrl and a mouse wheel there, a notch about a
  step. Keyboard zoom, and zoom anywhere off the song, stay the browser's. (2026-11-25)
- **D138. Notes after the UX walk** (the owner's calls on D135). Moje poznámky is grouped by
  song (the song with the latest note first), a TODO ticked done there in one tap. A note
  written, changed or deleted offline shows at once, marked "čeká na připojení", in memory only
  until the server has it (a new pattern beside D133's message; other offline changes may follow
  it). A TODO done leaves the song, kept under Hotové. A note stays on its line through a small
  edit of its words (80 % alike: a typo fixed, a comma added); a line rewritten sends it to the
  top as before. (2026-11-25) _Moje poznámky became the account's tab: D139._ _One waiting
  change doesn't hold up the next: D148._
- **D139. Notes are seen, and changed where they're listed** (the owner's calls; refines D113,
  D135, D138). On the song a note is there to be read from a stand: the text's own colour,
  upright, nearly the song's size, on a neutral tint with a rule (never the chords' orange). No
  "important" flag on a note: whoever doesn't want notes in sight switches them off (settings,
  "Poznámky"). Moje poznámky is a tab of the account, for everyone: Písničky | Poznámky |
  Uživatelé (the last for admins), short names so three and the open TODOs' count fit on a
  phone; `/notes` redirects there, its filter kept. In the list a note is changed in place (a
  tap on its text: Enter or leaving the field saves, Shift+Enter is a new line, Escape and an
  emptied field leave it as it was) and deleted with the bin at once, "Beru zpátky" in the
  toast (D87). The delete is sent only when the toast closes without an undo, so the app
  closed meanwhile keeps the note rather than losing it. The song's note dialog deletes the
  same way, without asking first. A confirm stays where a delete is rare, heavy and reaches
  others (a song, a playlist) or can't be undone (leaving a shared one). (2026-11-25)
- **D106. Nobody changes a song they haven't seen as it is.** Saving, approving and rejecting
  send the song's `updatedAt` as the page loaded it (`seenAt`); if the song has changed since,
  the server refuses with "Mezitím ji někdo změnil" (`SONG_CHANGED`). Reloading keeps the typed
  edits (D95) and shows what changed. With the row lock (D104), an editor can't approve or
  reject a fix they never read, and an author can't overwrite an editor's correction.
  (2026-11-10)
- **D107. Paths and rejection reasons are written once, in `src/shared`:** `urls.ts` builds the
  client's links and the server's emailed ones; `rejectionReasons.ts` gives the app and the
  email the same words (they had already drifted). Requests that write are mutations, never
  GETs: the invite link is asked for when the share dialog opens. (2026-11-10)

## Engineering

- **D40. One developer; commit to `main`.** No branches, PRs or release process. (2026-11-09)
- **D41. Postgres on Neon, the app on Cloud Run**, both on personal accounts. The machine's
  default gcloud configuration is work and is never changed. (2026-11-09)
- **D42. Own auth in Express**, not a hosted auth service: users and roles live in our database
  and are testable there. (2026-11-09)
- **D140. The app lives at zpevnak.cz** (the owner's call, 2026-11-26, before the gig). One
  address: emails link there (`PRODUCTION_ORIGIN` in `urls.ts`, read into `APP_URL` by the
  deploy). `zpevnak.tadeaspetak.com` and `www.zpevnak.cz` send a page on to the same page there
  (301, the query and hash kept, `movedTo`); the API, files and service worker still answer at
  the old address, so an installed app updates onto a version that moves itself (`main.tsx`).
  A new address is a new origin: everyone signs in once more there, and the device's copy of
  the catalog is fetched again; an app added to a home screen is added again. Email stays
  from `noreply@zpevnak.tadeaspetak.com` (its Resend domain works; nobody sees it).
- **D141. Zpěvňák offers itself for the home screen** (the owner's call, 2026-11-26). On a
  phone or tablet (a coarse pointer: never a laptop, a touchscreen one included), unless it is
  already open from the home screen: a card on the overview, "Zpěvňák jako aplikace", hidden
  for good on that device once closed, and "Přidat na plochu" in the settings for always.
  Android's browsers that offer it (`beforeinstallprompt`) open their own dialog on a tap; an
  iPhone or iPad, where a page can't, gets the steps through Share. Firefox on Android is left
  out on purpose: it offers no event, and its menu changes. (`useInstall`, `InstallApp.tsx`)
  _Firefox on Android after all: D142._
- **D142. Firefox on Android gets the steps too** (the owner's call, 2026-11-26; refines
  D141, the owner plays from it). Like an iPhone it can't be asked to install, so the steps go
  through its menu: ⋮ (bottom or top right), „Nainstalovat“ or „Přidat na plochu“ (both named:
  its menu has said each in recent versions), confirm.
- **D143. A mistake in a song is reported in the app, as a note for the editors** (the owner's
  calls, 2026-11-26; replaces D85's email; `.planning/done/reports-and-song-comments.md`). A
  note is its author's own, a playlist's, or a **report**: written at a line or on the whole
  song by anyone with a confirmed account, an editor too (a mistake for whoever gets to it, not
  a TODO of one's own), never on a private song. It is seen by its reporter, the songbook's
  editors and the song's author, never by players; marked with a flag. Whoever may change the
  song resolves it ("Vyřešeno", in their own report's dialog too): it leaves the song, and stays
  with its reporter, struck through, to delete. Only its reporter rewrites it, while open. No
  email: the editors find it on the song and in the queue (D144). Signed out, "Nahlásit chybu"
  leads through signing in, back to the report. _After the review and walk: D146._ _An approved
  song's author reads a report: D148. Reported from the line's menu: D149._
- **D144. The editors' queue has a tab per kind of thing waiting** (the owner's call,
  2026-11-26; `.planning/done/reports-and-song-comments.md`): Čeká, Zamítnuté, and Hlášení,
  the open reports (D143) oldest first, each with the song, what, where, who and when, leading
  to its place in the song. The count on the overview's queue icon adds the open reports to the
  songs waiting. Suggested changes, when they come, are one more tab. _Grouped by song: D146._
- **D145. Whoever may change a song writes comments into it from the song view** (the owner's
  call, 2026-11-26; `.planning/done/reports-and-song-comments.md`). The note dialog's "Pro koho"
  offers them "Do písničky (uvidí všichni)": a `{comment: …}` line after the chosen line (after
  the `{chorus}` line in a repeated chorus; at the head of the song for the whole song), saved
  as an edit of the song (`seenAt`, a version, D86, D104, D106), never a note, never in Moje
  poznámky. The song's own comment is changed or removed from its line's menu ("Upravit
  komentář"), only that line, the rest of the text as written; removing it is undone from the
  toast. The song's comments keep their look on the sheet, apart from the tinted notes (D139).
  _Above the line, not after it: D146._ _Online only: D148. Chosen in the line's menu: D149._
- **D146. Reports and song comments after the review and the walk** (the owner's calls,
  2026-11-26; refines D143–D145). The note dialog's title, field ("Text") and button follow whom
  the note is for: "Nahlásit chybu" / "Nahlásit", "Komentář do písničky" / "Zapsat do písničky";
  each choice says first who sees it ("Pro editory: chyba v písničce", "Pro všechny: zapsat do
  písničky", on a private song "Pro všechny, kdo ji vidí"). "Vyřešeno" is undone from the toast,
  as deleting is (D139); a report already resolved by another editor just goes. A report opens
  with "Upravit písničku", and the song's open reports wait above its text on the edit page,
  each resolved there. The queue's Hlášení are grouped by song, the song with the oldest first.
  "Nahlásit chybu" is in a line's menu for everyone, leading signed-out readers through signing
  in. A comment written into the song at a line goes above it ("Nad řádek „…“"; before the
  `{chorus}` line in a repeat), reading as about that line, not as the next one's heading. On
  the song's own comment no note is offered (a note on a comment makes no sense): whoever may
  change the song gets "Upravit komentář" there, on hover too, to change or remove it. A song
  with someone else's open report can't go private (`SONG_REPORTED_BY_OTHERS`). _The kinds as
  one list: D147; chosen in the line's menu: D149._
- **D147. Toasts at the bottom; a note's kind chosen as one list** (the owner's calls,
  2026-11-26; refines D87, D146). Every toast sits at the bottom centre, as the undo toast did
  (D87): in a thumb's reach, never over a dialog's title nor the song's toolbar, and above a
  playlist's bar or pill when there is one. A new note's "Co to je" is one choice, each saying
  who sees it: Poznámka (jen pro tebe), TODO (jen pro tebe, k odškrtnutí), Poznámka pro playlist
  „…“ (playing from one you may edit), Chyba v písničce (pro editory a autora písničky; once
  fixed it leaves the song, and its reporter keeps it, resolved), Komentář do písničky (pro
  všechny). The TODO checkbox stays only for changing one's own note, where it's ticked done.
  _The kind chosen in the line's menu, not in the dialog: D149._
- **D148. The corners the walks hadn't reached** (the owner's calls, 2026-11-26, after a walk of
  offline, tablets, an approved song's author and long playlists). Changes made offline wait in
  memory only: closed before the connection returns, they're lost; the toast says so ("Do té
  doby aplikaci nezavírej."), and no device outbox is planned. Offline, one change waiting
  doesn't hold up the next (the dialog is busy only while a request goes out). Writing into the
  song is online only, as nothing would show it waiting. The author of an approved song opens a
  report on it to read it ("Opraví ji editor."). On the edit page a report's line is shown in
  the text ("Ukázat v textu"), the place telling repeated lines apart. Back from a song deep in
  a playlist, its row is in sight. A page-turner's PageDown brings the first line not wholly in
  sight to the top, not a cut line.
- **D149. What to write is chosen in the line's menu** (the owner's call, 2026-11-26; refines
  D147). A line's menu (long-press, right-click, the hover button, or ⋯ → "Přidat k řádku…" and
  a line picked; "K celé písničce" for the whole song) lists one item per kind, only those the
  reader may write: Poznámka, TODO, Poznámka pro playlist, Nahlásit chybu, Komentář do písničky
  ("jen online" offline), then Kopírovat řádek; on the song's own comment, Upravit komentář
  instead of the notes. Each opens its own dialog: its title, who will see it, the text, and a
  button saying what happens. No choice of kind inside the dialog: picking the wrong one is
  closing it and picking again.
- **D150. What a song's ChordPro holds, and a save writes it one way** (the owner's calls,
  2026-11-27, after going through the whole ChordPro 6 spec against the songbook's 432 songs and
  production's 29; `.planning/ongoing/chordpro-directives.md`). The text keeps what describes
  the song: title, artist, key, capo, tempo, time, duration, tags, composer and the like,
  sections (verse, chorus, bridge, tab, grid, intro, interlude, outro), `{chorus}`, comments,
  `{define}`, `{+notes.system}`. A printed page's settings (columns, `{column_break}`, page
  breaks, fonts, `{+pdf…}`, `{+diagrams…}`, sort titles) and other apps' (`{zoom-iphone}`,
  SongBook's `{soh}`/`{eoh}`, `{x_…}`) are no part of it: the reader's screen decides columns
  and keeps a section whole (D108, D129), every chord gets a diagram (D132), a repeated chorus
  is shown whole (D122). An export, if one is ever built, adds them. Every save (new, edit,
  approve) writes the text one way (`tidySource`): those settings out, short forms written out
  (`{c}` as `{comment}`), every comment plain (italic and boxed ones look the same now), a
  subtitle that repeats the artist dropped and one standing for it made `{artist}`,
  `{meta: x …}` as `{x: …}`, `{genre}` as a tag, `{time: 3:05}` as `{duration}`, `{metronome}`
  as `{tempo}`, markup out of the lyrics, a verse's number and a chorus's "Ref" out, one space
  after the colon. Never the words, the chords, or what the sheet shows. The editor says before
  saving what will be tidied, in one line, with "Uklidit hned" to see it done in the text.
  Refused with a warning, as before: images, music notation (abc, LilyPond, svg, textblock,
  now left out of the sheet), `{new_song}`, selectors (`{define-ukulele}`), annotations
  `[*text]`, anything unknown. **Tags stay in the text** (D118): a tag says what the song is
  (Koledy, Pohádky, Folk); what someone does with a song (to finish, favourites, a band's set)
  is a playlist, never a tag, and an artist is never a tag either.
- **D151. A song written the old songbook's way is offered this songbook's way** (the owner's
  go, 2026-11-27; phase 3 of `.planning/ongoing/chordpro-directives.md`). The editor spots it
  and offers it, like chords above the lyrics (D94), never a save: "Písnička je zapsaná po
  staru. Upravit: …?" naming what would change, "Upravit" doing it and the tidy (D150) in one
  step the browser's undo takes back, "Nechat" keeping the text. Headings in comments
  (`{c: REF}`, `SLOKA`, `Intro`, `Mezihra`, `Outro`, `Bridge`) become their sections, the
  instrumental ones labelled in Czech; a bare paragraph with words becomes a verse, one of chords only a Předehra, Mezihra or Dohra by
  where it stands among the sung parts (not in a song of chords only); a lone REF
  once the song has a chorus is `{chorus}`, numbered choruses are "Refrén 1", "Refrén 2". `Ami`
  is `Am`, `{c: capo 3}` is `{capo: 3}`, a band's running order leaves the title (`08 Hush`),
  a directive left open is closed. Of tags, only the old songbook's own: a genre loses its
  dashes (`- Folk -` is Folk), a status goes (Zpěvník, Novinky, !Dodělat, PS oblíbené, Po
  anglicku), and so does one naming the song's artist. Bands stay until they become playlists.
  What it can't be sure of stays as written: "verse 3 = 2", an earlier chorus recalled. Never the words.
- **D152. The artist has a field, as tags do** (the owner's idea, 2026-11-27, after "Ledecký" and
  "Janek Ledecký" split one artist in two). Above Štítky in the editor, "Interpret" reads and
  writes the song's `{artist}` line (the text stays the only truth, D4): typed, the line follows
  as typed; it suggests the artists of the songs the viewer can find, matching anywhere in the
  name, so "Ledecký" offers "Janek Ledecký"; left, a name that differs from a known one only in
  capitals and accents is written the catalog's way. Anything may still be written. Several
  artist lines become one once the field is used; an emptied one stays `{artist: }`.
