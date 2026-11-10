import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDraft } from '../useDraft.ts';

const stored = (key: string) => localStorage.getItem(`zpevnak.draft:${key}`);

describe('useDraft', () => {
  afterEach(() => localStorage.clear());

  it('starts from the original, with nothing to keep', () => {
    const { result } = renderHook(() => useDraft('new', 'template'));
    expect(result.current).toMatchObject({
      source: 'template',
      dirty: false,
      restored: false,
    });
  });

  it('keeps what is typed on the device, and brings it back on the next visit', () => {
    const first = renderHook(() => useDraft('edit:7', 'saved'));
    act(() => first.result.current.setSource('la la'));
    expect(first.result.current).toMatchObject({
      source: 'la la',
      dirty: true,
      restored: false,
    });
    expect(stored('edit:7')).toBe('la la');
    first.unmount();

    const again = renderHook(() => useDraft('edit:7', 'saved'));
    expect(again.result.current).toMatchObject({
      source: 'la la',
      dirty: true,
      restored: true,
    });
  });

  it('forgets the draft once it is cleared', () => {
    const { result } = renderHook(() => useDraft('new', 'template'));
    act(() => result.current.setSource('la la'));
    act(() => result.current.clear());
    expect(result.current).toMatchObject({ source: 'template', dirty: false });
    expect(stored('new')).toBeNull();
  });

  it('forgets the draft when it is typed back to the original', () => {
    const { result } = renderHook(() => useDraft('new', 'template'));
    act(() => result.current.setSource('la la'));
    act(() => result.current.setSource('template'));
    expect(result.current.dirty).toBe(false);
    expect(stored('new')).toBeNull();
  });

  it('ignores a draft that matches what was saved since', () => {
    localStorage.setItem('zpevnak.draft:edit:7', 'saved');
    const { result } = renderHook(() => useDraft('edit:7', 'saved'));
    expect(result.current).toMatchObject({ dirty: false, restored: false });
  });

  it('keeps one draft per song when the page moves on to another', () => {
    localStorage.setItem('zpevnak.draft:review:2', 'lo lo');
    const { result, rerender } = renderHook(
      ({ id }) => useDraft(`review:${id}`, 'saved'),
      {
        initialProps: { id: 1 },
      },
    );
    act(() => result.current.setSource('la la'));
    rerender({ id: 2 });
    expect(result.current).toMatchObject({ source: 'lo lo', restored: true });
    expect(stored('review:1')).toBe('la la');
  });
});
