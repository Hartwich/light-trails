import type { PlayerInput } from "@open-party-lab/game-core";

export type LightTrailsTurnDirection = "left" | "right";
export type LightTrailsTurnInput = -1 | 0 | 1;
export type LightTrailsCollisionReason = "wall" | "trail" | "head_clash" | "timeout" | "reactor" | "collapse";
export type LightTrailsArena = "classic" | "reactor" | "collapse";
export type LightTrailsPower = "phase" | "boost";

export interface LightTrailsRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LightTrailsPickup {
  id: number;
  kind: LightTrailsPower;
  x: number;
  y: number;
}

export interface LightTrailsInput extends PlayerInput {
  type: "light-trails:turn" | "turn";
  direction: LightTrailsTurnDirection;
  active: boolean;
}

export interface LightTrailsTrailSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface LightTrailsDriver {
  playerId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  angleRad: number;
  alive: boolean;
  turnInput: LightTrailsTurnInput;
  gap?: "warning" | "open";
  power?: LightTrailsPower;
  eliminatedAt?: number;
  collisionReason?: LightTrailsCollisionReason;
}

export interface LightTrailsPlayerState extends LightTrailsDriver {
  trailCellIds: number[];
  trailLength: number;
  trailSegments: LightTrailsTrailSegment[];
}

export interface LightTrailsState {
  arena: LightTrailsArena;
  obstacles: readonly LightTrailsRect[];
  inset: number;
  nextInset?: number;
  pickups: readonly LightTrailsPickup[];
  playerCount: number;
  remainingMs: number;
  countdownMs?: number;
  arenaWidth: number;
  arenaHeight: number;
  cellSize: number;
  trailThickness: number;
  tick: number;
  alivePlayerIds: string[];
  winnerPlayerId?: string;
  winnerName?: string;
  isDraw: boolean;
  finishAt: number | null;
  players: Record<string, LightTrailsPlayerState>;
}

export interface LightTrailsHostPatchPlayer extends LightTrailsDriver {
  trailStart: number;
  trailSegments: LightTrailsTrailSegment[];
}

export interface LightTrailsHostPatch extends Pick<
  LightTrailsState, "tick" | "pickups" | "inset" | "nextInset" | "remainingMs" |
  "alivePlayerIds" | "winnerPlayerId" | "winnerName" | "isDraw"
> {
  fromTick: number;
  players: Record<string, LightTrailsHostPatchPlayer>;
}
