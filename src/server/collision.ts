import type { LightTrailsCollisionReason, LightTrailsRect } from "../protocol.js";

export interface MovementProposal {
  playerId: string;
  x: number;
  y: number;
  nextX: number;
  nextY: number;
  nextAngleRad: number;
  pathCellIds: number[];
  phased: boolean;
}

export interface CollisionEvaluation {
  byPlayerId: Record<string, LightTrailsCollisionReason>;
}

export function containsPoint(rect: LightTrailsRect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

function headsCollide(first: MovementProposal, second: MovementProposal): boolean {
  const x = first.x - second.x;
  const y = first.y - second.y;
  const dx = first.nextX - second.nextX - x;
  const dy = first.nextY - second.nextY - y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(x * dx + y * dy) / lengthSquared));
  return (x + dx * t) ** 2 + (y + dy * t) ** 2 <= 25;
}

export function evaluateCollisions(
  proposals: MovementProposal[],
  occupiedCells: Record<number, string>
): CollisionEvaluation {
  const byPlayerId: Record<string, LightTrailsCollisionReason> = {};
  for (const [index, first] of proposals.entries()) {
    for (let other = index + 1; other < proposals.length; other += 1) {
      const second = proposals[other];
      if (headsCollide(first, second)) {
        byPlayerId[first.playerId] = "head_clash";
        byPlayerId[second.playerId] = "head_clash";
      }
    }
  }

  for (const proposal of proposals) {
    if (byPlayerId[proposal.playerId] || proposal.phased) {
      continue;
    }

    const collidesWithTrail = proposal.pathCellIds.some((cellId) => occupiedCells[cellId] !== undefined);

    if (collidesWithTrail) {
      byPlayerId[proposal.playerId] = "trail";
    }
  }

  return { byPlayerId };
}
