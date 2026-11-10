import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { Block, Line, Song } from '#shared/chordpro/types.ts';
import { useWide } from '../hooks/useBreakpoints.ts';
import { useI18n } from '../i18n/index.tsx';
import { ChordDiagram } from './ChordDiagram.tsx';
import { columnsFit, type Box } from './columnsFit.ts';
import { hasChords, isChordOnly, layoutLine } from './layout.ts';
import classes from './SongSheet.module.css';

type Props = {
  song: Song;
  /** 1 = the default size. */
  fontScale: number;
  showDiagrams: boolean;
  /** Chords above the lyrics; false shows the words alone, for singing along. */
  showChords?: boolean;
  /**
   * Lay the song in its columns where they fit (a wide screen, and the whole song on it);
   * false for one long column.
   */
  showColumns?: boolean;
};

function chordLabel(chord: string) {
  // `[*Riff]` is an annotation, shown without its star.
  return chord.startsWith('*') ? chord.slice(1) : chord;
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
              <span key={c} className={classes.col}>
                <span className={classes.chord}>
                  {col.chord ? chordLabel(col.chord) : ' '}
                </span>
                {!chordOnly && <span className={classes.lyric}>{col.text || ' '}</span>}
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
  recalled,
  showChords,
}: {
  block: Block & { type: 'section' };
  recalled?: boolean;
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
  const label = block.label ?? (recalled ? t('song.chorus') : null);
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

/** The text boxes of a song laid out in `copy`, measured from its top. */
function textBoxes(copy: HTMLElement): Box[] {
  const top = copy.getBoundingClientRect().top;
  const range = document.createRange();
  const boxes: Box[] = [];
  for (const el of copy.querySelectorAll('section > *')) {
    // The text's own extent, not its block's: a short line ends where its words end.
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    if (r.height > 0) {
      boxes.push({
        top: r.top - top,
        bottom: r.bottom - top,
        left: r.left,
        right: r.right,
      });
    }
  }
  return boxes;
}

/**
 * Whether the song, laid out in columns, can be read whole (`columnsFit`), measured on `copy`:
 * the song in columns, out of sight. Only the song has to fit, not its title: the toolbar
 * slides away and the title scrolls off as the reader scrolls into the song (D88). Columns that
 * run past the bottom would send the reader back up mid-song for the second one, so then the
 * song stays in one.
 *
 * Every change that moves the answer resizes either the copy (width, text size, chords,
 * transposition) or the page (a bar appearing changes its padding), so it is measured on
 * those. It can't flip back and forth: switching to columns only ever makes the page shorter.
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
      setFits(columnsFit(textBoxes(copyEl), bars, window.innerHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(copyEl);
    observer.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
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
}: Props) {
  const { t } = useI18n();
  const style = { '--song-scale': fontScale } as CSSProperties;
  const wide = useWide();
  const columns = useColumnsFit(song.columns > 1 && showColumns && wide);
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
          recalled
          showChords={showChords}
        />
      ) : null;
    }
    return <SectionView key={i} block={block} showChords={showChords} />;
  });

  return (
    <article className={classes.sheet} style={style} lang="und">
      <header className={classes.header}>
        <h1 className={classes.title}>{song.meta.title}</h1>
        {song.artist && <p className={classes.artist}>{song.artist}</p>}
        {meta.length > 0 && <p className={classes.meta}>{meta.join(' · ')}</p>}
      </header>
      {showChords && showDiagrams && song.definitions.length > 0 && (
        <div className={classes.diagrams} aria-label={t('song.diagrams')}>
          {song.definitions.map((d) => (
            <ChordDiagram key={d.name} definition={d} />
          ))}
        </div>
      )}
      <div
        className={columns.fits ? classes.bodyColumns : classes.body}
        data-columns={columns.fits || undefined}
      >
        {blocks}
      </div>
      {wide && song.columns > 1 && showColumns && (
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
  );
}
