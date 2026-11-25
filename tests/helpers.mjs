import { STAGES, stageById } from '../src/data/stages.js';
import { ARENA, ACTOR, PAD } from '../src/config.js';
import {
  isWalkable,
  buildNav,
  findPath,
  blockedAt,
  wallsForFloor,
  insideFloor,
  floorAt,
  floorBounds,
  frameWalls,
  randomPointOn,
} from '../src/core/geometry.js';

export {
  STAGES,
  stageById,
  ARENA,
  ACTOR,
  PAD,
  isWalkable,
  buildNav,
  findPath,
  blockedAt,
  wallsForFloor,
  insideFloor,
  floorAt,
  floorBounds,
  frameWalls,
  randomPointOn,
};
