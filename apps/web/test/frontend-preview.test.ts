// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App, { EvidenceRequirements, IntelligencePreview } from '../../../frontend/src/App';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  vi.stubGlobal('scrollTo', vi.fn());
  localStorage.clear();
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

it('menjelaskan input pengguna dan evidence yang dicari backend', () => {
  render(createElement(EvidenceRequirements));

  expect(screen.getByRole('heading', { name: 'Supaya klaim bisa diperiksa' })).toBeDefined();
  expect(screen.getByText('Kamu tidak perlu mencari bukti sendiri. Tulis klaim dengan jelas, lalu Cek Dulu mencari data pembanding dari Sectors.')).toBeDefined();
  expect(screen.getByText('Ticker atau nama perusahaan')).toBeDefined();
  const trigger = screen.getByRole('button', { name: 'Evidence apa yang akan dicari?' });
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.querySelector('#evidence-requirements-content')?.getAttribute('aria-hidden')).toBe('true');

  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(document.querySelector('#evidence-requirements-content')?.getAttribute('aria-hidden')).toBe('false');
  expect(screen.getByText('Harga awal dan akhir pada periode yang sama')).toBeDefined();
  expect(screen.queryByText('Rasio terbaru yang sesuai dengan klaim')).toBeNull();

  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByText('Rasio terbaru yang sesuai dengan klaim')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Evidence berikutnya' }));
  expect(screen.getByText('Yield, pembayaran, dan periode dividen')).toBeDefined();
});

it('menghapus draft ketika pengguna berpindah halaman', () => {
  render(createElement(App, { initialPage: 'check' }));
  const editor = screen.getByLabelText('KLAIM SAHAM / RAW TEXT') as HTMLTextAreaElement;
  fireEvent.change(editor, { target: { value: 'BBRI turun 7,4% sebulan terakhir' } });
  expect(editor.value).toContain('BBRI');

  fireEvent.click(screen.getByRole('button', { name: /Riwayat/ }));
  fireEvent.click(screen.getByRole('button', { name: /Cek klaim/ }));

  expect((screen.getByLabelText('KLAIM SAHAM / RAW TEXT') as HTMLTextAreaElement).value).toBe('');
});
