import { Fragment, type CSSProperties } from 'react';
import type { Block, Line, Song } from '#shared/chordpro/types.ts';
import { useI18n } from '../i18n/index.tsx';
import { ChordDiagram } from './ChordDiagram.tsx';
import { hasChords, isChordOnly, layoutLine } from './layout.ts';
import classes from './SongSheet.module.css';

type Props = {
  song: Song;
  /** 1 = the default size. */
  fontScale: number;
  showDiagrams: boolean;
  /** Lay the song in its columns where they fit; false for one long column. */
  showColumns?: boolean;
};

function chordLabel(chord: string) {
  // `[*Riff]` is an annotation, shown without its star.
  return chord.startsWith('*') ? chord.slice(1) : chord;
}

function LineView({ line }: { line: Line }) {
  if (line.type === 'comment') {
    return <p className={classes[`comment_${line.style}`]}>{line.text}</p>;
  }
  if (line.type === 'tab') {
    return <pre className={classes.tab}>{line.text || ' '}</pre>;
  }
  if (line.segments.length === 0) {
    return <div className={classes.spacer} aria-hidden />;
  }
  if (!hasChords(line.segments)) {
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
}: {
  block: Block & { type: 'section' };
  recalled?: boolean;
}) {
  const { t } = useI18n();
  const label = block.label ?? (recalled ? t('song.chorus') : null);
  return (
    <section className={classes[`section_${block.kind}`]} data-kind={block.kind}>
      {label && <div className={classes.label}>{label}</div>}
      {block.lines.map((line, i) => (
        <LineView key={i} line={line} />
      ))}
    </section>
  );
}

export function SongSheet({ song, fontScale, showDiagrams, showColumns = true }: Props) {
  const { t } = useI18n();
  const style = { '--song-scale': fontScale } as CSSProperties;
  // The key isn't repeated here: the toolbar shows it, and changes it (D59). A capo is not
  // in the toolbar, so it stays.
  const meta = [song.meta.capo ? t('song.capo', { fret: song.meta.capo }) : null].filter(
    Boolean,
  );

  return (
    <article className={classes.sheet} style={style} lang="und">
      <header className={classes.header}>
        <h1 className={classes.title}>{song.meta.title}</h1>
        {song.artist && <p className={classes.artist}>{song.artist}</p>}
        {meta.length > 0 && <p className={classes.meta}>{meta.join(' · ')}</p>}
      </header>
      {showDiagrams && song.definitions.length > 0 && (
        <div className={classes.diagrams} aria-label={t('song.diagrams')}>
          {song.definitions.map((d) => (
            <ChordDiagram key={d.name} definition={d} />
          ))}
        </div>
      )}
      <div
        className={song.columns > 1 && showColumns ? classes.bodyColumns : classes.body}
      >
        {song.blocks.map((block, i) => {
          if (block.type === 'columnBreak') {
            return <div key={i} className={classes.columnBreak} aria-hidden />;
          }
          if (block.type === 'chorusRecall') {
            return block.chorus?.type === 'section' ? (
              <SectionView
                key={i}
                block={{ ...block.chorus, label: block.label ?? block.chorus.label }}
                recalled
              />
            ) : null;
          }
          return <SectionView key={i} block={block} />;
        })}
      </div>
    </article>
  );
}
