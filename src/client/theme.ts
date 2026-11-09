import { createTheme, type CSSVariablesResolver } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'orange',
  primaryShade: { light: 8, dark: 5 },
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  defaultRadius: 'md',
  cursorType: 'pointer',
});

/**
 * Chords: a deep orange on light (5.2:1 on white; Mantine's orange.9 is only 4.3:1), light
 * orange on dark. Secondary text one
 * step darker than Mantine's default, whose gray.6 is 3.3:1 on white and fails WCAG AA.
 */
export const cssVariablesResolver: CSSVariablesResolver = (t) => ({
  variables: {},
  light: { '--chord-color': '#c2410c', '--mantine-color-dimmed': t.colors.gray[7] },
  dark: { '--chord-color': t.colors.orange[4] },
});
