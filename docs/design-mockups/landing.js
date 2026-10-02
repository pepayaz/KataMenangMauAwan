const scene = document.querySelector('.scene');
const experience = document.querySelector('.experience');
const caption = document.querySelector('.step-caption');
const position = document.querySelector('.slide-position');
const toggle = document.querySelector('.motion-toggle');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarse = window.matchMedia('(pointer: coarse)');
const stages = ['claim', 'data', 'context'];
const captions = [
  'Satu klaim dibaca terpisah dari konteksnya.',
  'Rata-rata historis dan yield TTM memakai periode berbeda.',
  'Pembayaran khusus dapat mengubah makna angka rata-rata.'
];
let index = 0;
let paused = reduced.matches;
let hovering = false;
let focused = false;
let timer;
let visible = true;
function showSlide(nextIndex) {
  index = (nextIndex + stages.length) % stages.length;
  scene.dataset.stage = stages[index];
  caption.textContent = captions[index];
  position.textContent = `${index + 1} / ${stages.length}`;
  position.setAttribute('aria-label', `Lembar ${index + 1} dari ${stages.length}`);
  ['.front', '.middle', '.rear'].forEach((selector, i) => {
    scene.querySelector(selector).setAttribute('aria-hidden', String(i !== index));
  });
}
function syncMotion() {
  clearInterval(timer);
  const stopped = paused || reduced.matches || document.hidden || !visible;
  document.body.classList.toggle('paused', stopped);
  toggle.setAttribute('aria-pressed', String(paused));
  const label = paused ? 'Aktifkan gerak otomatis' : 'Hentikan gerak otomatis';
  // Static SVG children preserve the click target when hover/focus state changes.
  toggle.setAttribute('aria-label', label);
  if (!stopped && !hovering && !focused) timer = setInterval(() => showSlide(index + 1), 5000);
  scene.style.removeProperty('--rx'); scene.style.removeProperty('--ry');
}
document.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('click', () => { showSlide(index + Number(button.dataset.direction)); syncMotion(); });
});
toggle.addEventListener('click', () => { paused = !paused; syncMotion(); });
reduced.addEventListener('change', () => { paused = reduced.matches; syncMotion(); });
document.addEventListener('visibilitychange', syncMotion);
experience.addEventListener('pointerenter', () => { hovering = true; syncMotion(); });
experience.addEventListener('pointerleave', () => { hovering = false; syncMotion(); });
experience.addEventListener('focusin', () => { focused = true; syncMotion(); });
experience.addEventListener('focusout', event => {
  focused = experience.contains(event.relatedTarget); syncMotion();
});
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; syncMotion(); }).observe(scene);
scene.addEventListener('pointermove', event => {
  if (paused || reduced.matches || coarse.matches) return;
  const bounds = scene.getBoundingClientRect();
  scene.style.setProperty('--rx', `${((event.clientX - bounds.left) / bounds.width - .5) * 12}deg`);
  scene.style.setProperty('--ry', `${-((event.clientY - bounds.top) / bounds.height - .5) * 8}deg`);
});
scene.addEventListener('pointerleave', () => { scene.style.removeProperty('--rx'); scene.style.removeProperty('--ry'); });
showSlide(0);
syncMotion();
