import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '#tests/client/render.tsx';
import { SignUpPage } from '../AuthPages.tsx';

describe('SignUpPage', () => {
  it('keeps what is typed, keystroke after keystroke (it crashed on the second)', () => {
    localStorage.setItem('zpevnak.locale', 'cs');
    renderApp(<SignUpPage />, { path: '/signup' });
    const name = screen.getByRole<HTMLInputElement>('textbox', { name: /Jméno/ });
    fireEvent.change(name, { target: { value: 'B' } });
    fireEvent.change(name, { target: { value: 'Bá' } });
    const email = screen.getByRole<HTMLInputElement>('textbox', { name: /E-mail/ });
    fireEvent.change(email, { target: { value: 'b@example.com' } });
    expect(name.value).toBe('Bá');
    expect(email.value).toBe('b@example.com');
  });
});
