Use the `ux` agent to critically walk a surface of Zpěvňák in a real browser, as the people who
use it, and publish a triaged report of UX and UI improvements.

`$ARGUMENTS` names the surface (a route, a feature or a flow, e.g. "the song view" or "leaving a
playlist and coming back") and may add personas or a focus ("on a phone"). Pass them through
verbatim.

## 1. The venue

The walk runs against the dev server on http://localhost:3100 and the local seeded database.

1. `curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/healthz`.
   - **200:** it's up. Use it as it is.
   - **No answer:** check Docker's database first: `docker compose ps db`. If it isn't running,
     `yarn db:up`. Then make sure the data is there (`yarn migrate && yarn seed`; both are safe
     to repeat), and start the server in the background with `yarn dev`. Wait for the curl to
     return 200 (up to a minute). Remember that you started it.
2. Never reseed over the owner's data or drop the database: what's in it is theirs.

## 2. The walk

Launch the agent with the arguments. It publishes one Artifact, writes a code-checked handover
to `.ux-walk/`, and returns both plus a short summary. Hand all three to the user. It never edits
code; what gets built from the report is the user's call.

## 3. Afterwards

If you started the server in step 1, stop it. If it was already running, leave it running.
