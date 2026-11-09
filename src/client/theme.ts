import {
  Alert,
  createTheme,
  defaultVariantColorsResolver,
  type CSSVariablesResolver,
  type VariantColorsResolver,
} from '@mantine/core';

/**
 * Outline buttons take their colour's text shade, which Mantine picks per colour scheme. Its
 * own outline in dark mode is the palest shade (red.0): a red outline read as white.
 */
const variantColorResolver: VariantColorsResolver = (input) => {
  const colors = defaultVariantColorsResolver(input);
  if (input.variant === 'outline' && input.color && !input.color.includes('.')) {
    const text = `var(--mantine-color-${input.color}-text)`;
    return { ...colors, color: text, border: `1px solid ${text}` };
  }
  return colors;
};

export const theme = createTheme({
  primaryColor: 'orange',
  primaryShade: { light: 8, dark: 5 },
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  defaultRadius: 'md',
  cursorType: 'pointer',
  variantColorResolver,
  components: {
    // An alert's colour says what kind of message it is: never the brand orange, which in dark
    // mode reads as an error and matches the buttons. Neutral unless a call site says otherwise.
    Alert: Alert.extend({ defaultProps: { color: 'gray' } }),
  },
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
