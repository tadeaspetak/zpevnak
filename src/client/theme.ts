import {
  Alert,
  createTheme,
  type MantineColorsTuple,
  Modal,
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
  // A subtle button in the brand colour would hover in tinted orange, rust brown in dark mode
  // (D61): it hovers neutral, like every other subtle control.
  if (input.variant === 'subtle' && (!input.color || input.color === 'orange')) {
    return { ...colors, hover: 'var(--mantine-color-default-hover)' };
  }
  if (input.variant === 'outline' && input.color && !input.color.includes('.')) {
    const text = `var(--mantine-color-${input.color}-text)`;
    return { ...colors, color: text, border: `1px solid ${text}` };
  }
  return colors;
};

/**
 * The one brand colour (D61), in one place so it can change, or become a setting. Shade 7 is
 * what buttons are filled with, in both schemes: white on it is 5.2:1 and passes WCAG AA
 * (Mantine's own orange.8 was 3.6:1, its dark-mode orange.5 2.2:1). As text on the dark
 * background it is too dark (3.0:1), so text in the brand colour uses `--brand-text`: shade 7
 * on light, shade 4 on dark (6.9:1).
 */
const BRAND: MantineColorsTuple = [
  '#fff7ed',
  '#ffedd5',
  '#fed7aa',
  '#fdba74',
  '#fb923c',
  '#f97316',
  '#ea580c',
  '#c2410c',
  '#9a3412',
  '#7c2d12',
];

export const theme = createTheme({
  // Replaces Mantine's orange, so `color="orange"` and the primary colour are the same thing.
  colors: { orange: BRAND },
  primaryColor: 'orange',
  primaryShade: { light: 7, dark: 7 },
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  defaultRadius: 'md',
  cursorType: 'pointer',
  variantColorResolver,
  components: {
    // An alert's colour says what kind of message it is: never the brand orange, which in dark
    // mode reads as an error and matches the buttons. Neutral unless a call site says otherwise.
    Alert: Alert.extend({ defaultProps: { color: 'gray' } }),
    // A dialog's subject is its title: a heading, not body text.
    Modal: Modal.extend({
      styles: { title: { fontWeight: 700, fontSize: 'var(--mantine-font-size-lg)' } },
    }),
  },
});

/**
 * The brand colour as text, chords included: the filled shade on light, a lighter one on dark
 * (see BRAND). Secondary text one step darker than Mantine's default, whose gray.6 is 3.3:1 on
 * white and fails WCAG AA.
 */
export const cssVariablesResolver: CSSVariablesResolver = (t) => ({
  variables: { '--chord-color': 'var(--brand-text)' },
  light: {
    '--brand-text': t.colors.orange[7],
    '--mantine-color-dimmed': t.colors.gray[7],
  },
  dark: { '--brand-text': t.colors.orange[4] },
});
