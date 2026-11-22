import { act, fireEvent, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { renderApp } from '#tests/client/render.tsx';
import { describe, expect, it } from 'vitest';
import { cs } from '../../i18n/cs.ts';
import { ChordProEditor, type ChordProEditorHandle } from '../ChordProEditor.tsx';

function Editor({ initial, template }: { initial: string; template?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <ChordProEditor
      value={value}
      onChange={setValue}
      template={template}
      ref={handle}
      actions={null}
    />
  );
}
const handle = createRef<ChordProEditorHandle>();

function open(initial: string, template?: string) {
  localStorage.setItem('zpevnak.locale', 'cs');
  renderApp(<Editor initial={initial} template={template} />);
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

  it('says a song can just be pasted, and clears the example for it', () => {
    const template = cs['editor.template'].replace('{songTitle}', '');
    const source = open(template, template);
    expect(screen.getByText(/Smaž vzor a vlož ji sem/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Smazat vzor' }));
    expect(source.value).toBe('');
    // Emptied to paste into: no warning about a missing title yet.
    expect(screen.queryByText(/Doplň název/)).toBeNull();
    expect(screen.queryByText(/Smaž vzor a vlož ji sem/)).toBeNull();
  });

  it('says nothing about pasting once the example has been written into', () => {
    const template = cs['editor.template'].replace('{songTitle}', '');
    open(`${template}la`, template);
    expect(screen.queryByText(/Smaž vzor a vlož ji sem/)).toBeNull();
  });
});

describe('ChordProEditor: tags (D118)', () => {
  it('writes a tag typed into the tags field into the text, after the header', () => {
    const source = open('{title: Píseň}\n{key: D}\n\nla la [D]la');
    const tags = screen.getByRole('combobox', { name: 'Štítky' });
    // Focused first, as by a person: Mantine ignores a change to an input without focus.
    act(() => tags.focus());
    fireEvent.change(tags, { target: { value: 'Vánoční' } });
    fireEvent.keyDown(tags, { key: 'Enter' });
    expect(source.value).toBe('{title: Píseň}\n{key: D}\n{tag: Vánoční}\n\nla la [D]la');
  });

  it('shows the text’s tags in the field, and takes a removed one out of the text', () => {
    const source = open('{title: Píseň}\n{tag: Vánoční}\n{tag: Lidová}\nla la');
    expect(screen.getByText('Vánoční')).toBeTruthy();
    // The pill's × is hidden from the keyboard (Backspace removes a tag there); a tap uses it.
    const remove = screen
      .getByText('Lidová')
      .closest('.mantine-Pill-root')
      ?.querySelector('button');
    fireEvent.click(remove as HTMLButtonElement);
    expect(source.value).toBe('{title: Píseň}\n{tag: Vánoční}\nla la');
  });
});
