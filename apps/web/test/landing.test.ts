// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Landing from '../components/landing';
import { GET as shareGet } from '../app/share/route';
import { shareHandoff } from '../lib/share-input';

let preference: { matches: boolean; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.useFakeTimers();
  preference = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => preference));
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function scene() { return document.querySelector('.scene')!; }

it('animasi aktif sejak awal, panah dua arah dan pergantian otomatis berfungsi', () => {
  render(createElement(Landing));
  expect(screen.getAllByRole('link', { name: 'Periksa klaim' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /pause|Hentikan/i })).toBeNull();
  expect(scene().getAttribute('data-stage')).toBe('claim');
  act(() => vi.advanceTimersByTime(5000));
  expect(scene().getAttribute('data-stage')).toBe('data');
  fireEvent.click(screen.getByRole('button', { name: 'Lembar berikutnya' }));
  expect(scene().getAttribute('data-stage')).toBe('context');
  fireEvent.click(screen.getByRole('button', { name: 'Lembar sebelumnya' }));
  expect(scene().getAttribute('data-stage')).toBe('data');
});
it('fokus keyboard menjeda pergantian otomatis dan tetap mengizinkan panah', () => {
  render(createElement(Landing));
  const next = screen.getByRole('button', { name: 'Lembar berikutnya' });
  fireEvent.focus(next);
  act(() => vi.advanceTimersByTime(10000));
  expect(scene().getAttribute('data-stage')).toBe('claim');
  fireEvent.click(next);
  expect(scene().getAttribute('data-stage')).toBe('data');
  fireEvent.blur(next, { relatedTarget: null });
  act(() => vi.advanceTimersByTime(5000));
  expect(scene().getAttribute('data-stage')).toBe('context');
});
it('reduced motion tidak mengganti lembar otomatis', () => {
  preference.matches = true;
  render(createElement(Landing));
  act(() => vi.advanceTimersByTime(15000));
  expect(scene().getAttribute('data-stage')).toBe('claim');
  fireEvent.click(screen.getByRole('button', { name: 'Lembar berikutnya' }));
  expect(scene().getAttribute('data-stage')).toBe('data');
});
it('share target membawa teks langsung ke checker untuk ditinjau', async () => {
  expect(shareGet().headers.get('Location')).toBe('/check');
  const body = await shareHandoff({ status: 'ready', source: 'share_target', rawText: 'ADRO yield 25,5%', warnings: [] }).text();
  expect(body).toContain("location.replace('/check')");
  expect(body).toContain('cek-dulu-share-input');
});
