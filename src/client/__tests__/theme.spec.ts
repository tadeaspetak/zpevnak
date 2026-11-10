import { DEFAULT_THEME, type MantineTheme, mergeMantineTheme } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import { theme } from '../theme.ts';

const full = mergeMantineTheme(DEFAULT_THEME, theme) as MantineTheme;
const brand = full.colors.orange;

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('the brand colour passes WCAG AA (D103)', () => {
  const shade = full.primaryShade as { light: number; dark: number };
  const light = { body: '#ffffff', text: brand[7] };
  const dark = { body: full.colors.dark[7], text: brand[4] };

  it('white on a filled button, in both schemes', () => {
    expect(contrast('#ffffff', brand[shade.light] as string)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', brand[shade.dark] as string)).toBeGreaterThanOrEqual(4.5);
  });

  it('as text (--brand-text, chords) on each background', () => {
    expect(contrast(light.text, light.body)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.text, dark.body)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('variant colours', () => {
  const resolve = (variant: string, color: string) =>
    full.variantColorResolver({ variant, color, theme: full });

  it('outline takes its colour’s text shade: a red outline read as white in dark mode (D66)', () => {
    expect(resolve('outline', 'red')).toMatchObject({
      color: 'var(--mantine-color-red-text)',
      border: '1px solid var(--mantine-color-red-text)',
    });
  });

  it('subtle in the brand colour hovers neutral, not tinted orange (D83)', () => {
    expect(resolve('subtle', 'orange').hover).toBe('var(--mantine-color-default-hover)');
  });
});
