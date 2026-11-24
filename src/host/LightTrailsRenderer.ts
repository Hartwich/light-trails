import Phaser from "phaser";
import type { LightTrailsPickup, LightTrailsPlayerState, LightTrailsState, LightTrailsTrailSegment } from "../protocol.js";

export const arcade = {
  background: 0x090a15, rail: 0x101423, line: 0x8395be, ink: "#f3f6ff",
  soft: "#aebbd6", amber: 0xffbe55, cyan: 0x4df7ff, pink: 0xf64aae,
  displayFont: '"Space Grotesk", system-ui, sans-serif',
  monoFont: '"IBM Plex Mono", ui-monospace, monospace'
};

export interface ArenaLayout {
  x: number; y: number; width: number; height: number; scale: number; rail: number;
}

export function arenaLayout(scene: Phaser.Scene, state: LightTrailsState): ArenaLayout {
  const { width, height } = scene.scale;
  const side = Math.min(14, width * 0.025);
  const rail = Math.min(26, height * 0.07);
  const scale = Math.max(0.01, Math.min((width - side * 2) / state.arenaWidth, (height - rail - side * 2) / state.arenaHeight));
  const arenaWidth = state.arenaWidth * scale;
  const arenaHeight = state.arenaHeight * scale;
  return {
    x: (width - arenaWidth) / 2, y: (height - arenaHeight + rail) / 2,
    width: arenaWidth, height: arenaHeight, scale, rail
  };
}

export function driverColor(color: string): number {
  const base = Phaser.Display.Color.HexStringToColor(color);
  return Phaser.Display.Color.GetColor(
    Math.round(base.red * 0.8 + 51),
    Math.round(base.green * 0.8 + 51),
    Math.round(base.blue * 0.8 + 51)
  );
}

function point(layout: ArenaLayout, x: number, y: number) {
  return { x: layout.x + x * layout.scale, y: layout.y + y * layout.scale };
}

export function drawFloor(g: Phaser.GameObjects.Graphics, state: LightTrailsState, layout: ArenaLayout): void {
  const { x, y, width, height, scale, rail } = layout;
  g.clear();
  g.fillStyle(arcade.rail, 0.96).fillRect(x, y - rail - 4, width, rail);
  g.lineStyle(1, arcade.pink, 0.8).lineBetween(x, y - 5, x + width / 2, y - 5);
  g.lineStyle(1, arcade.cyan, 0.8).lineBetween(x + width / 2, y - 5, x + width, y - 5);

  const spacing = 40 * scale;
  for (let step = 1; step * spacing < width - 1; step++) {
    g.lineStyle(1, arcade.line, step % 3 === 0 ? 0.23 : 0.11);
    g.lineBetween(x + step * spacing, y, x + step * spacing, y + height);
  }
  for (let step = 1; step * spacing < height - 1; step++) {
    g.lineStyle(1, arcade.line, step % 3 === 0 ? 0.23 : 0.11);
    g.lineBetween(x, y + step * spacing, x + width, y + step * spacing);
  }

  for (const rect of state.obstacles) {
    const p = point(layout, rect.x, rect.y);
    const w = rect.width * scale;
    const h = rect.height * scale;
    g.lineStyle(8 * scale, arcade.amber, 0.10).strokeRect(p.x, p.y, w, h);
    g.fillStyle(0x2a1b21, 1).fillRect(p.x, p.y, w, h);
    g.lineStyle(1, 0xa85331, 0.75).strokeRect(p.x + 4 * scale, p.y + 4 * scale, w - 8 * scale, h - 8 * scale);
    g.lineStyle(Math.max(1, 2 * scale), arcade.amber, 0.97).strokeRect(p.x, p.y, w, h);
    const bottom = p.y + h * 0.73;
    const top = p.y + h * 0.27;
    for (let start = p.x + 18 * scale; start + 24 * scale < p.x + w - 12 * scale; start += 18 * scale) {
      g.lineStyle(7 * scale, arcade.amber, 0.34).lineBetween(start, bottom, start + 20 * scale, top);
    }
    g.fillStyle(arcade.amber, 0.75);
    for (const dx of [8 * scale, w - 8 * scale]) {
      for (const dy of [8 * scale, h - 8 * scale]) g.fillCircle(p.x + dx, p.y + dy, 1.8 * scale);
    }
  }
}

function path(g: Phaser.GameObjects.Graphics, layout: ArenaLayout, segments: LightTrailsTrailSegment[], start: number): void {
  g.beginPath();
  let previous: LightTrailsTrailSegment | undefined;
  for (let index = start; index < segments.length; index++) {
    const segment = segments[index];
    if (!previous || segment.x1 !== previous.x2 || segment.y1 !== previous.y2) {
      const from = point(layout, segment.x1, segment.y1);
      g.moveTo(from.x, from.y);
    }
    const to = point(layout, segment.x2, segment.y2);
    g.lineTo(to.x, to.y);
    previous = segment;
  }
  g.strokePath();
}

export function appendTrails(
  target: Phaser.GameObjects.RenderTexture,
  brush: Phaser.GameObjects.Graphics,
  state: LightTrailsState,
  layout: ArenaLayout,
  drawn: Map<string, number>
): void {
  brush.clear();
  let changed = false;
  for (const player of Object.values(state.players)) {
    const start = drawn.get(player.playerId) ?? 0;
    if (start >= player.trailSegments.length) continue;
    changed = true;
    const color = driverColor(player.color);
    const thickness = Math.max(2, state.trailThickness * layout.scale);
    for (const [width, stroke, alpha] of [
      [thickness * 3.1, color, 0.08], [thickness * 1.75, color, 0.22],
      [thickness, color, 0.96], [Math.max(1, thickness * 0.33), 0xffffff, 0.8]
    ]) {
      brush.lineStyle(width, stroke, alpha);
      path(brush, layout, player.trailSegments, start);
    }
    drawn.set(player.playerId, player.trailSegments.length);
  }
  if (changed) target.draw(brush);
}

export function drawBounds(g: Phaser.GameObjects.Graphics, state: LightTrailsState, layout: ArenaLayout): void {
  g.clear();
  const { x, y, width, height, scale } = layout;
  const inset = state.inset * scale;
  if (inset > 0) {
    g.fillStyle(0x170913, 0.81).fillRect(x, y, width, inset).fillRect(x, y + height - inset, width, inset);
    g.fillRect(x, y + inset, inset, height - inset * 2);
    g.fillRect(x + width - inset, y + inset, inset, height - inset * 2);
  }
  if (state.nextInset !== undefined) {
    const warning = state.nextInset * scale;
    const band = warning - inset;
    g.fillStyle(0xf16c32, 0.18);
    g.fillRect(x + inset, y + inset, width - inset * 2, band);
    g.fillRect(x + inset, y + height - warning, width - inset * 2, band);
    g.fillRect(x + inset, y + warning, band, height - warning * 2);
    g.fillRect(x + width - warning, y + warning, band, height - warning * 2);
    const x1 = x + warning, x2 = x + width - warning, y1 = y + warning, y2 = y + height - warning;
    const dash = Math.max(5, 9 * scale);
    g.lineStyle(2, arcade.amber, 0.94);
    for (let at = x1; at < x2; at += dash * 2) {
      g.lineBetween(at, y1, Math.min(at + dash, x2), y1);
      g.lineBetween(at, y2, Math.min(at + dash, x2), y2);
    }
    for (let at = y1; at < y2; at += dash * 2) {
      g.lineBetween(x1, at, x1, Math.min(at + dash, y2));
      g.lineBetween(x2, at, x2, Math.min(at + dash, y2));
    }
  }
  const color = inset ? 0xff6f74 : 0xebeeff;
  g.lineStyle(6, color, 0.13).strokeRect(x + inset, y + inset, width - inset * 2, height - inset * 2);
  g.lineStyle(2, color, 0.96).strokeRect(x + inset, y + inset, width - inset * 2, height - inset * 2);
}

function drawPowerIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number, kind: LightTrailsPickup["kind"]): void {
  const phase = kind === "phase";
  g.lineStyle(Math.max(1.5, 2.1 * scale), phase ? arcade.cyan : arcade.amber, 1);
  for (const side of [-1, 1]) {
    const middle = x + side * (phase ? 6 : 3.4) * scale;
    const tip = phase ? middle : middle + 3 * scale;
    const start = phase ? x + side * 1.8 * scale : middle - 2 * scale;
    g.lineBetween(start, y - 5 * scale, tip, y);
    g.lineBetween(tip, y, start, y + 5 * scale);
  }
}

export function drawPickup(
  g: Phaser.GameObjects.Graphics, layout: ArenaLayout, pickup: LightTrailsPickup, pulse: number
): void {
  const { x, y } = point(layout, pickup.x, pickup.y);
  const scale = layout.scale;
  const color = pickup.kind === "phase" ? arcade.cyan : arcade.amber;
  g.fillStyle(0x101323, 0.94).fillCircle(x, y, 14 * scale);
  g.lineStyle(5 * scale, color, 0.13).strokeCircle(x, y, (15 + 4 * pulse) * scale);
  g.lineStyle(Math.max(1.4, 2 * scale), color, 0.96).strokeCircle(x, y, 14 * scale);
  drawPowerIcon(g, x, y, scale, pickup.kind);
}

export function drawDriver(
  g: Phaser.GameObjects.Graphics, layout: ArenaLayout, player: LightTrailsPlayerState,
  x: number, y: number, angle: number, pulse: number
): void {
  const p = point(layout, x, y);
  const scale = layout.scale;
  const color = driverColor(player.color);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const offset = (forward: number, side: number) => new Phaser.Math.Vector2(
    p.x + (forward * cos - side * sin) * scale,
    p.y + (forward * sin + side * cos) * scale
  );
  const shape = [offset(12, 0), offset(-8, -7), offset(-4, 0), offset(-8, 7)];
  if (player.power === "phase" || player.gap) {
    const ring = player.power === "phase" ? arcade.cyan : player.gap === "warning" ? arcade.amber : color;
    g.lineStyle(1.6 * scale, ring, player.gap === "warning" ? 0.42 + pulse * 0.55 : 0.88);
    g.strokeCircle(p.x, p.y, 15 * scale);
  }
  if (player.power === "boost") {
    const exhaust = offset(-16, 0);
    g.fillStyle(arcade.amber, 0.72).fillCircle(exhaust.x, exhaust.y, (2.5 + pulse) * scale);
  }
  g.lineStyle(6 * scale, color, 0.25).strokePoints(shape, true);
  g.fillStyle(0x0c1223, 1).fillPoints(shape, true);
  g.lineStyle(Math.max(1.4, 2.3 * scale), color, 1).strokePoints(shape, true);
  const core = offset(3, 0);
  g.fillStyle(0xffffff, 0.96).fillCircle(core.x, core.y, Math.max(1.2, 2.2 * scale));
}

export function drawCrash(
  g: Phaser.GameObjects.Graphics, layout: ArenaLayout, player: LightTrailsPlayerState, progress: number
): void {
  const { x, y } = point(layout, player.x, player.y);
  const scale = layout.scale;
  const radius = (8 + 27 * progress) * scale;
  const color = driverColor(player.color);
  g.lineStyle(Math.max(1, 2 * scale), color, 0.8 * (1 - progress));
  g.strokeCircle(x, y, radius);
  for (let spark = 0; spark < 7; spark++) {
    const angle = player.angleRad + spark * Math.PI * 2 / 7;
    const distance = radius + (spark % 3) * 6 * scale;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    g.lineBetween(x + dx * distance, y + dy * distance, x + dx * (distance + 7 * scale), y + dy * (distance + 7 * scale));
  }
}
