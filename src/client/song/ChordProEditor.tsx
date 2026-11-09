import {
  Alert,
  List,
  SegmentedControl,
  Spoiler,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useDeferredValue, useMemo, useState } from 'react';
import { parseSong } from '#shared/chordpro/parse.ts';
import { useI18n } from '../i18n/index.tsx';
import classes from './ChordProEditor.module.css';
import { SongSheet } from './SongSheet.tsx';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * ChordPro source beside its live preview: side by side on a wide screen, one at a time on
 * a phone. Parser warnings are listed with their line numbers.
 */
export function ChordProEditor({ value, onChange }: Props) {
  const { t } = useI18n();
  const wide = useMediaQuery('(min-width: 62em)');
  const [view, setView] = useState<'source' | 'preview'>('source');
  const deferred = useDeferredValue(value);
  const song = useMemo(() => parseSong(deferred), [deferred]);
  const missingTitle = !song.meta.title?.trim();

  const source = (
    <Textarea
      aria-label={t('editor.source')}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      autosize
      minRows={18}
      classNames={{ input: classes.source }}
      spellCheck={false}
      autoCapitalize="off"
      autoCorrect="off"
    />
  );
  const preview = (
    <div className={classes.preview} aria-label={t('editor.preview')}>
      <SongSheet song={song} fontScale={0.9} showDiagrams />
    </div>
  );

  return (
    <Stack gap="sm">
      <Spoiler
        maxHeight={0}
        showLabel={t('editor.cheatSheet')}
        hideLabel={t('common.close')}
      >
        <Text size="sm" className={classes.cheatSheet}>
          {t('editor.cheatSheetBody')}
        </Text>
      </Spoiler>
      {(missingTitle || song.warnings.length > 0) && (
        <Alert color="yellow" variant="light" title={t('editor.warnings')}>
          <List size="sm" spacing={2}>
            {missingTitle && <List.Item>{t('editor.noTitle')}</List.Item>}
            {song.warnings.map((w, i) => (
              <List.Item key={i}>
                {t('editor.line', { line: w.line })}: {w.message}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}
      {wide ? (
        <div className={classes.split}>
          {source}
          {preview}
        </div>
      ) : (
        <>
          <SegmentedControl
            fullWidth
            value={view}
            onChange={(v) => setView(v as 'source' | 'preview')}
            data={[
              { value: 'source', label: t('editor.source') },
              { value: 'preview', label: t('editor.preview') },
            ]}
          />
          {view === 'source' ? source : preview}
        </>
      )}
    </Stack>
  );
}
