import fs from 'node:fs';

const gamePath = 'game.json';
const runtimePath = 'scripts/v065-runtime-source.js';
const game = JSON.parse(fs.readFileSync(gamePath, 'utf8'));
const runtimeSource = fs.readFileSync(runtimePath, 'utf8').replace(/\r\n/g, '\n').trimEnd();

const scene = game.layouts.find(layout => layout.name === 'FROST LAB');
if (!scene) throw new Error('FROST LAB scene not found');

const upsertVar = (name, type, value) => {
  const found = scene.variables.find(v => v.name === name);
  if (found) {
    found.type = type;
    found.value = value;
  } else {
    scene.variables.push({ name, type, value });
  }
};

upsertVar('GameOver', 'boolean', true);
upsertVar('RoundPhase', 'string', 'Menu');
upsertVar('RoundRole', 'string', '');
upsertVar('RoundCommand', 'string', '');
upsertVar('RoundPhaseLeft', 'number', 0);
upsertVar('ProductionMenuReady', 'boolean', false);
upsertVar('RoundResultRecorded', 'boolean', false);

const updateTextObject = (name, value) => {
  const object = scene.objects.find(o => o.name === name);
  if (!object) throw new Error(`${name} object not found`);
  object.string = value;
  if (object.content) object.content.text = value;
};
updateTextObject('BuildText', '開発版 v0.6.5-DIAG');
updateTextObject('TimerText', '3:30');

for (const instanceName of ['TestRoleButton', 'TestResetButton', 'CpuWolfTestButton']) {
  const instance = scene.instances.find(i => i.name === instanceName);
  if (instance) instance.hidden = true;
}

scene.events = scene.events.filter(event => event.name !== 'v0.6.5 Production Round Start + Main Menu');
scene.events.push({
  colorB: 228,
  colorG: 176,
  colorR: 74,
  creationTime: 0,
  name: 'v0.6.5 Production Round Start + Main Menu',
  source: '',
  type: 'BuiltinCommonInstructions::Group',
  events: [{
    type: 'BuiltinCommonInstructions::JsCode',
    inlineCode: runtimeSource.split('\n'),
    parameterObjects: '',
    useStrict: true,
    eventsSheetExpanded: false,
    actions: []
  }],
  parameters: [],
  actions: []
});

const testStartLines = [
  "harness.setSceneVariable('RoundCommand', 'TestStartWolf');",
  'await harness.stepFrames(3);'
];
for (const test of game.tests || []) {
  if (!Array.isArray(test.source)) continue;
  if (test.name === 'v0.6.5 Production Round Start test') continue;
  test.source = test.source.map(line => line.replaceAll('開発版 v0.6.4-DIAG', '開発版 v0.6.5-DIAG'));
  const goIndex = test.source.findIndex(line => line.trim() === "await harness.goToScene('FROST LAB');");
  const already = test.source.some(line => line.includes("RoundCommand', 'TestStartWolf"));
  if (goIndex >= 0 && !already) test.source.splice(goIndex + 1, 0, ...testStartLines);
}

const newTest = {
  description: 'Production menu pauses gameplay, START chooses exactly one initial Wolf, role/countdown gate the timer, and Active begins a normal round',
  lastRunAt: 0,
  lastRunDurationMs: 0,
  lastRunFramesExecuted: 0,
  lastRunStatus: 'not-run',
  name: 'v0.6.5 Production Round Start test',
  type: 'gameplay',
  source: [
    "await harness.goToScene('FROST LAB');",
    'await harness.stepFrames(8);',
    "harness.assert(harness.getSceneVariable('RoundPhase')?.value === 'Menu', 'boots into Menu phase');",
    "harness.assert(harness.getSceneVariable('GameOver')?.value === true, 'gameplay is paused in menu');",
    "harness.assert(harness.getSceneVariable('ProductionMenuReady')?.value === true, 'production menu DOM initialized');",
    "harness.assert(harness.getObjects('BuildText')[0].text === '開発版 v0.6.5-DIAG', 'v0.6.5 build marker');",
    "const heldTimer = harness.getSceneVariable('MatchTimeLeft')?.value ?? 0;",
    'await harness.stepFrames(25);',
    "harness.assert(Math.abs((harness.getSceneVariable('MatchTimeLeft')?.value ?? 0) - heldTimer) < 0.05, 'timer is held before START');",
    "const p0 = harness.getObjects('Player')[0];",
    "harness.setKeyPressed('Right', true);",
    'await harness.stepFrames(20);',
    "harness.setKeyPressed('Right', false);",
    "const p1 = harness.getObjects('Player')[0];",
    "harness.assert(Math.hypot(p1.centerX-p0.centerX, p1.centerY-p0.centerY) < 5, 'movement is paused in menu');",
    "harness.setSceneVariable('RoundCommand', 'Start');",
    'await harness.stepFrames(2);',
    "harness.assert(harness.getSceneVariable('RoundPhase')?.value === 'RoleReveal', 'START enters role reveal');",
    "const player = harness.getObjects('Player')[0];",
    "const actors = harness.getObjects('Actor');",
    "const playerRole = harness.getObjectVariable(player.id, 'Role')?.value;",
    "const actorWolves = actors.filter(a => harness.getObjectVariable(a.id, 'Role')?.value === 'Wolf');",
    "harness.assert((playerRole === 'Wolf' ? 1 : 0) + actorWolves.length === 1, `exactly one initial Wolf: player=${playerRole}, cpuWolves=${actorWolves.length}`);",
    "harness.setSceneVariable('RoundPhaseLeft', 0);",
    'await harness.stepFrames(2);',
    "harness.assert(harness.getSceneVariable('RoundPhase')?.value === 'Countdown', 'role reveal advances to countdown');",
    "harness.setSceneVariable('RoundPhaseLeft', 0);",
    'await harness.stepFrames(2);',
    "harness.assert(harness.getSceneVariable('RoundPhase')?.value === 'Active', 'countdown advances to Active');",
    "harness.assert(harness.getSceneVariable('GameOver')?.value === false, 'gameplay unpauses at Active');",
    "const activeStart = harness.getSceneVariable('MatchTimeLeft')?.value ?? 0;",
    'await harness.stepFrames(40);',
    "const activeEnd = harness.getSceneVariable('MatchTimeLeft')?.value ?? activeStart;",
    "harness.assert(activeEnd < activeStart - 0.3, `timer runs only after Active: ${activeStart} -> ${activeEnd}`);",
    "harness.setSceneVariable('RoundCommand', 'Menu');",
    'await harness.stepFrames(2);',
    "harness.assert(harness.getSceneVariable('RoundPhase')?.value === 'Menu', 'MAIN MENU command returns to Menu');",
    "harness.assert(harness.getSceneVariable('GameOver')?.value === true, 'gameplay pauses again in Menu');",
    ''
  ]
};

game.tests = (game.tests || []).filter(test => test.name !== newTest.name);
game.tests.push(newTest);

const sceneVars = new Map(scene.variables.map(v => [v.name, v]));
for (const required of ['RoundPhase','RoundRole','RoundCommand','RoundPhaseLeft','ProductionMenuReady','RoundResultRecorded']) {
  if (!sceneVars.has(required)) throw new Error(`missing variable ${required}`);
}
if (sceneVars.get('GameOver')?.value !== true) throw new Error('GameOver must default true');
if (!scene.events.some(event => event.name === 'v0.6.5 Production Round Start + Main Menu')) throw new Error('v0.6.5 event group missing');
if (!(game.tests || []).some(test => test.name === newTest.name)) throw new Error('v0.6.5 gameplay test missing');
if (scene.variables.find(v => v.name === 'MatchDuration')?.value !== 210) throw new Error('protected 210-second duration changed');
if (scene.objects.find(o => o.name === 'BuildText')?.string !== '開発版 v0.6.5-DIAG') throw new Error('build label not updated');
if (scene.objects.find(o => o.name === 'TimerText')?.string !== '3:30') throw new Error('timer default not aligned');
const actorInstances = scene.instances.filter(i => i.name === 'Actor');
if (actorInstances.length !== 6) throw new Error(`expected 6 actors, got ${actorInstances.length}`);
const playerInstance = scene.instances.find(i => i.name === 'Player');
if (!playerInstance || playerInstance.width !== 17 || playerInstance.height !== 17 || playerInstance.depth !== 32) throw new Error('Player size parity changed');
if (actorInstances.some(i => i.width !== 17 || i.height !== 17 || i.depth !== 32)) throw new Error('Actor size parity changed');

fs.writeFileSync(gamePath, JSON.stringify(game));
console.log('v0.6.5 Production Round Start patch applied');
