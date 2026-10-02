'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowUpRight, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { adroDividendFixture } from '../../../packages/shared/fixtures';
import { formatEvidence } from '../lib/check-view';
import SiteFooter from './site-footer';

const stages = ['claim', 'data', 'context'] as const;
const average = adroDividendFixture.result.evidence.find(item => item.evidenceId === 'adro-avg')!;
const ttm = adroDividendFixture.result.evidence.find(item => item.evidenceId === 'adro-ttm')!;

export default function Landing() {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  const scene = useRef<HTMLDivElement>(null);
  const deck = useRef<HTMLDivElement>(null);
  const paused = hovered || focused || reduced || !visible || hidden;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduced(preference.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updatePreference(); updateVisibility();
    preference.addEventListener('change', updatePreference);
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting ?? false));
    if (scene.current) observer.observe(scene.current);
    return () => {
      preference.removeEventListener('change', updatePreference);
      document.removeEventListener('visibilitychange', updateVisibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % stages.length), 5000);
    return () => window.clearInterval(timer);
  }, [paused, index]);

  function resetTilt() {
    deck.current?.style.removeProperty('--rx');
    deck.current?.style.removeProperty('--ry');
  }
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    deck.current?.style.setProperty('--rx', `${((event.clientX - bounds.left) / bounds.width - .5) * 12}deg`);
    deck.current?.style.setProperty('--ry', `${-((event.clientY - bounds.top) / bounds.height - .5) * 8}deg`);
  }

  return <div className={`landing${paused ? ' paused' : ''}`}>
    <a className="skip" href="#landing-main">Lewati ke konten</a>
    <header>
      <a className="brand" href="/" aria-label="Cek Dulu beranda"><span className="mark" aria-hidden="true"><CheckCheck size={25} strokeWidth={3} /></span><span className="landing-wordmark">cek<span>dulu</span><span className="brand-period">.</span></span></a>
      <nav aria-label="Navigasi"><a href="/about">Tentang</a></nav>
    </header>
    <main id="landing-main">
      <section className="hero" aria-labelledby="landing-title">
        <div className="intro"><h1 id="landing-title">Klaim saham.<br />Lihat buktinya.</h1><p className="subtitle">Dari konten yang kamu temukan,<br />ke angka dan konteks yang bisa ditelusuri.</p><a className="cta" href="/check">Periksa klaim <ArrowUpRight size={20} aria-hidden="true" /></a></div>
        <div className="experience" onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }} onPointerLeave={() => { setHovered(false); resetTilt(); }}
          onFocusCapture={() => setFocused(true)} onBlurCapture={event => setFocused(event.currentTarget.contains(event.relatedTarget))}>
          <div className="scene" ref={scene} data-stage={stages[index]} aria-label={`Contoh pemeriksaan ADRO, lembar ${index + 1} dari 3`} onPointerMove={tilt}>
            <div className="orbit" aria-hidden="true" />
            <div className="deck" ref={deck}>
              <article className="sheet rear" aria-hidden={index !== 2}><span className="sheet-label">Sumber &amp; periode</span><strong>Angka punya konteks.</strong><p>Pembayaran khusus dan ketersediaan data ikut diperiksa.</p><span className="stamp">Konteks</span></article>
              <article className="sheet middle" aria-hidden={index !== 1}><span className="sheet-label">Pembanding</span><strong>{formatEvidence(average)} <small>vs</small> {formatEvidence(ttm)}</strong><div className="bars" aria-hidden="true"><i /><i style={{ width: `${Number(ttm.value) / Number(average.value) * 100}%` }} /></div><p>Angka rata-rata dari sumber ≠ yield TTM.</p><p className="sheet-foot">Contoh historis · bukan data terkini</p></article>
              <article className="sheet front" aria-hidden={index !== 0}><div className="sheet-heading"><span className="sheet-label">Contoh klaim</span><span className="ticker">ADRO</span></div><blockquote>“Yield {formatEvidence(average)}<br />setahun.”</blockquote><p className="sheet-foot">Contoh historis · bukan data terkini</p></article>
            </div>
            <div className="carousel-controls" role="group" aria-label="Jelajahi contoh">
              <button type="button" className="arrow" data-direction="-1" aria-label="Lembar sebelumnya" onClick={() => setIndex(current => (current + 2) % 3)}><ChevronLeft aria-hidden="true" /></button>
              <button type="button" className="arrow" data-direction="1" aria-label="Lembar berikutnya" onClick={() => setIndex(current => (current + 1) % 3)}><ChevronRight aria-hidden="true" /></button>
            </div>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
