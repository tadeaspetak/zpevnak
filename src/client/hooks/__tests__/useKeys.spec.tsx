import { Button, MantineProvider, Menu } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { useMemo } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useKeys } from '../useKeys.ts';

function Page({ onEscape, onNext }: { onEscape: () => void; onNext: () => void }) {
  useKeys(useMemo(() => ({ Escape: onEscape, ArrowRight: onNext }), [onEscape, onNext]));
  return (
    <Menu>
      <Menu.Target>
        <Button>More</Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item>Edit</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function setup() {
  const onEscape = vi.fn();
  const onNext = vi.fn();
  render(
    <MantineProvider>
      <Page onEscape={onEscape} onNext={onNext} />
    </MantineProvider>,
  );
  return { onEscape, onNext };
}

describe('useKeys', () => {
  it('acts on the page when nothing is open', () => {
    const { onEscape, onNext } = setup();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(onEscape).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('leaves Esc and the arrows to an open menu', async () => {
    const { onEscape, onNext } = setup();
    const trigger = screen.getByRole('button', { name: 'More' });
    fireEvent.click(trigger);
    // On its button, the way a click leaves it…
    fireEvent.keyDown(trigger, { key: 'Escape' });
    // …and inside the menu, the way the keyboard leaves it.
    fireEvent.keyDown(await screen.findByRole('menuitem', { name: 'Edit' }), {
      key: 'ArrowRight',
    });
    expect(onEscape).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });
});
