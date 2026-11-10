import { DIAGRAM_FRETS } from '#shared/chordpro/parse.ts';
import type { ChordDefinition } from '#shared/chordpro/types.ts';
import { useI18n } from '../i18n/index.tsx';
import classes from './SongSheet.module.css';

// The parser lets through only what fits: two strings or more, frets within these.
const FRETS_SHOWN = DIAGRAM_FRETS;
const W = 60;
const H = 76;
const LEFT = 10;
const TOP = 18;
const GRID_W = 42;
const GRID_H = 50;

/** A fretboard diagram for a chord the song defines, low E on the left. */
export function ChordDiagram({ definition }: { definition: ChordDefinition }) {
  const { t } = useI18n();
  const frets = definition.frets.map((f) => (f === null ? 'x' : String(f))).join(' ');
  const label =
    definition.baseFret > 1
      ? t('song.diagramLabelAt', {
          name: definition.name,
          frets,
          fret: definition.baseFret,
        })
      : t('song.diagramLabel', { name: definition.name, frets });
  const strings = definition.frets.length;
  const stringGap = GRID_W / (strings - 1);
  const fretGap = GRID_H / FRETS_SHOWN;
  const atNut = definition.baseFret <= 1;
  return (
    <figure className={classes.diagram}>
      <figcaption className={classes.diagramName}>{definition.name}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {Array.from({ length: FRETS_SHOWN + 1 }, (_, i) => (
          <line
            key={`f${i}`}
            x1={LEFT}
            x2={LEFT + GRID_W}
            y1={TOP + i * fretGap}
            y2={TOP + i * fretGap}
            stroke="currentColor"
            strokeWidth={i === 0 && atNut ? 3 : 0.8}
          />
        ))}
        {definition.frets.map((_, s) => (
          <line
            key={`s${s}`}
            x1={LEFT + s * stringGap}
            x2={LEFT + s * stringGap}
            y1={TOP}
            y2={TOP + GRID_H}
            stroke="currentColor"
            strokeWidth={0.8}
          />
        ))}
        {!atNut && (
          <text
            x={LEFT - 3}
            y={TOP + fretGap * 0.7}
            fontSize={8}
            textAnchor="end"
            fill="currentColor"
          >
            {definition.baseFret}
          </text>
        )}
        {definition.frets.map((fret, s) => {
          const x = LEFT + s * stringGap;
          if (fret === null) {
            return (
              <text
                key={`m${s}`}
                x={x}
                y={TOP - 5}
                fontSize={8}
                textAnchor="middle"
                fill="currentColor"
              >
                ×
              </text>
            );
          }
          if (fret === 0) {
            return (
              <circle
                key={`m${s}`}
                cx={x}
                cy={TOP - 7}
                r={2.4}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.8}
              />
            );
          }
          return (
            <circle
              key={`m${s}`}
              cx={x}
              cy={TOP + (fret - 0.5) * fretGap}
              r={3.4}
              className={classes.diagramDot}
            />
          );
        })}
      </svg>
    </figure>
  );
}
