# Private songs, and three roles for songs and playlists

**State:** ongoing. Agreed in conversation on 2026-11-23 (a friend's request: their own songs,
songs in the making). Phase 1 shipped 2026-11-23 (D126), phase 2 too (D127).

## Why

Everything in the songbook is public today: a song anyone adds is everyone's, reviewed by the
editors. That leaves no place for a band's own songs, a song still being written, or anything
else someone wants to keep to a few people. And playlists can only be shared for editing: there
is no way to let people follow a playlist without being able to change it (singers at a gig,
reading along, shouldn't reorder the set by accident).

## Decided

1. **Public is the default; a song can be made private.** A private song is outside the
   songbook: it is never reviewed (no queue; `status` means something only for public songs),
   and it is invisible to everyone it isn't shared with, **editors and admins included**: they
   get NOT_FOUND like anyone else (hide existence).
2. **Three roles, the same words for songs and playlists:** owner (one, the creator; the only
   one who manages people, deletes, and changes visibility), **může upravovat** (edits), **jen
   čte** (reads). Phrases rather than nouns, so nobody needs the app's own lingo. Playlists'
   collaborators become "může upravovat"; "jen čte" is new for both.
3. **A playlist shares its songs.** Everyone in a playlist (any role) can read every private
   song in it, for as long as they are in the playlist and the song is in it. Access is
   computed from the memberships as they are, never copied, so leaving, being removed or the
   song being taken out ends it on its own. A playlist grants reading only: editing a private
   song comes only from the song's own sharing.
4. **Private → public is publishing:** the song goes to the queue as pending, like a new one.
5. **Public → private only while nobody else has a stake in it** (a song made public by
   mistake): every version of it is the owner's (no one else edited, approved or rejected it:
   `song_versions.saved_by`), and it is in no playlist but the owner's own. Otherwise the
   switch is refused, and says why.

## The rules this needs (proposed, settle while building)

- **Only a private song's owner can put it where it grants access.** Adding a private song to
  a playlist whose people can't all read it already would share it with them; only the song's
  owner may do that (rule 3 would otherwise let anyone who can read a song pass it on). Anyone
  else who can read it may add it only where everyone already can. A check in `playlistOps`'
  server side, under the same row lock as every playlist edit (D69).
- **People outside a playlist see a placeholder** for a private song they can't read:
  "Soukromá písnička", no title, skipped by previous/next. That is anyone opening a public
  playlist, and the case of a playlist made public after private songs went in. (Check what the
  client does today with a `songId` missing from the catalog: deletion removes it from playlists,
  so it may never have needed to.)
- **Deleting stays the owner's**, for songs as for playlists. Song editors edit; transposing for
  good is an edit, so a reader only transposes in the view.
- **Link previews** (D125) already load as a signed-out viewer, so a private song previews as
  the app does, and a private song in a public playlist falls back to the playlist's preview.
  Add the specs that prove it.

## The model

- `songs.is_private boolean NOT NULL DEFAULT false`, and `songs.created_by` is the owner (it
  already is the author).
- `song_members (song_id, user_id, role, joined_at)` beside `playlist_collaborators`, which
  gains `role` (existing rows: `editor`). Two tables, not one polymorphic "shares" table: foreign
  keys and plain queries are worth more than the symmetry of a table. The symmetry lives in code:
  the role type and the checks in `src/shared/` (beside `canChangeSong`), used by both sides.
- **Invite links per role:** two tokens per song and per playlist, "pro čtení" and "pro
  úpravy". The playlist's existing `invite_token` becomes its editing link, so links already
  sent keep doing what they did. The owner can change a person's role in the dialog afterwards.
  No user search (D68's reason stands).
- **One sharing dialog** for songs and playlists (D105, D111): who sees it, the two links, the
  people with their roles.

## Offline (the expensive part)

`songs.sync` sends every song to everyone, by a cursor on `updated_at`. Private songs break it
twice: access granted later (a share, joining a playlist) doesn't touch the song, so the cursor
never brings it; access lost doesn't delete the song, so `song_deletions` never removes it.

- **Public songs** keep the cursor. **Private songs the viewer can read** come whole on every
  sync, as `playlists.all` does for playlists (a handful per person). The device drops any
  private song not in that set.
- **A song going private** bumps `updated_at`; the sync then sends its id in `removedIds` to a
  viewer who can't read it (a changed row they may not see), so it leaves their device without
  a new table.
- A device that stays offline keeps a song it lost until it syncs. Accepted; signing out
  already clears the device copy.

## Phases

Each ships on its own.

1. **Playlist roles (shipped, D126).** `role` on `playlist_collaborators`, the reading link
   (`view_token`), roles in the sharing dialog, readers can't edit. As built: the role type and
   `canEditPlaylist` are in `src/shared/roles.ts`; the code says `collaborator`/`viewer`, as
   "editor" is a songbook role. The dialog is still the playlist's own (`ShareModal`); phase 2
   pulls out what a song's sharing needs, once there is a second user of it.
2. **Private songs (shipped, D127).** As built, it differs from the sketch above in three
   ways: private is a song status (`'private'`), not an `is_private` flag, so a private song
   can't also be pending or approved and every status check leaves it out by itself; sharing
   is one `sharing` router for playlists and songs (`kind`), with each kind's tables in
   `SHARED_TABLES`; and a private song's deletion stays out of `song_deletions` (every device
   syncs those), its people's devices dropping it as a private song no longer sent.
3. **Private songs in shared playlists.** Access through playlists, the owner-only rule, the
   placeholder.

## Tests that matter most

- Every way a private song could leak, as a stranger, an editor and an admin: `songs.byId`,
  `songs.sync`, search, a playlist's songs, the review queue, link previews, versions.
- Every false reject: the owner, a song editor, a song reader, a playlist member reading through
  the playlist, each through the procedure the client uses.
- Access ending: leaving the playlist, being removed, the song taken out of it, the song's
  sharing changed. Each one gone from the device on the next sync (a sync spec, and one e2e).
- The public → private checks, each one refusing on its own, and passing when none applies.

## Open questions

- Czech for the placeholder, the links and the switch: decided while building, by looking.
- Does "Parťáci" stay as the people section's heading, with the roles beside the names?
