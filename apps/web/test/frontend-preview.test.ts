// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IntelligencePreview } from '../../../frontend/src/App';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('mengganti contoh verdict otomatis dan menyediakan pemilih semua status', () => {
  render(createElement(IntelligencePreview));
  expect(screen.getByText('“Yield 25,5% setahun”')).toBeDefined();
  expect(screen.getAllByRole('button', { name: /Tampilkan contoh/i })).toHaveLength(5);

  act(() => vi.advanceTimersByTime(4500));
  expect(screen.getByText('“PER BBCA cuma 3x”')).toBeDefined();
  expect(screen.getByText('DIBANTAH')).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Tampilkan contoh tidak bisa diverifikasi' }));
  expect(screen.getByText('“Laba GOTO naik 200% kuartal ini”')).toBeDefined();
  expect(screen.getByText('TIDAK BISA DIVERIFIKASI')).toBeDefined();
});
