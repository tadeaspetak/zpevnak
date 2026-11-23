# Plans

A plan is for work too big to agree in one message: several steps, a model change, or choices
that need the owner's word before code. Smaller agreed changes go to `docs/BACKLOG.md`.

## Where a plan lives

| Folder     | State                                                                  |
| ---------- | ---------------------------------------------------------------------- |
| `next/`    | Shaped and agreed, not started.                                        |
| `ongoing/` | Started: at least one part is being built or has shipped.              |
| `later/`   | Parked: worth keeping, not now. Say why, and what would bring it back. |
| `done/`    | Archive: every part shipped, or the rest dropped. Read-only history.   |

Move the file with `git mv` as its state changes, in the same commit as the work that changed
it, and keep its `**State:**` line (under the title) saying the same.

## What goes in one

- **State**: one line under the title: the state, when it was agreed and with whom, what has
  shipped and as which decisions.
- **Why**: the problem, in the people's terms (who asked, what they can't do today).
- **Decided**: what the owner has said, numbered, in their words where it matters. A plan is
  not started until this part is agreed.
- **Proposed, settle while building**: rules and details the plan suggests but the owner hasn't
  confirmed. Kept apart from Decided, so nobody mistakes a suggestion for a promise.
- **The model**: schema and code shape, named by file where it helps.
- **Phases** (or slices): each one ships on its own, gates green, useful by itself; the order
  says what depends on what.
- **Tests that matter most**: the leaks, the false rejects, the paths that break quietly.
- **Open questions**: what needs an answer, and from whom.

## While it is being built

- **Decisions are the truth, the plan is the reasoning.** When a phase ships, record what it
  settled in `docs/DECISIONS.md` (a D-number per phase or per rule), and cite the plan there.
  The decisions log is binding; the plan is not.
- **Mark each phase as it ships**: `(shipped, D128)` in its heading, and an **As built** note
  for every way it differs from the sketch (a flag became a status, a placeholder was dropped),
  with the reason. Don't rewrite the sketch: what was planned and what was built both stay
  readable.
- **A change of design is said before it is built**, to the owner, with the reason. If the
  owner hasn't agreed to it, it waits.
- **Refactors that a phase needs ship first, on their own**, with no change in behaviour, so
  the phase's own commit shows only what it changes.

## Finishing one

1. Every phase shipped, or the rest dropped with the reason in the plan (dropped work that is
   still wanted goes to `docs/BACKLOG.md` or a new plan in `later/`).
2. Close the open questions: each answered (citing the decision) or moved on as above.
3. The State line says `done`, with the D-numbers.
4. `git mv` it to `done/` and commit.

After that a plan in `done/` doesn't change. A later change to what it built gets its own
decision, and its own plan if it needs one; the old plan stays as the record of why things
were first built that way.
