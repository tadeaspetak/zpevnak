import { Button, Group, Menu, Paper, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCopy,
  IconNote,
  IconNotes,
  IconPlaylist,
  IconSquare,
  IconSquareCheck,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import type { SongLinkState } from '../components/SongRow.tsx';
import type { Song } from '#shared/chordpro/types.ts';
import { notePlaces, placeOf, type NotePlace } from '#shared/notes.ts';
import { editsAsMember } from '#shared/roles.ts';
import { IconButton } from '../components/IconButton.tsx';
import { useCatalog } from '../data/catalog.ts';
import { canChangeNote } from '../data/notes.ts';
import { usePrefs } from '../data/prefs.ts';
import type { NoteRecord, PlaylistRecord } from '../data/store.ts';
import { useLinePress, type LinePress } from '../hooks/useLinePress.ts';
import { useMe } from '../hooks/useMe.ts';
import { useI18n } from '../i18n/index.tsx';
import { NoteModal, type NoteTarget } from './NoteModal.tsx';
import classes from './SongNotes.module.css';

type Playing = { id: number; name: string; role: PlaylistRecord['role'] };

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
  playlist,
  container,
}: {
  /** Null while the song loads. */
  songId: number | null;
  /** As written, not transposed: notes are placed by its lines. */
  song: Song | null;
  playlist: Playing | null;
  container: HTMLDivElement | null;
}) {
  const { t } = useI18n();
  const { notes } = useCatalog();
  const { me } = useMe();
  const prefs = usePrefs();
  const coarse = useMediaQuery('(pointer: coarse)');
  const places = useMemo(() => (song ? notePlaces(song) : []), [song]);
  const lines = useMemo(
    () => places.flat().filter((p): p is NotePlace => p !== null),
    [places],
  );

  const canWrite = Boolean(me?.emailVerified);
  const writesForPlaylist = Boolean(playlist && canWrite && editsAsMember(playlist.role));
  const canChange = (note: NoteRecord) => canChangeNote(note, playlist, canWrite);

  const { atPlace, top } = useMemo(() => {
    const atPlace = new Map<number, NoteRecord[]>();
    const top: { note: NoteRecord; moved: boolean }[] = [];
    const mine = [...notes.values()]
      .filter(
        (n) =>
          n.songId === songId && (n.playlistId === null || n.playlistId === playlist?.id),
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
  const addAt = (place: NotePlace | null) => {
    setPicking(false);
    if (songId !== null) {
      setTarget({ kind: 'new', songId, place });
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
  const goTo = (useLocation().state as SongLinkState | null)?.note;
  const wentTo = useRef<number | null>(null);
  useEffect(() => {
    if (goTo === undefined || wentTo.current === goTo) {
      return;
    }
    const el = container?.querySelector(`[data-note-id="${goTo}"]`);
    if (el) {
      wentTo.current = goTo;
      el.scrollIntoView({ block: 'center' });
    }
  });

  const open = (note: NoteRecord) => setTarget({ kind: 'edit', note });
  const shown = prefs.showNotes;
  const copy = (words: string) => {
    void navigator.clipboard?.writeText(words).then(
      () => notifications.show({ message: t('notes.copied') }),
      () => notifications.show({ color: 'red', message: t('notes.copyFailed') }),
    );
  };

  // Inside the sheet's box, which it is placed in.
  const hoverButton =
    hover && !picking ? (
      <IconButton
        label={t('notes.addAtLine')}
        size="sm"
        className={classes.hoverAdd}
        style={{ top: hover.top, left: hover.left }}
        data-note-add
        onClick={() => addAt(lineAt(hover.place))}
      >
        <IconNotes size={16} />
      </IconButton>
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
        position="bottom-start"
      >
        <Menu.Target>
          <div
            className={classes.menuAnchor}
            style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }}
          />
        </Menu.Target>
        <Menu.Dropdown>
          {menu && (
            <>
              <Menu.Label className={classes.menuLine}>{menu.words}</Menu.Label>
              {canWrite && (
                <Menu.Item
                  leftSection={<IconNotes size={16} />}
                  onClick={() => addAt(menu)}
                >
                  {t('notes.add')}
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
        return here ? (
          <NoteList notes={here} canChange={canChange} onOpen={open} />
        ) : null;
      },
      topNotes:
        shown && top.length > 0 ? (
          <NoteList
            notes={top.map(({ note }) => note)}
            moved={new Set(top.filter((n) => n.moved).map((n) => n.note.id))}
            canChange={canChange}
            onOpen={open}
          />
        ) : null,
    },
    hoverButton,
    overlay,
    /** Starts picking a line, for the ⋯ menu; undefined for whoever can't write notes. */
    startPicking: canWrite ? () => setPicking(true) : undefined,
  };
}

/** Notes at one place on the sheet, quiet beside the song: tapped, one opens to change it. */
function NoteList({
  notes,
  moved,
  canChange,
  onOpen,
}: {
  notes: NoteRecord[];
  /** Notes whose line has gone from the song: shown at the top, with the words they were at. */
  moved?: ReadonlySet<number>;
  canChange: (note: NoteRecord) => boolean;
  onOpen: (note: NoteRecord) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={classes.notes} data-notes>
      {notes.map((note) => {
        const icon =
          note.playlistId !== null ? (
            <IconPlaylist role="img" aria-label={t('notes.playlistMark')} />
          ) : note.todo ? (
            note.doneAt ? (
              <IconSquareCheck role="img" aria-label={t('notes.doneMark')} />
            ) : (
              <IconSquare role="img" aria-label={t('notes.todoMark')} />
            )
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
            </span>
          </>
        );
        return canChange(note) ? (
          <button
            key={note.id}
            data-note-id={note.id}
            type="button"
            className={classes.note}
            data-done={note.doneAt !== null || undefined}
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
