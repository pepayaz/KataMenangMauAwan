const scene = document.querySelector('.scene');
const caption = document.querySelector('.step-caption');
const toggle = document.querySelector('.motion-toggle');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarse = window.matchMedia('(pointer: coarse)');
let paused = reduced.matches;
function setPaused(value) {
  paused = value;
  document.body.classList.toggle('paused', paused);
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.textContent = paused ? 'Aktifkan gerak' : 'Hentikan gerak';
  scene.style.removeProperty('--rx'); scene.style.removeProperty('--ry');
}
setPaused(paused);
toggle.addEventListener('click', () => setPaused(!paused));
reduced.addEventListener('change', () => setPaused(reduced.matches));
document.querySelectorAll('[data-step]').forEach(button => {
  button.addEventListener('click', () => {
    scene.dataset.stage = button.dataset.step;
    document.querySelectorAll('[data-step]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    caption.textContent = {
      claim: 'Pilih Data untuk melihat angka pembanding.',
      data: 'Rata-rata historis dan yield TTM memakai periode berbeda.',
      context: 'Pembayaran khusus dapat mengubah makna angka rata-rata.'
    }[button.dataset.step];
  });
});
scene.addEventListener('pointermove', event => {
  if (paused || reduced.matches || coarse.matches) return;
  const bounds = scene.getBoundingClientRect();
  scene.style.setProperty('--rx', `${((event.clientX - bounds.left) / bounds.width - .5) * 12}deg`);
  scene.style.setProperty('--ry', `${-((event.clientY - bounds.top) / bounds.height - .5) * 8}deg`);
});
scene.addEventListener('pointerleave', () => { scene.style.removeProperty('--rx'); scene.style.removeProperty('--ry'); });
