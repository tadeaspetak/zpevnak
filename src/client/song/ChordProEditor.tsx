import {
  Alert,
  Button,
  Collapse,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconHistory,
  IconWand,
} from '@tabler/icons-react';
import {
  type ReactNode,
  type Ref,
  useDeferredValue,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  fromChordsOverLyrics,
  looksLikeChordsOverLyrics,
} from '#shared/chordpro/fromChordsOverLyrics.ts';
import { parseSong } from '#shared/chordpro/parse.ts';
import { useI18n } from '../i18n/index.tsx';
import classes from './ChordProEditor.module.css';
import { SongSheet } from './SongSheet.tsx';

export type ChordProEditorHandle = {
  /** False, with the caret put in the title, when the song has none to be saved under. */
  checkTitle: () => boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** The page's buttons, in a bar that stays on screen however long the song is. */
  actions: ReactNode;
  /** Set when the text is a draft left from an earlier visit: offers to throw it away. */
  onDiscardDraft?: () => void;
  ref?: Ref<ChordProEditorHandle>;
};

const CHEAT_SHEET = ['header', 'chord', 'chorus', 'repeat'] as const;
const TITLE_LINE = /^\s*\{(?:title|t)\s*:/;

/**
 * ChordPro source beside its live preview: side by side on a wide screen, one at a time on
 * a phone. Parser warnings are listed with their line numbers, and lead to the line.
 */
export function ChordProEditor({ value, onChange, actions, onDiscardDraft, ref }: Props) {
  const { t } = useI18n();
  const wide = useMediaQuery('(min-width: 62em)');
  const [view, setView] = useState<'source' | 'preview'>('source');
  const [cheatSheet, { toggle: toggleCheatSheet }] = useDisclosure(false);
  const [keepAsIs, setKeepAsIs] = useState(false);
  const [titleAsked, setTitleAsked] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const deferred = useDeferredValue(value);
  const song = useMemo(() => parseSong(deferred), [deferred]);
  const offerConversion = useMemo(
    () => !keepAsIs && looksLikeChordsOverLyrics(deferred),
    [keepAsIs, deferred],
  );
  // Not on the untouched template: nobody has had a chance to fill it in yet.
  const missingTitle =
    !song.meta.title?.trim() &&
    (titleAsked || deferred !== t('editor.template', { songTitle: '' }));

  const goToLine = (line: number) => {
    setView('source');
    const lines = value.split('\n');
    const start = lines.slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
    const text = lines[line - 1] ?? '';
    // An empty `{title: }` gets the caret where the title goes; anything else, the whole line.
    const emptyTitle = /^\s*\{(?:title|t)\s*:\s*\}$/.test(text);
    const end = start + text.length;
    const [from, to] = emptyTitle ? [end - 1, end - 1] : [start, end];
    // After the source is shown: on a phone it may have been the preview.
    requestAnimationFrame(() => {
      const el = textarea.current;
      if (!el) {
        return;
      }
      el.focus({ preventScroll: true });
      el.setSelectionRange(from, to);
      const style = getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight) || 21;
      const top =
        el.getBoundingClientRect().top +
        window.scrollY +
        parseFloat(style.paddingTop) +
        (line - 1) * lineHeight;
      window.scrollTo({ top: top - window.innerHeight / 3, behavior: 'smooth' });
    });
  };

  useImperativeHandle(ref, () => ({
    checkTitle: () => {
      if (parseSong(value).meta.title?.trim()) {
        return true;
      }
      setTitleAsked(true);
      goToLine(value.split('\n').findIndex((l) => TITLE_LINE.test(l)) + 1 || 1);
      return false;
    },
  }));

  const convert = () => {
    const converted = fromChordsOverLyrics(value);
    const el = textarea.current;
    // Typed in as if pasted, so the browser's undo brings the original back.
    if (el && typeof document.execCommand === 'function') {
      el.focus();
      el.select();
      if (document.execCommand('insertText', false, converted)) {
        return;
      }
    }
    onChange(converted);
  };

  const source = (
    <Textarea
      ref={textarea}
      aria-label={t('editor.source')}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      onPaste={() => setKeepAsIs(false)}
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
      <div>
        <UnstyledButton
          onClick={toggleCheatSheet}
          aria-expanded={cheatSheet}
          className={classes.cheatSheetToggle}
        >
          <Group gap={4} wrap="nowrap">
            <Text size="sm" fw={500} span>
              {t('editor.cheatSheet')}
            </Text>
            <IconChevronDown size={16} data-open={cheatSheet || undefined} />
          </Group>
        </UnstyledButton>
        <Collapse expanded={cheatSheet}>
          <dl className={classes.cheatSheet}>
            {CHEAT_SHEET.map((row) => (
              <div key={row}>
                <dt>{t(`editor.cheat.${row}.code`)}</dt>
                <dd>{t(`editor.cheat.${row}.what`)}</dd>
              </div>
            ))}
          </dl>
          <Text size="sm" c="dimmed">
            {t('editor.cheat.paste')}
          </Text>
        </Collapse>
      </div>
      {onDiscardDraft && (
        <Alert
          variant="default"
          icon={<IconHistory size={18} />}
          className={classes.notice}
        >
          <Group justify="space-between" gap="xs">
            <Text size="sm">{t('editor.draftRestored')}</Text>
            <Button size="sm" variant="default" onClick={onDiscardDraft}>
              {t('editor.discardDraft')}
            </Button>
          </Group>
        </Alert>
      )}
      {offerConversion && (
        <Alert variant="default" icon={<IconWand size={18} />} className={classes.notice}>
          <Group justify="space-between" gap="xs">
            <Text size="sm">{t('editor.convertOffer')}</Text>
            <Group gap="xs">
              <Button size="sm" variant="default" onClick={() => setKeepAsIs(true)}>
                {t('editor.keepAsIs')}
              </Button>
              <Button size="sm" onClick={convert}>
                {t('editor.convert')}
              </Button>
            </Group>
          </Group>
        </Alert>
      )}
      {(missingTitle || song.warnings.length > 0) && (
        <Alert
          variant="default"
          icon={<IconAlertTriangle size={18} className={classes.warningIcon} />}
          title={t('editor.warnings')}
          className={classes.notice}
        >
          <ul className={classes.warnings}>
            {missingTitle && (
              <li>
                <Text size="sm">{t('editor.noTitle')}</Text>
              </li>
            )}
            {song.warnings.map((w, i) => (
              <li key={i}>
                <UnstyledButton
                  onClick={() => goToLine(w.line)}
                  className={classes.warning}
                >
                  <Text size="sm" span fw={500}>
                    {t('editor.line', { line: w.line })}:
                  </Text>{' '}
                  <Text size="sm" span>
                    {t(`parse.${w.code}`, w)}
                  </Text>
                </UnstyledButton>
              </li>
            ))}
          </ul>
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
      {/* The bar stays on screen, so a long song never hides the buttons. */}
      <Group justify="flex-end" gap="xs" className={classes.actions}>
        {actions}
      </Group>
    </Stack>
  );
}
