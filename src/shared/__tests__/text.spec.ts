import { describe, expect, it } from 'vitest';
import { fold, slugify } from '../text.ts';

describe('fold', () => {
  it('drops Czech diacritics and case', () => {
    expect(fold('Šlapej dál, Kočky, ŘÍJEN, Ůl')).toBe('slapej dal, kocky, rijen, ul');
  });
});

describe('slugify', () => {
  it('makes a readable URL part', () => {
    expect(slugify('Lajla tov (Dobrou noc) Zuzana Navarová & KOA')).toBe(
      'lajla-tov-dobrou-noc-zuzana-navarova-koa',
    );
  });

  it('never starts or ends with a dash, and stays short', () => {
    expect(slugify('  ¡Hola!  ')).toBe('hola');
    expect(slugify('x'.repeat(200))).toHaveLength(80);
    // Cut at a space: the cut must not leave a dash behind.
    expect(slugify(`${'a'.repeat(79)} bcd`)).toBe('a'.repeat(79));
  });
});
