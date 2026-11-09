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
- **D5. No version history.** A save overwrites the song. (2026-11-09)
- **D6. Tags stay in the songs and do nothing** for now: no filters, no tag UI. (2026-11-09)
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
  (2026-11-09)
- **D26. The screen stays awake** on a song (Wake Lock). (2026-11-09)

## Navigation

- **D30. Search is the last icon at top right on every page**, song view included. It opens the
  overview with the search box focused. Moving it between pages was tried and rejected: a global
  control must stay in one place. (2026-11-09)
- **D31. Back says where it goes**, in its tooltip and accessible name ("Back to Vršek 2026",
  "Back to search results", "Back home"; Czech "Zpět: …", because the preposition would change
  with the noun). Back from a song returns to the page it was opened from; search results keep
  their query. (2026-11-09)
- **D32. Leaving a playlist doesn't end it.** While a playlist is being played, a pill at the
  bottom of other pages leads back to the current song, until closed. (2026-11-09)
- **D33. Playlists sort by when they were last played** on this device. (2026-11-09)
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
  the key at a glance.
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
  they mean something. (2026-11-09)

- **D62. Editors approve: "Schválit" / "Approve"**, not "Ověřit", which reads like sending a
  song off to be verified. The song's status stays "Neověřeno" for players: nobody checked it yet.
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

- **D76. A rejected song is hidden, not deleted**, in playlists too: to everyone but its author
  it isn't in the list, the count or the player (numbers close up: 1 → 2 → 3, no gaps). It stays
  in the playlist's data, in its place, and comes back there once fixed and approved. Its author
  sees it, marked rejected. The server leaves hidden songs out of the playlist it sends, and
  applies a person's edits to the list as they see it, keeping hidden songs after the song they
  followed. The device's catalog hands out playlists of playable songs only, so the count, list
  and player always agree. No "a song is hidden" note for others (the owner's call). Removing a
  rejected song from every playlist was rejected: it would rewrite others' setlists for good.
  (2026-11-09)

## Engineering

- **D40. One developer; commit to `main`.** No branches, PRs or release process. (2026-11-09)
- **D41. Postgres on Neon, the app on Cloud Run**, both on personal accounts. The machine's
  default gcloud configuration is work and is never changed. (2026-11-09)
- **D42. Own auth in Express**, not a hosted auth service: users and roles live in our database
  and are testable there. (2026-11-09)
