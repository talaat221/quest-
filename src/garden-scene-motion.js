// CSS handles every frame; JS only pauses motion when it cannot be seen.
export function observeGardenVisibility(element) {
  if (!element) return () => {};

  let inView = true;
  const update = () => {
    element.style.setProperty(
      '--garden-motion-state',
      !document.hidden && inView ? 'running' : 'paused',
    );
  };

  const observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        if (!entries[0]) return;
        inView = entries[0].isIntersecting;
        update();
      }, { threshold: 0 })
    : null;

  observer?.observe(element);
  document.addEventListener('visibilitychange', update);
  update();

  return () => {
    observer?.disconnect();
    document.removeEventListener('visibilitychange', update);
  };
}
