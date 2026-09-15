const vars = runtimeScene.getVariables();
const dt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);
const phase = vars.get('RoundPhase').getAsString();
const players = runtimeScene.getObjects('Player');
const actors = runtimeScene.getObjects('Actor');
const player = players.length ? players[0] : null;
const testMode = runtimeScene.__iceWolfV065TestMode === true;
const setObjVisible = (name, visible) => {
  for (const obj of runtimeScene.getObjects(name)) {
    if (typeof obj.hide === 'function') obj.hide(!visible);
  }
};
const resetJoystick = () => {
  vars.get('JoystickActive').setBoolean(false);
  vars.get('JoystickX').setNumber(0);
  vars.get('JoystickY').setNumber(0);
};
const resetTransientActorState = (actor) => {
  const av = actor.getVariables();
  av.get('AIWolfModeLeft').setNumber(0);
  av.get('AIWolfCooldownLeft').setNumber(0);
  actor.__iceWolfDiagnosticTargetPlayer = false;
  actor.__iceWolfDiagnosticHoldLeft = 0;
  actor.__iceWolfPrimaryCPUWolf = false;
  actor.__iceWolfAIRescueCooldown = 0;
  actor.__iceWolfAITurnLeft = 0;
  actor.__iceWolfAIWolfTurnLeft = 0;
  actor.__iceWolfAIWolfBlockedFor = 0;
  actor.__iceWolfAIWolfDetourLeft = 0;
  actor.__iceWolfAIHumanBlockedFor = 0;
  actor.__iceWolfAIHumanDetourLeft = 0;
};
const defaultPositions = [[-488.5,-8.5],[471.5,-8.5],[-8.5,-458.5],[-488.5,-458.5],[471.5,441.5],[-400,-560]];
const resetRound = (forcedRole = '') => {
  if (!player) return;
  vars.get('GameOver').setBoolean(true);
  vars.get('MatchTimeLeft').setNumber(vars.get('MatchDuration').getAsNumber());
  vars.get('WolfModeLeft').setNumber(0);
  vars.get('CooldownLeft').setNumber(0);
  vars.get('InfectionUsed').setBoolean(false);
  vars.get('FeedbackLeft').setNumber(0);
  vars.get('CpuWolfDiagPhase').setNumber(0);
  vars.get('RoundResultRecorded').setBoolean(false);
  resetJoystick();
  vars.get('OverviewCameraEnabled').setBoolean(false);
  const pv = player.getVariables();
  pv.get('State').setString('Active');
  const role = forcedRole || (Math.random() < 0.5 ? 'Wolf' : 'Human');
  pv.get('Role').setString(role);
  vars.get('RoundRole').setString(role);
  player.setX(0);
  player.setY(350);
  if (typeof player.setZ === 'function') player.setZ(0);
  for (let i = 0; i < actors.length; i++) {
    const actor = actors[i];
    const av = actor.getVariables();
    av.get('Role').setString('Human');
    av.get('State').setString('Active');
    resetTransientActorState(actor);
    const pos = defaultPositions[i] || [0,-520];
    actor.setX(pos[0]);
    actor.setY(pos[1]);
  }
  if (role === 'Human' && actors.length) {
    const wolf = actors[Math.floor(Math.random() * actors.length)];
    const wv = wolf.getVariables();
    wv.get('Role').setString('Wolf');
    wv.get('AIWolfModeLeft').setNumber(0);
    wv.get('AIWolfCooldownLeft').setNumber(1.5);
    wolf.__iceWolfPrimaryCPUWolf = true;
  }
  for (const obj of runtimeScene.getObjects('WinText')) {
    if (typeof obj.setString === 'function') obj.setString('');
    if (typeof obj.hide === 'function') obj.hide(true);
  }
  for (const obj of runtimeScene.getObjects('ActionFeedbackText')) {
    if (typeof obj.setString === 'function') obj.setString('');
    if (typeof obj.hide === 'function') obj.hide(true);
  }
};
const safeStorageGet = (key, fallback) => {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (_) { return fallback; }
};
const safeStorageSet = (key, value) => {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch (_) {}
};
const readRecord = () => {
  try {
    const raw = safeStorageGet('iceWolfRecordV1', '');
    if (!raw) return { games:0, wolfWins:0, humanWins:0 };
    const data = JSON.parse(raw);
    return {
      games: Math.max(0, Number(data.games)||0),
      wolfWins: Math.max(0, Number(data.wolfWins)||0),
      humanWins: Math.max(0, Number(data.humanWins)||0),
    };
  } catch (_) { return { games:0, wolfWins:0, humanWins:0 }; }
};
const writeRecord = (record) => safeStorageSet('iceWolfRecordV1', JSON.stringify(record));
const preferredOverview = () => safeStorageGet('iceWolfDefaultOverview', '0') === '1';

if (typeof document !== 'undefined' && !runtimeScene.__iceWolfV065ProductionUi) {
  for (const old of document.querySelectorAll('[data-ice-wolf-v065-production="1"]')) old.remove();
  const root = document.createElement('div');
  root.dataset.iceWolfV065Production = '1';
  root.innerHTML = `
    <style>
      [data-ice-wolf-v065-production="1"]{position:fixed;inset:0;z-index:2147483400;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff}
      .iw-screen{position:absolute;inset:0;display:none;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;pointer-events:auto;background:radial-gradient(circle at 50% 18%,rgba(17,123,178,.32),rgba(2,16,31,.96) 52%,rgba(0,7,16,.995));overflow:auto}
      .iw-screen.iw-show{display:flex}
      .iw-card{width:min(960px,96vw);min-height:min(610px,92vh);box-sizing:border-box;border:1px solid rgba(78,213,255,.48);border-radius:28px;background:linear-gradient(145deg,rgba(8,46,72,.94),rgba(2,20,37,.97));box-shadow:0 0 34px rgba(0,177,255,.20),inset 0 0 42px rgba(78,213,255,.06);padding:26px 34px;display:grid;grid-template-columns:minmax(250px,1fr) minmax(300px,1.05fr);gap:30px;align-items:center;position:relative;overflow:hidden}
      .iw-card:before,.iw-card:after{content:"";position:absolute;width:180px;height:180px;border:2px solid rgba(135,231,255,.15);transform:rotate(45deg);border-radius:18px}
      .iw-card:before{left:-118px;top:-118px}.iw-card:after{right:-118px;bottom:-118px}
      .iw-brand{text-align:center;position:relative;z-index:1}.iw-wolf{width:min(220px,30vw);margin:auto;filter:drop-shadow(0 0 18px rgba(86,223,255,.8))}.iw-title{font-size:clamp(54px,7vw,92px);font-weight:950;letter-spacing:2px;line-height:.92;margin:10px 0 12px;background:linear-gradient(#effcff,#77ddff 60%,#c4f2ff);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 18px rgba(59,196,255,.22)}
      .iw-tag{font-size:clamp(17px,2vw,26px);font-weight:650;margin:0 0 6px}.iw-jp{font-size:clamp(14px,1.65vw,20px);color:#9bbbd0;margin:0}.iw-menu{display:flex;flex-direction:column;gap:13px;position:relative;z-index:1}.iw-btn{width:100%;min-height:64px;border-radius:20px;border:1.5px solid rgba(62,203,255,.56);background:linear-gradient(180deg,rgba(15,79,111,.94),rgba(5,43,68,.98));box-shadow:inset 0 1px rgba(255,255,255,.12),0 5px 16px rgba(0,0,0,.24);color:#fff;font-size:clamp(20px,2.5vw,31px);font-weight:900;letter-spacing:.5px;cursor:pointer;touch-action:manipulation}.iw-btn:active{transform:scale(.985)}.iw-primary{border-color:#ffe28a;background:linear-gradient(180deg,#ffe991,#ffc73e);color:#06233b;box-shadow:0 0 21px rgba(255,207,70,.35),inset 0 1px rgba(255,255,255,.55)}
      .iw-version{text-align:center;color:#7395aa;font-size:14px;margin-top:5px}.iw-modal{width:min(700px,92vw);border:1px solid rgba(78,213,255,.55);border-radius:24px;background:rgba(3,27,46,.97);box-shadow:0 0 34px rgba(0,173,255,.22);padding:28px 30px;box-sizing:border-box;text-align:left}.iw-modal h2{font-size:clamp(30px,5vw,52px);margin:0 0 18px;text-align:center}.iw-modal p,.iw-modal li{font-size:clamp(16px,2.1vw,22px);line-height:1.55;color:#d8edf7}.iw-modal ul{padding-left:24px}.iw-back{margin-top:18px}.iw-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.iw-kpi div{background:rgba(24,85,115,.48);border:1px solid rgba(80,211,255,.28);border-radius:15px;padding:14px;text-align:center}.iw-kpi b{display:block;font-size:28px}.iw-reveal{text-align:center}.iw-role{font-size:clamp(52px,10vw,108px);font-weight:950;margin:10px 0}.iw-role.wolf{color:#ff8585}.iw-role.human{color:#80f4dd}.iw-count{font-size:clamp(90px,20vw,220px);font-weight:950;text-shadow:0 0 32px rgba(95,224,255,.7)}.iw-result-title{font-size:clamp(42px,8vw,82px);font-weight:950;text-align:center;margin:0 0 20px}.iw-row{display:flex;gap:12px}.iw-row .iw-btn{flex:1}.iw-setting{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:15px;border-radius:16px;background:rgba(24,85,115,.35);margin:12px 0}.iw-setting span{font-size:19px}.iw-small{font-size:14px!important;color:#8fb1c4!important}
      @media (orientation:portrait),(max-width:720px){.iw-card{grid-template-columns:1fr;gap:18px;padding:22px;min-height:auto}.iw-wolf{width:min(165px,36vw)}.iw-title{font-size:clamp(48px,13vw,76px)}.iw-btn{min-height:58px}.iw-menu{gap:10px}}
    </style>
    <div class="iw-screen" data-screen="menu"><div class="iw-card">
      <div class="iw-brand">
        <svg class="iw-wolf" viewBox="0 0 240 220" aria-label="ICE WOLF emblem" role="img"><defs><linearGradient id="iceg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ecfdff"/><stop offset=".42" stop-color="#70e3ff"/><stop offset="1" stop-color="#1593d1"/></linearGradient></defs><g fill="url(#iceg)" stroke="#d9fbff" stroke-width="2"><path d="M27 18 91 53 120 32 149 53 213 18 190 105 166 174 120 211 74 174 50 105Z"/><path d="M27 18 49 96 92 53Z" opacity=".62"/><path d="M213 18 191 96 148 53Z" opacity=".62"/><path d="M91 53 120 32 120 150 74 174 50 105Z" opacity=".42"/><path d="M149 53 120 32 120 150 166 174 190 105Z" opacity=".23"/></g><path d="M68 102 108 112 86 130Z" fill="#fff"/><path d="M172 102 132 112 154 130Z" fill="#fff"/><path d="m105 158 15-8 15 8-15 17Z" fill="#e9fcff"/></svg>
        <div class="iw-title">ICE WOLF</div><p class="iw-tag">Find the wolf. Freeze or survive.</p><p class="iw-jp">人狼を見抜け。凍らせるか、生き残れ。</p>
      </div>
      <div class="iw-menu"><button class="iw-btn iw-primary" data-action="start">START GAME ›</button><button class="iw-btn" data-action="how">HOW TO PLAY</button><button class="iw-btn" data-action="record">RECORD</button><button class="iw-btn" data-action="settings">SETTINGS</button><div class="iw-version">❄ Prototype v0.6.5</div></div>
    </div></div>
    <div class="iw-screen" data-screen="how"><div class="iw-modal"><h2>HOW TO PLAY</h2><ul><li>7人で戦う氷上の人狼ゲーム。最初の人狼は必ず1人。</li><li>人狼：人狼モード中に接触して人間を凍らせる。</li><li>人間：凍った仲間を救助し、3:30を生き残る。</li><li>元の人狼だけが1試合に1度、凍った人間へ秘密の「感染」を仕込める。</li><li>感染した氷は普通の凍結と見た目が同じ。救助すると罠が発動する。</li><li>CAM/TOPで通常カメラと俯瞰カメラを切替可能。</li></ul><button class="iw-btn iw-back" data-action="back">BACK</button></div></div>
    <div class="iw-screen" data-screen="record"><div class="iw-modal"><h2>RECORD</h2><div class="iw-kpi"><div><b data-record="games">0</b>GAMES</div><div><b data-record="wolf">0</b>WOLF WINS</div><div><b data-record="human">0</b>HUMAN WINS</div></div><p style="text-align:center">Wolf win rate: <strong data-record="rate">0%</strong></p><button class="iw-btn iw-back" data-action="back">BACK</button></div></div>
    <div class="iw-screen" data-screen="settings"><div class="iw-modal"><h2>SETTINGS</h2><div class="iw-setting"><span>Default camera</span><button class="iw-btn" style="width:180px;min-height:50px" data-action="cameraPref">CAM</button></div><div class="iw-setting"><span>Movement</span><span>Compact virtual joystick</span></div><p class="iw-small">Sound and additional accessibility settings will be expanded in a later version. Current gameplay audio remains unchanged.</p><button class="iw-btn iw-back" data-action="back">BACK</button></div></div>
    <div class="iw-screen" data-screen="reveal"><div class="iw-modal iw-reveal"><h2>YOUR ROLE</h2><div class="iw-role" data-role-text>WOLF</div><p data-role-copy></p></div></div>
    <div class="iw-screen" data-screen="countdown"><div class="iw-count" data-count>3</div></div>
    <div class="iw-screen" data-screen="result"><div class="iw-modal"><div class="iw-result-title" data-result-title>RESULT</div><div class="iw-row"><button class="iw-btn iw-primary" data-action="newRound">NEW ROUND</button><button class="iw-btn" data-action="mainMenu">MAIN MENU</button></div></div></div>`;
  document.body.appendChild(root);
  const screen = (name) => root.querySelector(`[data-screen="${name}"]`);
  const showOnly = (name) => {
    for (const el of root.querySelectorAll('.iw-screen')) el.classList.toggle('iw-show', el.dataset.screen === name);
  };
  const updateRecordUi = () => {
    const r = readRecord();
    const set = (key,value) => { const el=root.querySelector(`[data-record="${key}"]`); if(el) el.textContent=String(value); };
    set('games',r.games); set('wolf',r.wolfWins); set('human',r.humanWins); set('rate',r.games ? `${Math.round(r.wolfWins/r.games*100)}%` : '0%');
  };
  const updateCameraPrefUi = () => {
    const el=root.querySelector('[data-action="cameraPref"]'); if(el) el.textContent=preferredOverview()?'TOP':'CAM';
  };
  for (const button of root.querySelectorAll('[data-action]')) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault(); event.stopPropagation();
      const action = button.dataset.action;
      if (action === 'start') vars.get('RoundCommand').setString('Start');
      else if (action === 'newRound') vars.get('RoundCommand').setString('Start');
      else if (action === 'mainMenu') vars.get('RoundCommand').setString('Menu');
      else if (action === 'how') showOnly('how');
      else if (action === 'record') { updateRecordUi(); showOnly('record'); }
      else if (action === 'settings') { updateCameraPrefUi(); showOnly('settings'); }
      else if (action === 'back') showOnly('menu');
      else if (action === 'cameraPref') { safeStorageSet('iceWolfDefaultOverview', preferredOverview()?'0':'1'); updateCameraPrefUi(); }
    }, {passive:false});
  }
  runtimeScene.__iceWolfV065ProductionUi = { root, screen, showOnly, updateRecordUi, updateCameraPrefUi, lastPhase:'' };
  vars.get('ProductionMenuReady').setBoolean(true);
}
const ui = runtimeScene.__iceWolfV065ProductionUi;
const command = vars.get('RoundCommand').getAsString();
if (command) {
  vars.get('RoundCommand').setString('');
  if (command === 'TestStartWolf') {
    runtimeScene.__iceWolfV065TestMode = true;
    resetRound('Wolf');
    vars.get('RoundPhase').setString('Active');
    vars.get('RoundPhaseLeft').setNumber(0);
    vars.get('GameOver').setBoolean(false);
  } else if (command === 'TestStartHuman') {
    runtimeScene.__iceWolfV065TestMode = true;
    resetRound('Human');
    vars.get('RoundPhase').setString('Active');
    vars.get('RoundPhaseLeft').setNumber(0);
    vars.get('GameOver').setBoolean(false);
  } else if (command === 'Start') {
    runtimeScene.__iceWolfV065TestMode = false;
    resetRound('');
    vars.get('RoundPhase').setString('RoleReveal');
    vars.get('RoundPhaseLeft').setNumber(2.4);
    vars.get('GameOver').setBoolean(true);
  } else if (command === 'Menu') {
    runtimeScene.__iceWolfV065TestMode = false;
    vars.get('RoundPhase').setString('Menu');
    vars.get('GameOver').setBoolean(true);
    vars.get('RoundPhaseLeft').setNumber(0);
    resetJoystick();
  }
}
let currentPhase = vars.get('RoundPhase').getAsString();
if (currentPhase === 'RoleReveal' || currentPhase === 'Countdown') {
  let left = Math.max(0, vars.get('RoundPhaseLeft').getAsNumber() - dt);
  vars.get('RoundPhaseLeft').setNumber(left);
  if (currentPhase === 'RoleReveal' && left <= 0) {
    vars.get('RoundPhase').setString('Countdown');
    vars.get('RoundPhaseLeft').setNumber(3.2);
    currentPhase = 'Countdown';
  } else if (currentPhase === 'Countdown' && left <= 0) {
    vars.get('RoundPhase').setString('Active');
    vars.get('RoundPhaseLeft').setNumber(0);
    vars.get('GameOver').setBoolean(false);
    vars.get('OverviewCameraEnabled').setBoolean(preferredOverview());
    currentPhase = 'Active';
  }
}
if (currentPhase === 'Active' && vars.get('GameOver').getAsBoolean()) {
  vars.get('RoundPhase').setString('Result');
  currentPhase = 'Result';
}
if (currentPhase === 'Result' && !vars.get('RoundResultRecorded').getAsBoolean()) {
  let resultText = '';
  const wins = runtimeScene.getObjects('WinText');
  if (wins.length && typeof wins[0].getString === 'function') resultText = wins[0].getString();
  const record = readRecord();
  record.games += 1;
  if (resultText.includes('人狼')) record.wolfWins += 1;
  else record.humanWins += 1;
  writeRecord(record);
  vars.get('RoundResultRecorded').setBoolean(true);
}
currentPhase = vars.get('RoundPhase').getAsString();
const activeForUi = currentPhase === 'Active' || runtimeScene.__iceWolfV065TestMode === true;
setObjVisible('TestRoleButton', runtimeScene.__iceWolfV065TestMode === true);
setObjVisible('TestResetButton', runtimeScene.__iceWolfV065TestMode === true);
setObjVisible('CpuWolfTestButton', runtimeScene.__iceWolfV065TestMode === true);
if (!activeForUi) resetJoystick();
if (typeof document !== 'undefined') {
  const joy = runtimeScene.__iceWolfV063JoystickUi && runtimeScene.__iceWolfV063JoystickUi.root;
  if (joy) joy.style.display = activeForUi ? 'block' : 'none';
  const cam = runtimeScene.__iceWolfV064CameraUi && runtimeScene.__iceWolfV064CameraUi.button;
  if (cam) cam.style.display = activeForUi ? 'block' : 'none';
  if (runtimeScene.__iceWolfV062IdLabels) {
    for (const el of runtimeScene.__iceWolfV062IdLabels.values()) if (el) el.style.visibility = activeForUi ? 'visible' : 'hidden';
  }
}
if (ui && ui.lastPhase !== currentPhase) {
  ui.lastPhase = currentPhase;
  if (currentPhase === 'Menu') ui.showOnly('menu');
  else if (currentPhase === 'RoleReveal') {
    const role = vars.get('RoundRole').getAsString();
    const roleText = ui.root.querySelector('[data-role-text]');
    const copy = ui.root.querySelector('[data-role-copy]');
    if (roleText) { roleText.textContent = role === 'Wolf' ? 'WOLF' : 'HUMAN'; roleText.className = `iw-role ${role === 'Wolf' ? 'wolf' : 'human'}`; }
    if (copy) copy.textContent = role === 'Wolf' ? '人間をすべて凍らせろ。' : '仲間を救い、時間まで生き残れ。';
    ui.showOnly('reveal');
  } else if (currentPhase === 'Countdown') ui.showOnly('countdown');
  else if (currentPhase === 'Active') ui.showOnly('__none__');
  else if (currentPhase === 'Result') {
    let text = 'RESULT';
    const wins = runtimeScene.getObjects('WinText');
    if (wins.length && typeof wins[0].getString === 'function' && wins[0].getString()) text = wins[0].getString();
    const title = ui.root.querySelector('[data-result-title]'); if (title) title.textContent=text;
    ui.showOnly('result');
  }
}
if (ui && currentPhase === 'Countdown') {
  const left = vars.get('RoundPhaseLeft').getAsNumber();
  const count = ui.root.querySelector('[data-count]');
  if (count) count.textContent = left > 2.1 ? '3' : left > 1.1 ? '2' : left > 0.1 ? '1' : 'START';
}
for (const obj of runtimeScene.getObjects('BuildText')) if (typeof obj.setString === 'function') obj.setString('開発版 v0.6.5-DIAG');
