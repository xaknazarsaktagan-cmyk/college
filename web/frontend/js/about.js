(function () {
  const section = document.getElementById('about');
  if (!section) return;
  const slides = [...section.querySelectorAll('.about-slide')];
  const tabs = [...section.querySelectorAll('[data-slide]')];
  const pause = section.querySelector('.about-pause');
  let current = 0, timer, visible = false, paused = false;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  paused = reduced.matches;
  function render() {
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === current);
      slide.inert = i !== current;
      slide.setAttribute('aria-hidden', String(i !== current));
    });
    tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === current)));
    section.querySelector('.about-count').textContent = `0${current + 1} / 03`;
    const key = paused ? 'about.play' : 'about.pause';
    pause.dataset.i18n = key;
    pause.textContent = tr(key);
  }
  function schedule() {
    clearTimeout(timer);
    if (visible && !paused && !document.hidden && !section.contains(document.activeElement)) {
      timer = setTimeout(() => { current = (current + 1) % slides.length; render(); schedule(); }, 6000);
    }
  }
  tabs.forEach((tab, i) => tab.addEventListener('click', () => { current = i; render(); schedule(); }));
  pause.addEventListener('click', () => { paused = !paused; render(); schedule(); });
  section.addEventListener('focusin', schedule);
  section.addEventListener('focusout', () => setTimeout(schedule, 0));
  document.addEventListener('visibilitychange', schedule);
  addEventListener('abit-lang', () => { render(); schedule(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; render(); schedule(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); }, { threshold: .15 }).observe(section);
  render();
})();
