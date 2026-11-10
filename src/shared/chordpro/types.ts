import type { NoteSystem } from './chord.ts';

/** One run of lyrics, optionally starting with a chord. `[Am]text` is `{ chord: 'Am', text: 'text' }`. */
export type Segment = {
  chord: string | null;
  text: string;
};

export type Line =
  | { type: 'lyrics'; segments: Segment[] }
  | { type: 'comment'; text: string; style: 'plain' | 'italic' | 'box' }
  | { type: 'tab'; text: string };

export type SectionKind = 'verse' | 'chorus' | 'bridge' | 'tab' | 'grid' | 'other';

export type Block =
  | {
      type: 'section';
      kind: SectionKind;
      /** The environment's own name for `other` (`outro`, `intro`, …). */
      name: string | null;
      label: string | null;
      lines: Line[];
      /** The source line it starts on, so an editor can show the part being typed. */
      line: number;
    }
  /** `{chorus}`: repeat the last chorus. `chorus` is a copy of it, null if none came before. */
  | { type: 'chorusRecall'; label: string | null; chorus: Block | null; line: number }
  | { type: 'columnBreak' };

export type ChordDefinition = {
  name: string;
  baseFret: number;
  /** One entry per string, low to high. null = not played (x). 0 = open. */
  frets: (number | null)[];
  fingers: (number | null)[] | null;
};

export type SongMeta = {
  title: string | null;
  subtitle: string | null;
  artists: string[];
  key: string | null;
  capo: number | null;
  tempo: string | null;
  time: string | null;
  tags: string[];
};

/**
 * Something in the source the song leaves out or reads its own way. A code with its values, not
 * prose: the editor says it in the reader's language (`parse.<code>`).
 */
export type ParseWarning =
  | {
      line: number;
      code: 'startInsideSection' | 'endWithoutStart' | 'endMismatch';
      directive: string;
    }
  | { line: number; code: 'unsupported'; directive: string }
  | { line: number; code: 'capoNotNumber'; value: string }
  | { line: number; code: 'chorusBeforeAny' | 'sectionNeverClosed' | 'chordNoName' }
  | { line: number; code: 'chordNoFrets'; chord: string };

export type Song = {
  meta: SongMeta;
  /** The artist to show and search by: `{artist}`, falling back to `{subtitle}`. */
  artist: string | null;
  noteSystem: NoteSystem;
  columns: number;
  definitions: ChordDefinition[];
  blocks: Block[];
  warnings: ParseWarning[];
};
