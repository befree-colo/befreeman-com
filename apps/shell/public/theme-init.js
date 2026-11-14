/* Runs before first paint (blocking, same-origin): apply the stored or system mode. */
(() => {
  let t = null;
  try {
    t = localStorage.getItem('bf-theme');
  } catch {
    t = null;
  }
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
})();
