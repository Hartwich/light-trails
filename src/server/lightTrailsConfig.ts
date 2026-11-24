import type { LightTrailsRect } from "../protocol.js";

export const lightTrailsConfig = {
  arenaWidth: 960,
  arenaHeight: 540,
  moveSpeed: 180,
  turnSpeedRadPerSecond: 3.8,
  gridCellSize: 4,
  trailThickness: 5,
  maxPlayingMs: 45_000,
  gapLengthMs: 125,
  gapWarningMs: 170,
  pickupRadius: 14,
  pickupIntervalMs: 4_000,
  phaseDurationMs: 1_300,
  boostDurationMs: 1_800,
  boostMultiplier: 1.3
};

export const reactorObstacles: readonly LightTrailsRect[] = [
  { x: 172, y: 146, width: 132, height: 54 },
  { x: 656, y: 340, width: 132, height: 54 }
];

const collapseStages = [
  { atMs: 12_000, inset: 40 },
  { atMs: 22_000, inset: 80 },
  { atMs: 32_000, inset: 120 }
];

export function getCollapseBounds(elapsedMs: number): { inset: number; nextInset?: number } {
  let inset = 0;
  for (const stage of collapseStages) {
    if (elapsedMs < stage.atMs) {
      return { inset, nextInset: elapsedMs >= stage.atMs - 3_000 ? stage.inset : undefined };
    }
    inset = stage.inset;
  }
  return { inset, nextInset: undefined };
}
