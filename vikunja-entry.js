/* Trial-only integration: native OS view switching, no data or credential bridge. */
(() => {
  const section = document.getElementById('vikunja');
  const frame = document.getElementById('vikunja-trial-frame');
  if (!section || !frame) return;
  function sync() {
    if (section.classList.contains('activeView')) {
      if (!frame.hasAttribute('src')) frame.src = 'vikunja/';
    } else frame.removeAttribute('src');
  }
  const observer = new MutationObserver(sync);
  observer.observe(section, {attributes: true, attributeFilter: ['class']});
  window.addEventListener('pagehide', () => {observer.disconnect(); frame.removeAttribute('src');}, {once: true});
  window.addEventListener('pageshow', event => {if(event.persisted){observer.observe(section, {attributes: true, attributeFilter: ['class']});sync();}});
  sync();
})();
