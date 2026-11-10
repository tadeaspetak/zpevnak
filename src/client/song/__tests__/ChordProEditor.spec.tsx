import { act, fireEvent, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { renderApp } from '#tests/client/render.tsx';
import { describe, expect, it } from 'vitest';
import { cs } from '../../i18n/cs.ts';
import { ChordProEditor, type ChordProEditorHandle } from '../ChordProEditor.tsx';

function Editor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <ChordProEditor value={value} onChange={setValue} ref={handle} actions={null} />;
}
const handle = createRef<ChordProEditorHandle>();

function open(initial: string) {
  localStorage.setItem('zpevnak.locale', 'cs');
  renderApp(<Editor initial={initial} />);
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'ChordPro' });
}

describe('ChordProEditor', () => {
  it('offers to convert chords above the lyrics, and converts them', () => {
    const source = open('{title: Píseň}\nC     G\nla la la lo\n');
    fireEvent.click(screen.getByRole('button', { name: 'Převést' }));
    expect(source.value).toBe('{title: Píseň}\n[C]la la [G]la lo\n');
    expect(screen.queryByRole('button', { name: 'Převést' })).toBeNull();
  });

  it('leaves the text alone when told to', () => {
    const source = open('{title: Píseň}\nC     G\nla la la lo\n');
    fireEvent.click(screen.getByRole('button', { name: 'Nechat' }));
    expect(source.value).toBe('{title: Píseň}\nC     G\nla la la lo\n');
    expect(screen.queryByRole('button', { name: 'Převést' })).toBeNull();
  });

  it('offers nothing for ChordPro', () => {
    open('{title: Píseň}\n[C]la la [G]la lo\n');
    expect(screen.queryByRole('button', { name: 'Převést' })).toBeNull();
  });

  it('says what is wrong in the reader’s language, by line', () => {
    open('{title: Píseň}\n{capo: druhý}\n');
    expect(
      screen.getByRole('button', { name: /Řádek 2: Capo „druhý“ není číslo pražce/i }),
    ).toBeTruthy();
  });

  it('warns nothing about the untouched template, until a save asks for the title', () => {
    const template = cs['editor.template'].replace('{songTitle}', '');
    open(template);
    expect(screen.queryByText(/Doplň název/)).toBeNull();
    act(() => {
      handle.current?.checkTitle();
    });
    expect(screen.getByText(/Doplň název/)).toBeTruthy();
  });

  it('stops a song without a title, and lets one with a title through', () => {
    open('{title: }\nla la\n');
    expect(handle.current?.checkTitle()).toBe(false);
    fireEvent.change(screen.getByRole('textbox', { name: 'ChordPro' }), {
      target: { value: '{title: Píseň}\nla la\n' },
    });
    expect(handle.current?.checkTitle()).toBe(true);
  });
});
