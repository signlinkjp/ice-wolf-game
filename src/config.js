/**
 * ICE WOLF v1.2.0 (Build 38) — one place for every number that shapes a match.
 *
 * The original GDevelop build (game.json) mixed rule numbers into an event
 * sheet. The Three.js build keeps every tuned value here so the rules, the AI,
 * the tests and the HUD all read the same constant.
 *
 * Units are metres and seconds. The old pixel arena was 1400 x 1400 with a
 * 260 px/s walk; the world is now two 48 x 40 m halls and the walk is 5.2 m/s,
 * which keeps the same "about three seconds to cross a room" feel on a phone.
 */

export const APP = {
  name: 'ICE WOLF',
  version: '1.2.0',
  build: 38,
  productId: 'jp.signlink.IceWolf.pro',
  bundleId: 'jp.signlink.IceWolf',
};

/**
 * The world frame. Build 38 stops stacking 2F on top of 1F: the two floors are
 * two independent halls, side by side, each one 48 x 40 m, with a void (and a
 * tall ice ridge) between them. The camera follows the player's hall, and
 * nothing of the other floor is ever laid over the one being played.
 *
 * A stage declares the footprint of each hall in `stage.floors` (rectangles per
 * floor); geometry.js derives the outer walls from that footprint.
 */
export const ARENA = {
  minX: -56,
  maxX: 56,
  minZ: -22,
  maxZ: 22,
  /** The gap between the two halls, centred on x = 0. */
  wingGap: 8,
  /** Inner walls and obstacles stay below a character's eyeline (Build 38). */
  wallH: 1.25,
  /** The hall's outer wall: tall enough to read, faded by the camera when it
   *  comes between the camera and the player (DOROKEI-style occlusion). */
  outerH: 2.8,
  wallT: 0.8,
  /** The ice ridge in the gap: tall enough to hide the other hall. */
  ridgeH: 8,
  ridgeW: 3.2,
  /** A player stepping on a marked zone switches floor / warps. */
  stairRange: 1.9,
};

/** The frozen-player camera: self-centred, and how far the stick may pan it. */
export const FROZEN_CAM = {
  panX: 20,
  panZ: 18,
  speed: 13,
};

/** Third-person chase camera (Build 38: DOROKEI-style, steeper and aware). */
export const CAMERA = {
  /** Height above the floor in the normal chase view. */
  height: 11.8,
  /** How far behind the player the camera sits. */
  behind: 9.2,
  /** How far the camera leads the player in the direction of travel. */
  lead: 1.1,
  /** Overhead (frozen / top) view. */
  topHeight: 21,
  topBehind: 6.5,
  /** A tall prop between camera and player fades to this opacity. */
  occludedOpacity: 0.26,
  /** Within this distance of a tall prop the camera rises a little. */
  liftRange: 7,
  lift: 2.6,
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
  /** Wolf Mode (werewolf only: visible horns, freezing touch) lasts this long. */
  modeSeconds: 5,
  cooldownSeconds: 5,
  /**
   * Contact distance that freezes a human. Build 38: contact alone freezes —
   * for the master wolf always, for a werewolf while it is transformed. The
   * range is a hair over the old one so a visible touch never fails to register.
   */
  freezeRange: 1.3,
  /** The master wolf can turn one frozen human into wolf-role ice. */
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
  /** A stair zone must be this far from every warp mouth (Build 38). */
  stairWarpDistance: 12,
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
  /** Set only when the player picks a language in the settings sheet. */
  languageChosen: 'iceWolfLanguageChosen',
  settings: 'iceWolfSettingsV2',
  record: 'iceWolfRecord',
  pro: 'iceWolfProOwned',
  onlineConfig: 'iceWolfOnlineConfigV1',
  playerName: 'iceWolfPlayerName',
  /** Build 38 replays the (new) opening once per install, so this key is new. */
  opening: 'iceWolfOpeningSeenV2',
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
