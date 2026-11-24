  /* v1.3.0 (Build 33): one tap, taken at the root.
   *
   * Build 32 listened on each button's own pointerdown. That is the gesture a
   * browser is free to claim for a pan of a scrollable sheet: when it does, the
   * pointerdown never arrives, the button only shows its :hover colour, and the
   * tap is spent on scrolling the card - exactly what the play-test recorded on
   * SETTINGS and PRO after a match. The sheet now takes the tap itself, in the
   * capture phase, from pointerdown, touchstart or click (whichever reaches it
   * first on that WebView), once per tap, for the actions the menu owns. A chip
   * that another block owns keeps its own gesture untouched.
   */
  const MENU_ACTIONS = ['start', 'newRound', 'mainMenu', 'stage', 'online', 'how', 'record',
    'settings', 'pro', 'language', 'back', 'soundToggle', 'cameraPref',
    'roleRandom', 'roleWolf', 'roleHuman', 'time120', 'time180', 'time300',
    'switchEscape', 'trapAuto', 'trapAlways', 'trapOff'];
  const runMenuAction = (action) => {
    if (action === 'start') vars.get('RoundCommand').setString('Start');
    else if (action === 'newRound') vars.get('RoundCommand').setString('Start');
    else if (action === 'mainMenu') vars.get('RoundCommand').setString('Menu');
    else if (action === 'stage') { vars.get('StageCommand').setString('open'); }
    else if (action === 'online') { vars.get('OnlineUiCommand').setString('open'); }
    else if (action === 'how') showOnly('how');
    else if (action === 'record') { updateRecordUi(); showOnly('record'); }
    else if (action === 'settings') { updateCameraPrefUi(); updateSoundUi(); updateSettingsUi(); showOnly('settings'); }
    else if (action === 'pro') { if (runtimeScene.__iceWolfV110Pro && typeof runtimeScene.__iceWolfV110Pro.open === 'function') runtimeScene.__iceWolfV110Pro.open(); }
    else if (action === 'language') { if (typeof runtimeScene.__iceWolfOpenLanguagePicker === 'function') runtimeScene.__iceWolfOpenLanguagePicker(); }
    else if (action === 'back') showOnly('menu');
    else if (action === 'soundToggle') { vars.get('SoundToggleRequest').setBoolean(true); }
    else if (action === 'cameraPref') { safeStorageSet('iceWolfDefaultOverview', preferredOverview() ? '0' : '1'); updateCameraPrefUi(); }
    else if (action === 'roleRandom') { vars.get('RolePreference').setString('Random'); safeStorageSet('iceWolfRolePreference', 'random'); updateSettingsUi(); }
    else if (action === 'roleWolf') { vars.get('RolePreference').setString('Wolf'); safeStorageSet('iceWolfRolePreference', 'wolf'); updateSettingsUi(); }
    else if (action === 'roleHuman') { vars.get('RolePreference').setString('Human'); safeStorageSet('iceWolfRolePreference', 'human'); updateSettingsUi(); }
    else if (action === 'time120') { vars.get('DurationPreference').setNumber(120); vars.get('MatchDuration').setNumber(120); safeStorageSet('iceWolfMatchDuration', '120'); updateSettingsUi(); }
    else if (action === 'time180') { vars.get('DurationPreference').setNumber(180); vars.get('MatchDuration').setNumber(180); safeStorageSet('iceWolfMatchDuration', '180'); updateSettingsUi(); }
    else if (action === 'time300') { vars.get('DurationPreference').setNumber(300); vars.get('MatchDuration').setNumber(300); safeStorageSet('iceWolfMatchDuration', '300'); updateSettingsUi(); }
    else if (action === 'switchEscape') { const next = !vars.get('SwitchEscapeEnabled').getAsBoolean(); vars.get('SwitchEscapeEnabled').setBoolean(next); safeStorageSet('iceWolfSwitchEscape', next ? '1' : '0'); updateSettingsUi(); }
    else if (action === 'trapAuto') { vars.get('TrapSwitchMode').setString('Auto'); safeStorageSet('iceWolfTrapSwitchMode', 'auto'); updateSettingsUi(); }
    else if (action === 'trapAlways') { vars.get('TrapSwitchMode').setString('AlwaysOn'); safeStorageSet('iceWolfTrapSwitchMode', 'always'); updateSettingsUi(); }
    else if (action === 'trapOff') { vars.get('TrapSwitchMode').setString('Off'); safeStorageSet('iceWolfTrapSwitchMode', 'off'); updateSettingsUi(); }
  };
  let lastTapAction = '';
  let lastTapAt = 0;
  const sheetTap = (event) => {
    if (!event) return;
    const node = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
    if (!node || !root.contains(node)) return;
    const action = node.getAttribute('data-action') || '';
    if (MENU_ACTIONS.indexOf(action) < 0) return;
    if (event.cancelable !== false && typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (action === lastTapAction && now - lastTapAt < 500) return;
    lastTapAction = action;
    lastTapAt = now;
    runMenuAction(action);
  };
  for (const tapType of ['pointerdown', 'touchstart', 'click']) {
    try {
      root.addEventListener(tapType, sheetTap, { passive: false, capture: true });
    } catch (error) {
      try { root.addEventListener(tapType, sheetTap, true); } catch (ignored) { /* no gesture on this WebView */ }
    }
  }
