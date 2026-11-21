import type { ControllerLayoutKey } from "@open-party-lab/game-core";
import { lightTrailsManifest } from "../manifest.js";
import type { LightTrailsState } from "../protocol.js";
import { createLightTrailsInput } from "./lightTrailsBindings.js";

type SupportedLanguage = "de" | "en" | "es" | "fr" | "pt-BR";

interface ReadyLayoutModel {
  currentPlayerReady: boolean;
  readyCount: number;
  playerCount: number;
  label: string;
  description: string;
  language?: SupportedLanguage;
  onToggleReady: () => void;
}

interface LeftRightHoldLayoutModel {
  kind: "left_right_hold";
  title: string;
  subtitle?: string;
  helperText?: string;
  disabled: boolean;
  accentColor?: string;
  statusLabel: string;
  statusKey: string;
  leftLabel: string;
  rightLabel: string;
  ready?: ReadyLayoutModel;
  stats?: Array<{ label: string; value: string; highlighted?: boolean }>;
  onLeftChange: (active: boolean) => void;
  onRightChange: (active: boolean) => void;
}

interface ControllerGameRenderContext {
  state: {
    preferredLanguage?: SupportedLanguage;
    room?: {
      language?: SupportedLanguage;
      players?: Array<{ id: string; name: string; isReady?: boolean }>;
    } | null;
    player?: {
      id: string;
      color?: string;
      isReady?: boolean;
    } | null;
    game?: {
      phase?: string;
      message?: string;
      state?: unknown;
    } | null;
  };
  onInput(input: unknown): void;
  onSetReady?: (isReady: boolean) => void;
}

function formatStatusLabel(options: {
  phase: string | undefined;
  alive: boolean;
  won: boolean;
  isDraw: boolean;
  language: SupportedLanguage;
}): { label: string; key: string } {
  const words = {
    de: ["Gewonnen", "Ausgeschieden", "Spielt", "Unentschieden", "Countdown", "Wartet"],
    en: ["Won", "Eliminated", "Playing", "Draw", "Countdown", "Waiting"],
    es: ["Ganaste", "Eliminado", "En juego", "Empate", "Cuenta atrás", "Esperando"],
    fr: ["Gagné", "Éliminé", "En jeu", "Égalité", "Compte à rebours", "En attente"],
    "pt-BR": ["Vitória", "Eliminado", "Em jogo", "Empate", "Contagem regressiva", "Aguardando"]
  }[options.language];
  if (options.won) {
    return { label: words[0], key: "won" };
  }

  if (!options.alive) {
    return { label: words[1], key: "out" };
  }

  if (options.phase === "playing") {
    return { label: words[2], key: "playing" };
  }

  if (options.isDraw && options.phase !== "playing") {
    return { label: words[3], key: "draw" };
  }

  if (options.phase === "countdown") {
    return { label: words[4], key: "countdown" };
  }

  return { label: words[5], key: "waiting" };
}

export function buildLightTrailsControllerModel(
  context: ControllerGameRenderContext
): LeftRightHoldLayoutModel {
  const language = context.state.room?.language ?? context.state.preferredLanguage ?? "de";
  const words = {
    de: { waiting: (r: number, p: number) => `Nächste Runde startet automatisch, sobald ${r}/${p} bereit sind.`, helper: "Halte LINKS oder RECHTS gedrückt, um deine Spur zu lenken.", ready: "Nächste Runde", hold: "Spur halten", wait: "Warten auf nächste Runde", steer: "Gedrückt halten zum Lenken", prepare: "Bereit machen", left: "LINKS", right: "RECHTS", tap: (label: string, r: number, p: number) => `Tippe auf „${label}“. Start bei ${r}/${p} bereit.`, color: "Spielerfarbe", unknown: "unbekannt", racing: "Noch im Rennen", winner: "Sieger" },
    en: { waiting: (r: number, p: number) => `Next round starts automatically when ${r}/${p} are ready.`, helper: "Hold LEFT or RIGHT to steer your trail through the arena.", ready: "Next Round", hold: "Hold the line", wait: "Waiting for next round", steer: "Hold to steer", prepare: "Get ready", left: "LEFT", right: "RIGHT", tap: (label: string, r: number, p: number) => `Tap “${label}”. Starts when ${r}/${p} are ready.`, color: "Player color", unknown: "unknown", racing: "Still racing", winner: "Winner" },
    es: { waiting: (r: number, p: number) => `La siguiente ronda empieza cuando ${r}/${p} estén listos.`, helper: "Mantén IZQUIERDA o DERECHA para guiar tu estela por la arena.", ready: "Siguiente ronda", hold: "Mantén la línea", wait: "Esperando la siguiente ronda", steer: "Mantén pulsado para girar", prepare: "Prepárate", left: "IZQUIERDA", right: "DERECHA", tap: (label: string, r: number, p: number) => `Toca «${label}». Empieza cuando ${r}/${p} estén listos.`, color: "Color del jugador", unknown: "desconocido", racing: "Siguen en carrera", winner: "Ganador" },
    fr: { waiting: (r: number, p: number) => `La prochaine manche démarre quand ${r}/${p} sont prêts.`, helper: "Maintiens GAUCHE ou DROITE pour guider ta traînée.", ready: "Manche suivante", hold: "Garde la ligne", wait: "En attente de la manche suivante", steer: "Maintiens pour piloter", prepare: "Prépare-toi", left: "GAUCHE", right: "DROITE", tap: (label: string, r: number, p: number) => `Appuie sur « ${label} ». Départ à ${r}/${p} joueurs prêts.`, color: "Couleur du joueur", unknown: "inconnue", racing: "Encore en course", winner: "Gagnant" },
    "pt-BR": { waiting: (r: number, p: number) => `A próxima rodada começa quando ${r}/${p} estiverem prontos.`, helper: "Segure ESQUERDA ou DIREITA para guiar seu rastro pela arena.", ready: "Próxima rodada", hold: "Mantenha a linha", wait: "Aguardando a próxima rodada", steer: "Segure para virar", prepare: "Prepare-se", left: "ESQUERDA", right: "DIREITA", tap: (label: string, r: number, p: number) => `Toque em “${label}”. Começa quando ${r}/${p} estiverem prontos.`, color: "Cor do jogador", unknown: "desconhecida", racing: "Ainda na corrida", winner: "Vencedor" }
  }[language];
  const phase = context.state.game?.phase;
  const playerId = context.state.player?.id ?? "";
  const gameState = (context.state.game?.state ?? null) as LightTrailsState | null;
  const ownPlayerState = playerId ? gameState?.players[playerId] : undefined;
  const won = gameState?.winnerPlayerId === playerId;
  const alive = ownPlayerState?.alive ?? true;
  const status = formatStatusLabel({
    phase: context.state.game?.phase,
    alive,
    won,
    isDraw: gameState?.isDraw ?? false,
    language
  });
  const aliveCount = gameState?.alivePlayerIds.length ?? 0;
  const totalPlayers = Object.keys(gameState?.players ?? {}).length;
  const currentPlayerReady = Boolean(context.state.player?.isReady);
  const players = context.state.room?.players ?? [];
  const playerCount = players.length;
  const readyCount = players.filter((player) => player.isReady).length;
  const waitingForReady = phase === "finished";
  const waitingHelperText = words.waiting(readyCount, playerCount);
  const defaultHelperText = words.helper;
  const readyLabel = words.ready;
  const statusValue = alive ? words.hold : words.wait;

  return {
    kind: "left_right_hold",
    title: lightTrailsManifest.translations[language].displayName,
    subtitle:
      phase === "playing" ? words.steer : words.prepare,
    helperText: context.state.game?.message ?? (waitingForReady ? waitingHelperText : defaultHelperText),
    disabled: phase !== "playing" || !alive,
    accentColor: context.state.player?.color ?? ownPlayerState?.color,
    statusLabel: status.label,
    statusKey: `${phase ?? "unknown"}:${status.key}`,
    leftLabel: words.left,
    rightLabel: words.right,
    ready:
      waitingForReady && context.onSetReady
        ? {
            currentPlayerReady,
            readyCount,
            playerCount,
            label: readyLabel,
            description: words.tap(readyLabel, readyCount, playerCount),
            language: context.state.room?.language,
            onToggleReady: () => context.onSetReady?.(!currentPlayerReady)
          }
        : undefined,
    stats: [
      {
        label: words.color,
        value: context.state.player?.color ?? ownPlayerState?.color ?? words.unknown
      },
      {
        label: words.racing,
        value: `${aliveCount}/${totalPlayers}`
      },
      gameState?.winnerName
        ? {
            label: words.winner,
            value: gameState.winnerName,
            highlighted: true
          }
        : {
            label: "Status",
            value: statusValue
          }
    ],
    onLeftChange: (active) => context.onInput(createLightTrailsInput(playerId, "left", active)),
    onRightChange: (active) => context.onInput(createLightTrailsInput(playerId, "right", active))
  };
}

export const controllerGame = {
  id: lightTrailsManifest.id,
  layoutKey: "left_right_hold" as ControllerLayoutKey,
  buildLayout(context: ControllerGameRenderContext) {
    return buildLightTrailsControllerModel(context);
  }
} as const;
