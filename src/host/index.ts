import Phaser from "phaser";
import type { SupportedLanguage } from "@open-party-lab/game-core";
import { lightTrailsCopy } from "../catalogText.js";
import { lightTrailsManifest } from "../manifest.js";
import type { LightTrailsPlayerState, LightTrailsState } from "../protocol.js";
import {
  appendTrails, arcade, arenaLayout, drawBounds, drawCrash, drawDriver, drawFloor,
  drawPickup, driverColor, type ArenaLayout
} from "./LightTrailsRenderer.js";
import { applyLightTrailsHostPatch } from "./hostPatch.js";

const floorKey = "light-trails-circuit-floor";
const floorUrl = new URL("../../assets/circuit-floor.jpg", import.meta.url).href;

interface HostClientLike {
  subscribe(callback: (state: HostAppStateLike) => void): () => void;
}

interface HostAppStateLike {
  game?: {
    gameId: string;
    roundNumber: number;
    phase: string;
    state: unknown;
  } | null;
  room?: {
    language?: SupportedLanguage;
    pausedBy?: unknown;
    players?: Array<{ isReady?: boolean }>;
  } | null;
}

interface Frame {
  state: LightTrailsState;
  round: number;
  phase: string;
  language: SupportedLanguage;
  paused: boolean;
  ready: string;
}

function timeLabel(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export class LightTrailsHostScene extends Phaser.Scene {
  private frame?: Frame;
  private previousDrivers?: Frame["state"]["players"];
  private frameAt = 0;
  private interpolateMs = 33;
  private countdownMs = 0;
  private readonly drawn = new Map<string, number>();
  private readonly crashes = new Map<string, number>();
  private readonly reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  private floor?: Phaser.GameObjects.Image;
  private decor!: Phaser.GameObjects.Graphics;
  private trails!: Phaser.GameObjects.RenderTexture;
  private brush!: Phaser.GameObjects.Graphics;
  private bounds!: Phaser.GameObjects.Graphics;
  private actors!: Phaser.GameObjects.Graphics;
  private card!: Phaser.GameObjects.Graphics;
  private timeText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private cardTitle!: Phaser.GameObjects.Text;
  private cardHint!: Phaser.GameObjects.Text;
  private layout?: ArenaLayout;
  private boundsKey = "";
  private cardKey = "";

  constructor() {
    super(lightTrailsManifest.hostView);
  }

  preload(): void {
    if (!this.textures.exists(floorKey)) this.load.image(floorKey, floorUrl);
  }

  create(): void {
    const client = this.registry.get("hostClient") as HostClientLike;
    this.cameras.main.setBackgroundColor(arcade.background);
    if (this.textures.exists(floorKey)) this.floor = this.add.image(0, 0, floorKey).setOrigin(0);
    this.decor = this.add.graphics();
    this.trails = this.add.renderTexture(0, 0, this.scale.width, this.scale.height).setOrigin(0, 0);
    this.brush = this.make.graphics({}, false);
    this.bounds = this.add.graphics();
    this.actors = this.add.graphics();
    this.card = this.add.graphics();
    this.timeText = this.add.text(0, 0, "", { fontFamily: arcade.monoFont, fontStyle: "bold" }).setOrigin(0, 0.5);
    this.countText = this.add.text(0, 0, "", { fontFamily: arcade.monoFont, color: arcade.soft }).setOrigin(1, 0.5);
    this.cardTitle = this.add.text(0, 0, "", { fontFamily: arcade.displayFont, fontStyle: "bold" }).setOrigin(0.5);
    this.cardHint = this.add.text(0, 0, "", { fontFamily: arcade.monoFont, color: arcade.soft }).setOrigin(0.5);

    const repaint = () => this.resizeArena();
    this.scale.on(Phaser.Scale.Events.RESIZE, repaint);
    const unsubscribe = client.subscribe((snapshot) => this.receiveFrame(snapshot));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      this.scale.off(Phaser.Scale.Events.RESIZE, repaint);
      this.brush.destroy();
      this.frame = undefined;
      this.previousDrivers = undefined;
      this.floor = undefined;
      this.layout = undefined;
      this.crashes.clear();
      this.drawn.clear();
      this.boundsKey = "";
      this.cardKey = "";
    });
  }

  private receiveFrame(snapshot: HostAppStateLike): void {
    const game = snapshot.game;
    if (!game || game.gameId !== lightTrailsManifest.id || !game.state) return;
    const state = game.state as LightTrailsState;
    const old = this.frame;
    const now = performance.now();
    const newRound = !old || old.round !== game.roundNumber || old.state.tick > state.tick;
    const moved = old?.state.tick !== state.tick;
    const wasCountdown = old?.phase === "countdown";
    const paused = Boolean(snapshot.room?.pausedBy);
    const phase = game.phase;
    if (phase === "countdown" && (newRound || !wasCountdown || old?.state.countdownMs !== state.countdownMs)) {
      this.countdownMs = state.countdownMs ?? 0;
    }
    const players = snapshot.room?.players ?? [];
    this.frame = {
      state, round: game.roundNumber, phase,
      language: snapshot.room?.language ?? "de", paused,
      ready: `${players.filter((player) => player.isReady).length}/${players.length}`
    };

    if (newRound) {
      this.previousDrivers = undefined;
      this.crashes.clear();
      this.resizeArena();
    } else if (old && moved) {
      this.previousDrivers = old.state.players;
      this.interpolateMs = Phaser.Math.Clamp(now - this.frameAt, 16, 48);
      for (const player of Object.values(state.players)) {
        if (!player.alive && old.state.players[player.playerId]?.alive) this.crashes.set(player.playerId, now);
      }
    }
    if (newRound || moved) this.frameAt = now;
    this.paintSnapshot();
  }

  private resizeArena(): void {
    if (!this.frame) return;
    const layout = this.layout = arenaLayout(this, this.frame.state);
    this.floor?.setPosition(layout.x, layout.y).setDisplaySize(layout.width, layout.height);
    drawFloor(this.decor, this.frame.state, layout);
    this.trails.resize(this.scale.width, this.scale.height).clear();
    this.drawn.clear();
    this.boundsKey = "";
    this.cardKey = "";
    const railY = layout.y - layout.rail / 2 - 4;
    const railSize = Math.max(11, Math.min(16, layout.rail * 0.63));
    this.timeText.setPosition(layout.x + 10, railY).setFontSize(railSize);
    this.countText.setPosition(layout.x + layout.width - 10, railY).setFontSize(railSize);
    this.paintSnapshot();
  }

  private paintSnapshot(): void {
    if (!this.frame || !this.layout) return;
    const { state } = this.frame;
    appendTrails(this.trails, this.brush, state, this.layout, this.drawn);
    const boundsKey = `${state.inset}:${state.nextInset ?? ""}`;
    if (this.boundsKey !== boundsKey) {
      this.boundsKey = boundsKey;
      drawBounds(this.bounds, state, this.layout);
    }
    this.timeText.setText(timeLabel(state.remainingMs))
      .setColor(state.remainingMs <= 8_000 ? "#ffbe55" : arcade.ink);
    this.countText.setText(`${state.alivePlayerIds.length}/${state.playerCount}`);
  }

  private drawCard(): void {
    if (!this.frame || !this.layout) return;
    const { state, phase, ready, language } = this.frame;
    const words = lightTrailsCopy[language];
    const countdown = phase === "countdown";
    const intro = phase === "round_intro";
    const result = phase === "finished" || phase === "result" || phase === "scoreboard";
    const victor = state.winnerPlayerId ? state.players[state.winnerPlayerId] : undefined;
    const title = countdown ? String(Math.max(1, Math.ceil(this.countdownMs / 1000)))
      : intro ? words.arenas[state.arena][0]
      : result ? (victor ? words.victory : state.playerCount === 1 ? words.out : words.draw) : "";
    const hint = intro ? words.intro : result && phase === "finished" ? words.ready(ready) : "";
    const key = `${phase}:${title}:${hint}:${victor?.color ?? ""}`;
    if (key === this.cardKey) return;
    this.cardKey = key;
    this.card.clear();
    this.cardTitle.setVisible(Boolean(title));
    this.cardHint.setVisible(Boolean(hint));
    if (!title) return;

    const { x, y, width, height, scale } = this.layout;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const titleSize = countdown ? Phaser.Math.Clamp(74 * scale, 28, 104) : Phaser.Math.Clamp(34 * scale, 17, 54);
    const hintSize = Phaser.Math.Clamp(15 * scale, 11, 20);
    const color = victor ? driverColor(victor.color) : arcade.cyan;
    this.cardTitle.setText(title).setFontSize(titleSize).setColor(arcade.ink).setPosition(cx, cy - (hint ? hintSize * 0.65 : 0));
    this.cardHint.setText(hint).setFontSize(hintSize).setPosition(cx, cy + titleSize * 0.67);
    const w = Math.min(width * 0.94, Math.max(this.cardTitle.width, this.cardHint.width) + 50 * scale);
    const h = countdown ? titleSize * 1.2 : titleSize + hintSize * 2.85;
    this.card.fillStyle(arcade.background, 0.94).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);
    this.card.lineStyle(1.5, color, 0.78).strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 6);
  }

  update(_time: number, delta: number): void {
    if (!this.frame || !this.layout) return;
    const { state, paused, phase } = this.frame;
    if (phase === "countdown" && !paused) this.countdownMs = Math.max(0, this.countdownMs - delta);
    const now = performance.now();
    const pulse = this.reduceMotion ? 0.5 : (Math.sin(now / 115) + 1) / 2;
    const fraction = !paused && phase === "playing"
      ? Phaser.Math.Clamp((now - this.frameAt) / this.interpolateMs, 0, 1) : 1;
    this.actors.clear();
    for (const pickup of state.pickups) drawPickup(this.actors, this.layout, pickup, pulse);
    for (const player of Object.values(state.players)) {
      if (player.alive) {
        const previous: LightTrailsPlayerState = this.previousDrivers?.[player.playerId] ?? player;
        const x = Phaser.Math.Linear(previous.x, player.x, fraction);
        const y = Phaser.Math.Linear(previous.y, player.y, fraction);
        const angle = previous.angleRad + Phaser.Math.Angle.Wrap(player.angleRad - previous.angleRad) * fraction;
        drawDriver(this.actors, this.layout, player, x, y, angle, pulse);
      } else if (!this.reduceMotion) {
        const age = now - (this.crashes.get(player.playerId) ?? -Infinity);
        if (age < 680) drawCrash(this.actors, this.layout, player, age / 680);
      }
    }
    this.drawCard();
  }
}

export const hostGame = {
  id: lightTrailsManifest.id,
  displayName: lightTrailsManifest.displayName,
  sceneKey: lightTrailsManifest.hostView,
  scene: LightTrailsHostScene,
  applyHostPatch: applyLightTrailsHostPatch
} as const;
