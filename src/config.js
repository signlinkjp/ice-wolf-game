/**
 * ICE WOLF v1.2.0 (Build 37) — one place for every number that shapes a match.
 *
 * The original GDevelop build (game.json) mixed rule numbers into an event
 * sheet. The Three.js build keeps every tuned value here so the rules, the AI,
 * the tests and the HUD all read the same constant.
 *
 * Units are metres and seconds. The old pixel arena was 1400 x 1400 with a
 * 260 px/s walk; the new arena is 48 x 36 m and the walk is 5.2 m/s, which keeps
 * the same "about three seconds to cross a room" feel on a phone.
 */

export const APP = {
  name: 'ICE WOLF',
  version: '1.2.0',
  build: 37,
  productId: 'jp.signlink.IceWolf.pro',
  bundleId: 'jp.signlink.IceWolf',
};

/**
 * Arena frame shared by all six stages. The outer rink is the same; the raised
 * deck (2F) is not — each stage declares its own rectangles in `stage.deck`
 * (Build 37: east half, island, balcony, L, two bands, ring), and geometry.js
 * turns those into the cliff, the railings, the upper outer walls and the two
 * stairwells cut through them.
 */
export const ARENA = {
  minX: -24,
  maxX: 24,
  minZ: -18,
  maxZ: 18,
  deckY: 5.5,
  wallH: 1.4,
  railH: 1.0,
  wallT: 0.8,
  /** How far below the deck edge a stair flight starts. */
  stairRun: 2.2,
};

/** The frozen-player camera: self-centred, and how far the stick may pan it. */
export const FROZEN_CAM = {
  panX: 18,
  panZ: 16,
  speed: 13,
};

/** Player / actor. */
export const ACTOR = {
  radius: 0.55,
  speed: 5.2,
  height: 1.75,
  turnLerp: 12,
  bob: 0.09,
};

/** Wolf rules. */
export const WOLF = {
  /** Wolf Mode (visible red ears, freezing touch) lasts this long. */
  modeSeconds: 5,
  cooldownSeconds: 5,
  /** Contact distance that freezes a human while a wolf is in Wolf Mode. */
  freezeRange: 1.15,
  /** A werewolf can turn one frozen human into a wolf-role ice cube. */
  infectRange: 2.9,
  maxWolves: 3,
};

export const RESCUE = {
  range: 2.25,
  seconds: 1.2,
  /** Frozen humans cannot be rescued by another frozen human. */
  cooldownSeconds: 0.25,
};

export const SWITCH = {
  range: 1.75,
  holdSeconds: 1.6,
  /** Candidate spots per stage; N of them carry a switch. */
  spots: 13,
  gateDistance: 5.5,
};

export const PAD = {
  speedMultiplier: 1.45,
  speedSeconds: 2.5,
  warpCooldown: 5,
  radius: 1.35,
};

export const MATCH = {
  minSeconds: 60,
  maxSeconds: 300,
  defaultSeconds: 210,
  durations: [60, 120, 180, 300],
  countdownSeconds: 3,
  briefingSeconds: 4.5,
  defaultPlayers: 7,
  maxPlayers: 10,
  freePlayers: 9,
  defaultWolves: 1,
  switchCounts: [3, 5, 7, 10],
  correctCounts: [3, 5],
  defaultSwitches: 5,
  defaultCorrect: 3,
  /** Match-clock window opening (seconds since kickoff). */
  freezeGraceSeconds: 0.35,
};

/** Stage gimmick rhythms (all read from the host's match clock). */
export const GIMMICK = {
  aquarium: { mantaPeriod: 27, mantaLength: 3, currentPower: 1.35 },
  park: { period: 16, length: 5, speed: 1.35 },
  lodge: { period: 29, length: 5, slide: 0.82 },
  school: { period: 26, chime: 2.5, shut: 5 },
  space: { period: 28, warn: 2.5, length: 10, slow: 0.55, cells: 6, cellRadius: 1.7 },
};

export const ONLINE = {
  channelPrefix: 'realtime:ice-wolf-room-',
  codeLength: 6,
  inputHz: 10,
  snapshotHz: 5,
  heartbeatMs: 25000,
  presenceTimeoutMs: 30000,
  hostTimeoutSeconds: 12,
  maxPlayers: 10,
  stampCooldownMs: 2000,
  stampBudget: 30,
  /** Snapshot jump larger than this is a teleport, not movement. */
  teleport: 8,
};

export const STORAGE = {
  language: 'iceWolfLanguage',
  settings: 'iceWolfSettingsV2',
  record: 'iceWolfRecord',
  pro: 'iceWolfProOwned',
  onlineConfig: 'iceWolfOnlineConfigV1',
  playerName: 'iceWolfPlayerName',
  tutorial: 'iceWolfTutorialSeen',
};

export const DEFAULT_SETTINGS = {
  language: null,
  role: 'random',
  duration: MATCH.defaultSeconds,
  players: MATCH.defaultPlayers,
  wolves: MATCH.defaultWolves,
  switches: MATCH.defaultSwitches,
  correct: MATCH.defaultCorrect,
  escape: true,
  trap: 'auto',
  sound: true,
  bgm: true,
  vibration: true,
  textSize: 'standard',
  camera: 'normal',
  controls: 'stick',
  stage: 'classic',
};

export const LANGUAGES = [
  'ja',
  'en',
  'zh-Hans',
  'zh-Hant',
  'ko',
  'es',
  'fr',
  'de',
  'pt',
  'it',
  'hi',
  'id',
];

export const TEXT_SIZES = { standard: 1, large: 1.18, xlarge: 1.36 };
