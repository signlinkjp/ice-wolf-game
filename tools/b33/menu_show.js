  /* v1.3.0 (Build 33): a sheet that always fits, and a screen the sheet keeps.
   *
   * The play-test's bug: after a match the menu's card was a little taller than
   * the phone, so the sheet scrolled. A tap the browser took for the start of a
   * pan never reached the button, so SETTINGS and PRO lit up under the finger and
   * opened nothing, while the card slid up and down. Two structural answers:
   *   - fitMenuCard() scales the card until the menu fits the phone, so the
   *     sheet has nothing to scroll and a tap cannot become a pan; and
   *   - showOnly() records the screen the player asked for in `sheet.screen`,
   *     and the frame loop puts that screen back if anything painted over it.
   */
  const sheet = { screen: 'menu', zoom: 1 };
  const fitMenuCard = () => {
    if (typeof document === 'undefined') return;
    const el = screen('menu');
    if (!el) return;
    const card = el.querySelector('.iw-card');
    if (!card) return;
    try {
      const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
      const padTop = style ? (parseFloat(style.paddingTop) || 0) : 0;
      const padBottom = style ? (parseFloat(style.paddingBottom) || 0) : 0;
      const available = Math.max(120, (el.clientHeight || 0) - padTop - padBottom);
      const rootStyle = typeof getComputedStyle === 'function' && document.documentElement
        ? getComputedStyle(document.documentElement) : null;
      const uiZoom = rootStyle ? (parseFloat(rootStyle.getPropertyValue('--iw-ui-zoom')) || 1) : 1;
      /* Measured at 1:1 with no height cap, so the answer is the card's real
       * size; then the text-size zoom is kept when it fits and given up, in
       * part, when it does not. */
      card.style.maxHeight = 'none';
      card.style.zoom = '1';
      const natural = (typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect().height : 0)
        || card.scrollHeight || card.offsetHeight || 0;
      if (!natural) { card.style.zoom = ''; card.style.maxHeight = ''; return; }
      const fit = Math.min(uiZoom, (available / natural) * 0.985);
      const zoom = Math.max(0.5, Math.round(fit * 1000) / 1000);
      card.style.zoom = String(zoom);
      el.style.overflowY = 'hidden';
      sheet.zoom = zoom;
    } catch (error) {
      try { card.style.zoom = ''; card.style.maxHeight = ''; } catch (ignored) { /* keep the frame */ }
    }
  };
  if (typeof window !== 'undefined' && !runtimeScene.__iceWolfV130FitBound) {
    runtimeScene.__iceWolfV130FitBound = true;
    const refit = () => { try { fitMenuCard(); } catch (error) { /* keep the frame */ } };
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', refit);
  }
  const showOnly = (name) => {
    for (const el of root.querySelectorAll('.iw-screen')) {
      const visible = el.dataset.screen === name;
      el.classList.toggle('iw-show', visible);
      // v0.7.1: a tall panel always opens at its top, never half-scrolled.
      // v1.3.0: and the sheet itself never keeps a scroll it was left with.
      if (visible) { try { el.scrollTop = 0; } catch (_) {} }
    }
    sheet.screen = name;
    const api = runtimeScene.__iceWolfV065ProductionUi;
    if (api) api.screenName = name;
    if (name === 'menu') fitMenuCard();
  };
