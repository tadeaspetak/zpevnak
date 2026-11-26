import { Anchor, Button, Group, Menu, Paper, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCopy,
  IconFlag,
  IconPencil,
  IconNote,
  IconNotes,
  IconPlaylist,
  IconSquare,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { url } from '#shared/urls.ts';
import { reportOffer } from './reportOffer.ts';
import type { SongLinkState } from '../components/SongRow.tsx';
import type { Song } from '#shared/chordpro/types.ts';
import { notePlaces, placeOf, type NotePlace } from '#shared/notes.ts';
import { editsAsMember } from '#shared/roles.ts';
import { canChangeSong } from '#shared/songs.ts';
import { IconButton } from '../components/IconButton.tsx';
import { useCatalog, type LocalNote } from '../data/catalog.ts';
import { canChangeNote, inFilter, isResolved } from '../data/notes.ts';
import { usePrefs } from '../data/prefs.ts';
import type { NoteRecord, PlaylistRecord, SongRecord } from '../data/store.ts';
import { useLinePress, type LinePress } from '../hooks/useLinePress.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { NoteModal, type NoteTarget } from './NoteModal.tsx';
import classes from './SongNotes.module.css';

type Playing = Pick<PlaylistRecord, 'id' | 'name' | 'role' | 'isPublic'>;

/** Oldest first: a note answering another comes after it. */
const byAge = (a: NoteRecord, b: NoteRecord) =>
  a.createdAt.localeCompare(b.createdAt) || a.id - b.id;

/**
 * The notes on a song, and the ways to add one (D135): a long-press or a right-click on a line
 * opens a menu at it, a mouse hovering a line shows a button for it, and the ⋯ menu starts
 * picking a line (`startPicking`), the way in for a keyboard too. One's own notes show
 * wherever the song is played; a playlist's only when playing from it.
 *
 * `container` is the element around the sheet, once it is on the page: it hears the presses and
 * holds the hover button.
 */
export function useSongNotes({
  songId,
  song,
  record,
  playlist,
  container,
}: {
  /** Null while the song loads. */
  songId: number | null;
  /** As written, not transposed: notes are placed by its lines. */
  song: Song | null;
  /**
   * The song as loaded: who may fix it (they resolve reports, D143, and write comments into it,
   * D145), and the text a comment is written into.
   */
  record: SongRecord | null;
  playlist: Playing | null;
  container: HTMLDivElement | null;
}) {
  const { t } = useI18n();
  const { notes } = useCatalog();
  const { me } = useMe();
  const prefs = usePrefs();
  const location = useLocation();
  const coarse = useMediaQuery('(pointer: coarse)');
  const places = useMemo(() => (song ? notePlaces(song) : []), [song]);
  const lines = useMemo(
    () => places.flat().filter((p): p is NotePlace => p !== null),
    [places],
  );

  const canWrite = Boolean(me?.emailVerified);
  const writesForPlaylist = Boolean(playlist && canWrite && editsAsMember(playlist.role));
  // Anyone with an account reports a mistake, an editor too, for whoever gets to it; whoever
  // may fix the song resolves the reports (D143). Not on a private song: no editor reviews it.
  const canFix = record !== null && canChangeSong(me, record);
  const canReport = canWrite && record !== null && record.status !== 'private';
  const navigate = useNavigate();
  // "Nahlásit chybu" for anyone (D143): the report here, or the way to it (signing in, or
  // confirming the email first). The same in ⋯ and in a line's menu.
  const offer = reportOffer({
    isPrivate: record?.status === 'private',
    signedIn: me !== null,
    start: canReport ? () => addAt(null, true) : undefined,
    path: location.pathname,
    unconfirmed: () => {
      const id = 'report-unconfirmed';
      notifications.show({
        id,
        message: (
          <>
            {t('notes.reportUnverified')}{' '}
            <Anchor
              component="button"
              size="sm"
              onClick={() => {
                notifications.hide(id);
                navigate(url.account());
              }}
            >
              {t('notes.confirmEmail')}
            </Anchor>
          </>
        ),
      });
    },
  });
  const canChange = (note: NoteRecord) => canChangeNote(note, playlist, me);
  // A report, to whoever may fix the song (to resolve it), and to the song's author who can't
  // (an approved song: to read it, D148).
  const canReview = (note: LocalNote) =>
    note.kind === 'report' &&
    !note.waiting &&
    !canChange(note) &&
    (canFix || (me !== null && record?.createdBy === me.id));

  const { atPlace, top } = useMemo(() => {
    const atPlace = new Map<number, LocalNote[]>();
    const top: { note: LocalNote; moved: boolean }[] = [];
    const mine = [...notes.values()]
      .filter(
        (n) =>
          n.songId === songId &&
          (n.playlistId === null || n.playlistId === playlist?.id) &&
          // A TODO done is off the song, kept in Moje poznámky → Hotové; so is a report fixed.
          !inFilter(n, 'done') &&
          !isResolved(n),
      )
      .sort(byAge);
    for (const note of mine) {
      const place = note.line ? placeOf(places, note.line) : null;
      if (place === null) {
        top.push({ note, moved: note.line !== null });
      } else {
        atPlace.set(place, [...(atPlace.get(place) ?? []), note]);
      }
    }
    return { atPlace, top };
  }, [notes, songId, playlist?.id, places]);

  const [target, setTarget] = useState<NoteTarget | null>(null);
  const [menu, setMenu] = useState<(LinePress & NotePlace) | null>(null);
  const [picking, setPicking] = useState(false);
  // Another song (a swipe, the arrows): nothing half-done on this one follows it there.
  const [shownFor, setShownFor] = useState(songId);
  if (shownFor !== songId) {
    setShownFor(songId);
    setPicking(false);
    setMenu(null);
    setTarget(null);
  }
  const [hover, setHover] = useState<{ place: number; top: number; left: number } | null>(
    null,
  );
  const lineAt = (place: number) => lines.find((l) => l.place === place) ?? null;
  // The song's own comment opened to change or remove (D145), by its source line.
  const editComment = (at: number) => {
    const text = commentOn(at);
    if (text !== null) {
      setTarget({ kind: 'comment', at, text });
    }
  };
  // A song comment's whole text, from the song: a place keeps only so many of its words.
  const commentOn = (source: number) => {
    for (const block of song?.blocks ?? []) {
      const found =
        block.type === 'section'
          ? block.lines.find((l) => l.type === 'comment' && l.source === source)
          : undefined;
      if (found?.type === 'comment') {
        return found.text;
      }
    }
    return null;
  };
  const addAt = (place: NotePlace | null, report = false) => {
    setPicking(false);
    if (songId !== null) {
      setTarget({ kind: 'new', songId, place, report });
    }
  };

  useLinePress(container, (press) => {
    const line = lineAt(press.place);
    if (line && !picking) {
      setMenu({ ...press, ...line });
    }
  });

  // Picking: a click or Enter on a line takes it, and nothing else on the sheet answers (the
  // toolbar stays as it is); Escape gives up.
  useEffect(() => {
    const el = container;
    if (!picking || !el) {
      return;
    }
    const pick = (target: EventTarget | null) => {
      const line =
        target instanceof Element ? target.closest<HTMLElement>('[data-place]') : null;
      return line ? lineAt(Number(line.dataset.place)) : null;
    };
    const onClick = (e: MouseEvent) => {
      e.stopPropagation();
      const line = pick(e.target);
      if (line) {
        addAt(line);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const line = pick(e.target);
        if (line) {
          e.preventDefault();
          addAt(line);
        }
      }
    };
    // Escape gives up from anywhere: focus is often still on the ⋯ that started it. The bar is
    // a dialog, so the page's own keys (Escape leaving the song, arrows turning it) wait.
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPicking(false);
      }
    };
    el.addEventListener('click', onClick, true);
    el.addEventListener('keydown', onKey, true);
    window.addEventListener('keydown', onEscape);
    return () => {
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keydown', onEscape);
    };
  });

  // A mouse over a line shows a button at its end that adds a note to it: the right-click
  // can't be seen, this can.
  useEffect(() => {
    const el = container;
    if (!el || !canWrite || coarse) {
      return;
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !(e.target instanceof Element)) {
        return;
      }
      if (e.target.closest('[data-note-add]')) {
        return;
      }
      const line = e.target.closest<HTMLElement>('[data-place]');
      if (!line) {
        setHover(null);
        return;
      }
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(line);
      const text = range.getBoundingClientRect();
      const place = Number(line.dataset.place);
      setHover((was) =>
        was?.place === place
          ? was
          : { place, top: text.bottom - box.top, left: text.right - box.left },
      );
    };
    const onLeave = () => setHover(null);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [container, canWrite, coarse]);

  // Come from one's notes to read one (D135): it is scrolled into sight once it's on the page,
  // the device's notes being read just after the song.
  // A note not drawn (a report since fixed, notes switched off): its line, where it was.
  const goTo = (location.state as SongLinkState | null)?.note;
  const wentTo = useRef<number | null>(null);
  useEffect(() => {
    if (goTo === undefined || wentTo.current === goTo || !container) {
      return;
    }
    const el = container.querySelector(`[data-note-id="${goTo}"]`);
    if (el) {
      wentTo.current = goTo;
      el.scrollIntoView({ block: 'center' });
      // Which of the notes there it was: lit up for a moment.
      el.setAttribute('data-flash', '');
      setTimeout(() => el.removeAttribute('data-flash'), 1600);
      return;
    }
    const line = notes.get(goTo)?.line;
    const place = line ? placeOf(places, line) : null;
    const at = place === null ? null : container.querySelector(`[data-place="${place}"]`);
    if (at) {
      wentTo.current = goTo;
      at.scrollIntoView({ block: 'center' });
    }
  });

  // One's own to change; a report, for whoever may fix the song, to resolve (D143).
  const opens = (note: LocalNote) =>
    (canChange(note) || canReview(note)) && !note.waiting;
  const open = (note: NoteRecord) =>
    setTarget(canChange(note) ? { kind: 'edit', note } : { kind: 'review', note });
  const shown = prefs.showNotes;
  const copy = (words: string) => {
    void navigator.clipboard?.writeText(words).then(
      () => notifications.show({ message: t('notes.copied') }),
      () => notifications.show({ color: 'red', message: t('notes.copyFailed') }),
    );
  };

  // Inside the sheet's box, which it is placed in.
  // On the song's own comment a note makes no sense: whoever may change the song gets the
  // comment to change or remove instead, anyone else nothing (D146).
  const hovered = hover ? lineAt(hover.place) : null;
  const hoverAction =
    hovered !== null && hovered.comment !== null
      ? canFix && {
          label: t('notes.editComment'),
          icon: <IconPencil size={16} />,
          run: () => hovered.comment !== null && editComment(hovered.comment),
        }
      : {
          label: t('notes.addAtLine'),
          icon: <IconNotes size={16} />,
          run: () => addAt(hovered),
        };
  const hoverButton =
    hover && !picking && hoverAction ? (
      // Placed by its wrapper: the button's own transform is Mantine's, nudging it as it's pressed.
      <div
        className={classes.hoverAdd}
        style={{ top: hover.top, left: hover.left }}
        data-note-add
      >
        <IconButton label={hoverAction.label} size="sm" onClick={hoverAction.run}>
          {hoverAction.icon}
        </IconButton>
      </div>
    ) : null;

  // Outside the sheet: a click in a dialog or a bar mustn't reach the sheet's tap (D93).
  const overlay = (
    <>
      <Menu
        opened={menu !== null}
        onChange={(opened) => {
          if (!opened) {
            setMenu(null);
          }
        }}
        // Above a finger, not under it; below a mouse pointer, as menus open.
        position={coarse ? 'top-start' : 'bottom-start'}
        offset={coarse ? 12 : 4}
      >
        <Menu.Target>
          {/* A button, as a menu's target must be (its attributes say what it opens); out of
              reach, the line itself having opened it. */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={menu?.words ?? t('notes.lineMenu')}
            className={classes.menuAnchor}
            style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }}
          />
        </Menu.Target>
        <Menu.Dropdown>
          {menu && (
            <>
              <Menu.Label className={classes.menuLine}>{menu.words}</Menu.Label>
              {/* The song's own comment, by whoever may change the song (D145): on its line,
                  changing it comes first. */}
              {canFix && menu.comment !== null && (
                <Menu.Item
                  leftSection={<IconPencil size={16} />}
                  onClick={() => menu.comment !== null && editComment(menu.comment)}
                >
                  {t('notes.editComment')}
                </Menu.Item>
              )}
              {/* Not on the song's own comment: a note on a comment makes no sense. */}
              {canWrite && menu.comment === null && (
                <Menu.Item
                  leftSection={<IconNotes size={16} />}
                  onClick={() => addAt(menu)}
                >
                  {t('notes.add')}
                </Menu.Item>
              )}
              {/* At this line for whoever can write it; else the way there (D143). */}
              {offer && (
                <Menu.Item
                  leftSection={<IconFlag size={16} />}
                  onClick={() =>
                    canReport
                      ? addAt(menu, true)
                      : 'to' in offer
                        ? navigate(offer.to)
                        : offer.onClick()
                  }
                >
                  {t('song.reportMistake')}
                </Menu.Item>
              )}
              <Menu.Item
                leftSection={<IconCopy size={16} />}
                onClick={() => copy(menu.words)}
              >
                {t('notes.copyLine')}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
      {picking && (
        <Paper
          className={classes.pickBar}
          shadow="md"
          role="dialog"
          aria-label={t('notes.pickLine')}
        >
          <Text size="sm" className={classes.pickHint}>
            {coarse ? t('notes.pickTouch') : t('notes.pickMouse')}
          </Text>
          <Group gap="sm" justify="flex-end">
            <Button size="sm" variant="default" onClick={() => setPicking(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="default" onClick={() => addAt(null)}>
              {t('notes.wholeSong')}
            </Button>
          </Group>
        </Paper>
      )}
      <NoteModal
        target={target}
        playlist={writesForPlaylist && playlist ? playlist : null}
        canReport={canReport}
        fixing={canFix ? record : null}
        onClose={() => setTarget(null)}
        // Notes switched off come back into sight, to show the one just saved.
        onSaved={() => {
          if (!prefs.showNotes) {
            prefs.setShowNotes(true);
          }
        }}
      />
    </>
  );

  return {
    sheet: {
      places,
      picking,
      notesAt: (place: number) => {
        const here = shown ? atPlace.get(place) : undefined;
        return here ? <NoteList notes={here} opens={opens} onOpen={open} /> : null;
      },
      topNotes:
        shown && top.length > 0 ? (
          <NoteList
            notes={top.map(({ note }) => note)}
            moved={new Set(top.filter((n) => n.moved).map((n) => n.note.id))}
            opens={opens}
            onOpen={open}
          />
        ) : null,
    },
    hoverButton,
    overlay,
    /** Starts picking a line, for the ⋯ menu; undefined for whoever can't write notes. */
    startPicking: canWrite ? () => setPicking(true) : undefined,
    /** "Nahlásit chybu" in ⋯ (D143): the report, the way to it, or null (a private song). */
    report: offer,
  };
}

/**
 * Notes at one place on the sheet, set apart from the song: tapped, one opens, to change it or,
 * a report, to resolve it (`opens`).
 */
function NoteList({
  notes,
  moved,
  opens,
  onOpen,
}: {
  notes: LocalNote[];
  /** Notes whose line has gone from the song: shown at the top, with the words they were at. */
  moved?: ReadonlySet<number>;
  opens: (note: LocalNote) => boolean;
  onOpen: (note: NoteRecord) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={classes.notes} data-notes>
      {notes.map((note) => {
        const icon =
          note.kind === 'report' ? (
            <IconFlag role="img" aria-label={t('notes.reportMark')} />
          ) : note.kind === 'playlist' ? (
            <IconPlaylist role="img" aria-label={t('notes.playlistMark')} />
          ) : note.todo ? (
            // Only open ones: a TODO done is off the song (D138).
            <IconSquare role="img" aria-label={t('notes.todoMark')} />
          ) : (
            <IconNote role="img" aria-label={t('notes.mark')} />
          );
        const content = (
          <>
            {icon}
            <span>
              {moved?.has(note.id) && note.line && (
                <span className={classes.moved}>
                  {t('notes.lineMoved', { words: note.line.text })}{' '}
                </span>
              )}
              {note.text}
              {note.waiting && (
                <span className={classes.waiting}> · {t('notes.waiting')}</span>
              )}
            </span>
          </>
        );
        // Waiting for the connection, it can't be opened yet: the server hasn't got it.
        return opens(note) ? (
          <button
            key={note.id}
            data-note-id={note.id}
            type="button"
            className={classes.note}
            onClick={() => onOpen(note)}
          >
            {content}
          </button>
        ) : (
          <p key={note.id} className={classes.note} data-note-id={note.id}>
            {content}
          </p>
        );
      })}
    </div>
  );
}
