(function () {
  const section = document.getElementById('about');
  if (!section) return;
  const slides = [...section.querySelectorAll('.about-slide')];
  let current = 0, timer, visible = false;
  function render() {
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === current);
      slide.inert = i !== current;
      slide.setAttribute('aria-hidden', String(i !== current));
    });
    section.querySelector('.about-count').textContent = `0${current + 1} / 03`;
  }
  function schedule() {
    clearTimeout(timer);
    if (visible && !document.hidden) {
      timer = setTimeout(() => {
        current = (current + 1) % slides.length;
        render();
        schedule();
      }, 4500);
    }
  }
  document.addEventListener('visibilitychange', schedule);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    schedule();
  }, { threshold: .15 }).observe(section);
  render();
})();
