import {
  createContext,
  Fragment,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { chordIn, type NoteSystem } from '#shared/chordpro/chord.ts';
import { diagramsOf, type Instrument } from '#shared/chordpro/shapes.ts';
import type { Block, Line, Song } from '#shared/chordpro/types.ts';
import { useMediaQuery } from '@mantine/hooks';
import { IconLock } from '@tabler/icons-react';
import { byline } from '../data/songText.ts';
import { useI18n } from '../i18n/index.tsx';
import { ChordDiagram, NoDiagram } from './ChordDiagram.tsx';
import { columnsFit, lineWraps, type TextLine } from './columnsFit.ts';
import { hasChords, isChordOnly, layoutLine } from './layout.ts';
import classes from './SongSheet.module.css';

type Props = {
  song: Song;
  /** 1 = the default size. */
  fontScale: number;
  showDiagrams: boolean;
  /** Chords above the lyrics; false shows the words alone, for singing along. */
  showChords?: boolean;
  /** Kept to a few people (D127): a small lock after the title, as in the lists. */
  isPrivate?: boolean;
  /**
   * Lay the song in its columns where they fit (no line wraps, and the whole song on screen);
   * false for one long column.
   */
  showColumns?: boolean;
  /** How this reader spells chords (D132); the song's own spelling when not given. */
  notation?: NoteSystem;
  /** Whose diagrams (D132). */
  instrument?: Instrument;
};

/**
 * Two columns of 12 song-sized ems (a short line), at 1.125rem each: the narrowest screen, in
 * rems and at the default text size, where they could fit at all. Plus the gap and the edges.
 */
const MIN_COLUMNS_EM = 2 * 12 * 1.125;

/** A chord as the reader spells it (D132); the sheet's lines read it from here. */
const SpellChord = createContext((chord: string) => chord);

function ChordLabel({ chord }: { chord: string }) {
  const spell = useContext(SpellChord);
  // `[*Riff]` is an annotation, shown without its star.
  return chord.startsWith('*') ? chord.slice(1) : spell(chord);
}

function LineView({ line, showChords }: { line: Line; showChords: boolean }) {
  if (line.type === 'comment') {
    return <p className={classes[`comment_${line.style}`]}>{line.text}</p>;
  }
  if (line.type === 'tab') {
    return <pre className={classes.tab}>{line.text || ' '}</pre>;
  }
  if (line.segments.length === 0) {
    return <div className={classes.spacer} aria-hidden />;
  }
  if (!showChords && isChordOnly(line.segments)) {
    // An intro or a riff is nothing to sing.
    return null;
  }
  if (!showChords || !hasChords(line.segments)) {
    return <p className={classes.line}>{line.segments.map((s) => s.text).join('')}</p>;
  }
  const chordOnly = isChordOnly(line.segments);
  const words = layoutLine(line.segments);
  return (
    <p className={chordOnly ? classes.chordLine : classes.line}>
      {words.map((word, w) => (
        <Fragment key={w}>
          {w > 0 && ' '}
          <span className={classes.word}>
            {word.map((col, c) => (
              <span key={c} className={classes.col} data-overhang={col.overhang}>
                <span className={classes.chord}>
                  {col.chord ? <ChordLabel chord={col.chord} /> : ' '}
                </span>
                {/* Empty text under a chord holds the line's height, not a space's width: a
                    chord on a pause ("Svítá, [F] rozum") would stand in three spaces. */}
                {!chordOnly && (
                  <span className={classes.lyric}>{col.text || '\u200b'}</span>
                )}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

function SectionView({
  block,
  showChords,
}: {
  block: Block & { type: 'section' };
  showChords: boolean;
}) {
  const { t } = useI18n();
  // With chords off, a section with nothing to sing (an intro: a label and chords) goes whole.
  const sings = block.lines.some(
    (line) => line.type === 'lyrics' && line.segments.some((seg) => seg.text.trim()),
  );
  if (!showChords && !sings) {
    return null;
  }
  // Every chorus says so, the first as much as a repeat: the bar alone doesn't explain itself.
  const label = block.label ?? (block.kind === 'chorus' ? t('song.chorus') : null);
  return (
    <section
      className={classes[`section_${block.kind}`]}
      data-kind={block.kind}
      data-line={block.line}
    >
      {label && <div className={classes.label}>{label}</div>}
      {block.lines.map((line, i) => (
        <LineView key={i} line={line} showChords={showChords} />
      ))}
    </section>
  );
}

/**
 * Whether a line had to wrap in its column. A line with chords is words side by side, each a
 * box: wrapped, they sit on different rows. Plain text has a line box per row. A tab doesn't
 * wrap: it runs past its column instead.
 */
function wrapped(el: Element, range: Range): boolean {
  if (el instanceof HTMLPreElement) {
    return el.scrollWidth > el.clientWidth + 1;
  }
  const words = el.querySelectorAll(`.${classes.word}`);
  const tops =
    words.length > 0
      ? [...words].map((word) => word.getBoundingClientRect().top)
      : [...range.getClientRects()].map((r) => r.top);
  return lineWraps(tops);
}

/** The text of a song laid out in `copy`, measured from its top. */
function textLines(copy: HTMLElement): TextLine[] {
  const top = copy.getBoundingClientRect().top;
  const range = document.createRange();
  const lines: TextLine[] = [];
  for (const el of copy.querySelectorAll('section > *')) {
    // The text's own extent, not its block's: a short line ends where its words end.
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    if (r.height > 0) {
      lines.push({
        top: r.top - top,
        bottom: r.bottom - top,
        left: r.left,
        right: r.right,
        wrapped: wrapped(el, range),
      });
    }
  }
  return lines;
}

/**
 * Whether the song, laid out in columns, can be read whole (`columnsFit`), measured on `copy`:
 * the song in columns, out of sight. Only the song has to fit, not its title: the toolbar
 * slides away and the title scrolls off as the reader scrolls into the song (D88). Columns that
 * run past the bottom would send the reader back up mid-song for the second one, so then the
 * song stays in one.
 *
 * Every change that moves the answer resizes either the copy (width, text size, chords,
 * transposition) or the page (a bar appearing changes its padding), or slides a bar in or out
 * of the way (D109), so it is measured on those. It can't flip back and forth: switching to
 * columns only ever makes the page shorter.
 */
function useColumnsFit(enabled: boolean) {
  const copy = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(false);
  useLayoutEffect(() => {
    const copyEl = copy.current;
    if (!enabled || !copyEl) {
      setFits(false);
      return;
    }
    const measure = () => {
      const bars = [...document.querySelectorAll('[data-bottom-overlay]')].map((el) =>
        el.getBoundingClientRect(),
      );
      setFits(columnsFit(textLines(copyEl), bars, window.innerHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(copyEl);
    observer.observe(document.body);
    window.addEventListener('resize', measure);
    // Once a bar has finished sliding: measured mid-way, it would be in neither place.
    const slid = (e: TransitionEvent) => {
      if (e.target instanceof Element && e.target.matches('[data-bottom-overlay]')) {
        measure();
      }
    };
    document.addEventListener('transitionend', slid);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      document.removeEventListener('transitionend', slid);
    };
  }, [enabled]);
  return { copy, fits };
}

export function SongSheet({
  song,
  fontScale,
  showDiagrams,
  showColumns = true,
  showChords = true,
  isPrivate = false,
  notation,
  instrument = 'guitar',
}: Props) {
  const { t } = useI18n();
  const spell = (chord: string) =>
    chordIn(chord, song.noteSystem, notation ?? song.noteSystem);
  const style = { '--song-scale': fontScale } as CSSProperties;
  // Any song on any screen, when the reader wants columns and the song fits in them (D108):
  // the text decides, at its size, not the screen's width (D129). Where two columns of even
  // short lines can't fit at this size (a phone held upright), it isn't measured at all: a
  // second copy of the song, laid out on every change, costs a slow phone for nothing.
  const roomForColumns = useMediaQuery(
    `(min-width: ${MIN_COLUMNS_EM * fontScale + 5}em)`,
  );
  const columns = useColumnsFit(showColumns && (roomForColumns ?? false));
  // The key isn't repeated here: the toolbar shows it, and changes it (D59). A capo is not
  // in the toolbar, so it stays.
  const meta = [song.meta.capo ? t('song.capo', { fret: song.meta.capo }) : null].filter(
    Boolean,
  );

  const blocks: ReactNode = song.blocks.map((block, i) => {
    if (block.type === 'columnBreak') {
      return <div key={i} className={classes.columnBreak} aria-hidden />;
    }
    if (block.type === 'chorusRecall') {
      return block.chorus?.type === 'section' ? (
        <SectionView
          key={i}
          block={{
            ...block.chorus,
            label: block.label ?? block.chorus.label,
            line: block.line,
          }}
          showChords={showChords}
        />
      ) : null;
    }
    return <SectionView key={i} block={block} showChords={showChords} />;
  });

  const line = byline(song.artist, song.meta.tags);
  return (
    <SpellChord.Provider value={spell}>
      <article className={classes.sheet} style={style} lang="und">
        <header className={classes.header}>
          <h1 className={classes.title}>
            {song.meta.title}
            {isPrivate && (
              <IconLock
                className={classes.private}
                role="img"
                aria-label={t('songs.privateMark')}
              />
            )}
          </h1>
          {line && <p className={classes.artist}>{line}</p>}
          {meta.length > 0 && <p className={classes.meta}>{meta.join(' · ')}</p>}
        </header>
        {showChords && showDiagrams && (
          <div className={classes.diagrams} aria-label={t('song.diagrams')}>
            {diagramsOf(song, instrument).map(({ chord, shape }) =>
              shape ? (
                <ChordDiagram
                  key={chord}
                  definition={{ ...shape, name: spell(shape.name) }}
                />
              ) : (
                <NoDiagram key={chord} name={spell(chord)} />
              ),
            )}
          </div>
        )}
        <div
          className={columns.fits ? classes.bodyColumns : classes.body}
          data-columns={columns.fits || undefined}
        >
          {blocks}
        </div>
        {showColumns && roomForColumns && (
          // The same song in columns, out of sight and out of reach: only measured.
          <div
            ref={columns.copy}
            className={`${classes.bodyColumns} ${classes.measure}`}
            aria-hidden
            inert
          >
            {blocks}
          </div>
        )}
      </article>
    </SpellChord.Provider>
  );
}
