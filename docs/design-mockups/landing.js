const scene = document.querySelector('.scene');
const experience = document.querySelector('.experience');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarse = window.matchMedia('(pointer: coarse)');
const stages = ['claim', 'data', 'context'];
let index = 0;
let hovering = false;
let focused = false;
let timer;
let visible = true;
function showSlide(nextIndex) {
  index = (nextIndex + stages.length) % stages.length;
  scene.dataset.stage = stages[index];
  scene.setAttribute('aria-label', `Contoh pemeriksaan ADRO, lembar ${index + 1} dari ${stages.length}`);
  ['.front', '.middle', '.rear'].forEach((selector, i) => {
    scene.querySelector(selector).setAttribute('aria-hidden', String(i !== index));
  });
}
function syncMotion() {
  clearInterval(timer);
  const stopped = reduced.matches || document.hidden || !visible || hovering || focused;
  document.body.classList.toggle('paused', stopped);
  if (!stopped) timer = setInterval(() => showSlide(index + 1), 5000);
  scene.style.removeProperty('--rx'); scene.style.removeProperty('--ry');
}
document.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('click', () => { showSlide(index + Number(button.dataset.direction)); syncMotion(); });
});
reduced.addEventListener('change', syncMotion);
document.addEventListener('visibilitychange', syncMotion);
experience.addEventListener('pointerenter', () => { hovering = true; syncMotion(); });
experience.addEventListener('pointerleave', () => { hovering = false; syncMotion(); });
experience.addEventListener('focusin', () => { focused = true; syncMotion(); });
experience.addEventListener('focusout', event => {
  focused = experience.contains(event.relatedTarget); syncMotion();
});
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; syncMotion(); }).observe(scene);
scene.addEventListener('pointermove', event => {
  if (reduced.matches || coarse.matches) return;
  const bounds = scene.getBoundingClientRect();
  scene.style.setProperty('--rx', `${((event.clientX - bounds.left) / bounds.width - .5) * 12}deg`);
  scene.style.setProperty('--ry', `${-((event.clientY - bounds.top) / bounds.height - .5) * 8}deg`);
});
scene.addEventListener('pointerleave', () => { scene.style.removeProperty('--rx'); scene.style.removeProperty('--ry'); });
showSlide(0);
syncMotion();
