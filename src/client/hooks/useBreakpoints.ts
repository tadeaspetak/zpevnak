import { useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

/**
 * The screen sizes the app lays out for, from the theme's breakpoints: the same ones the CSS
 * uses as `$mantine-breakpoint-*` (postcss.config.cjs). Change them there and in the theme only.
 */

/** Wide enough for two things side by side: song columns, the editor beside its preview. */
export function useWide(): boolean {
  const { breakpoints } = useMantineTheme();
  return useMediaQuery(`(min-width: ${breakpoints.md})`) ?? false;
}

/** A phone held upright. */
export function usePhone(): boolean {
  const { breakpoints } = useMantineTheme();
  return useMediaQuery(`(max-width: ${breakpoints.sm})`) ?? false;
}
