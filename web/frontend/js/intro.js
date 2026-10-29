(function () {
  const story = document.getElementById('intro-story');
  if (!story) return;
  const scenes = [...story.querySelectorAll('.intro-scene')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = n => Math.max(0, Math.min(1, n));
  let scheduled = false;
  function update() {
    scheduled = false;
    if (reduced.matches) return;
    const header = document.querySelector('.site-header');
    story.style.setProperty('--intro-top', `${header ? header.offsetHeight : 0}px`);
    const stage = story.querySelector('.intro-stage');
    const top = parseFloat(getComputedStyle(stage).top) || 0;
    const span = story.offsetHeight - stage.offsetHeight;
    const progress = clamp((top - story.getBoundingClientRect().top) / Math.max(span, 1));
    const second = clamp((progress - .22) / .16);
    const third = clamp((progress - .62) / .16);
    const opacity = [1 - second, second * (1 - third), third];
    scenes.forEach((scene, i) => {
      scene.style.opacity = opacity[i];
      scene.style.transform = `translateY(${(1-opacity[i])*24}px)`;
      scene.inert = opacity[i] < .5;
      scene.setAttribute('aria-hidden', String(opacity[i] < .5));
    });
    story.style.setProperty('--progress', progress);
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }
  function configure() {
    story.classList.toggle('story-ready', !reduced.matches);
    scenes.forEach(scene => {
      scene.style.removeProperty('opacity');
      scene.style.removeProperty('transform');
      scene.inert = false;
      scene.removeAttribute('aria-hidden');
    });
    schedule();
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  reduced.addEventListener('change', configure);
  configure();
})();
