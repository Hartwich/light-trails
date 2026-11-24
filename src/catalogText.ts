import type { LocalizedGameText, SupportedLanguage } from "@open-party-lab/game-core";
import type { LightTrailsArena, LightTrailsCollisionReason } from "./protocol.js";

export const arenaIds = ["reactor", "classic", "collapse"] as const;
export const defaultArena = "reactor";

export function isArena(value: unknown): value is LightTrailsArena {
  return arenaIds.some((arena) => arena === value);
}

export function resolveArena(value: unknown): LightTrailsArena {
  return isArena(value) ? value : defaultArena;
}

type Copy = {
  name: string; description: string; arenaLabel: string;
  arenas: Record<LightTrailsArena, [label: string, description: string]>;
  intro: string; steer: string; left: string; right: string;
  phase: string; boost: string;
  alive: string; victory: string; won: (name: string) => string;
  solo: string; draw: string; out: string; time: string;
  crash: Record<LightTrailsCollisionReason, string>;
  next: string; ready: (count: string) => string; waiting: string;
};

export const lightTrailsCopy: Record<SupportedLanguage, Copy> = {
  de: {
    name: "Light Trails", description: "Weiche Lichtspuren aus und überlebe in drei Arenen.",
    arenaLabel: "Arena", arenas: {
      reactor: ["Reaktor", "Zwei Sperrblöcke und auflesbare Phase- und Turbo-Symbole."],
      classic: ["Klassik", "Freie Fläche und Lücken in den Spuren."],
      collapse: ["Engpass", "Das Spielfeld schrumpft dreimal. Die nächste Grenze wird vorher markiert."]
    },
    intro: "Links oder rechts halten", steer: "Halten zum Lenken", left: "Links", right: "Rechts",
    phase: "Phase · Spuren durchqueren", boost: "Turbo · Mehr Tempo",
    alive: "Im Rennen", victory: "Gewonnen!", won: (name) => `${name} gewinnt`,
    solo: "Durchgehalten!", draw: "Unentschieden", out: "Ausgeschieden", time: "Zeit abgelaufen · Unentschieden",
    crash: { wall: "Rand berührt", trail: "Spur berührt", head_clash: "Zusammengestoßen", timeout: "Zeit abgelaufen", reactor: "Sperrblock berührt", collapse: "Außerhalb der Arena" },
    next: "Nächste Runde", ready: (count) => `${count} bereit`, waiting: "Bereit machen"
  },
  en: {
    name: "Light Trails", description: "Dodge light trails and survive across three arenas.",
    arenaLabel: "Arena", arenas: {
      reactor: ["Reactor", "Two barriers plus phase and boost pickups."],
      classic: ["Classic", "Open floor with gaps in the trails."],
      collapse: ["Collapse", "The field shrinks three times. Watch for the new boundary."]
    },
    intro: "Hold left or right", steer: "Hold to steer", left: "Left", right: "Right",
    phase: "Phase · Cross trails", boost: "Boost · More speed",
    alive: "Racing", victory: "Victory", won: (name) => `${name} wins`,
    solo: "You survived!", draw: "Draw", out: "Eliminated", time: "Time is up · Draw",
    crash: { wall: "Hit the boundary", trail: "Hit a trail", head_clash: "Head-on crash", timeout: "Time is up", reactor: "Hit a barrier", collapse: "Outside the arena" },
    next: "Next round", ready: (count) => `${count} ready`, waiting: "Get ready"
  },
  es: {
    name: "Estelas de luz", description: "Esquiva estelas y sobrevive en tres arenas.",
    arenaLabel: "Arena", arenas: {
      reactor: ["Reactor", "Dos barreras y mejoras de fase y turbo."],
      classic: ["Clásica", "Campo abierto con huecos en las estelas."],
      collapse: ["Contracción", "El campo se reduce tres veces. Fíjate en el próximo límite."]
    },
    intro: "Mantén izquierda o derecha", steer: "Mantén pulsado para girar", left: "Izquierda", right: "Derecha",
    phase: "Fase · Atraviesa estelas", boost: "Turbo · Más velocidad",
    alive: "En carrera", victory: "Victoria", won: (name) => `${name} gana`,
    solo: "¡Sobreviviste!", draw: "Empate", out: "Eliminado", time: "Se acabó el tiempo · Empate",
    crash: { wall: "Choque con el borde", trail: "Choque con una estela", head_clash: "Choque frontal", timeout: "Se acabó el tiempo", reactor: "Choque con una barrera", collapse: "Fuera de la arena" },
    next: "Siguiente ronda", ready: (count) => `${count} listos`, waiting: "Prepárate"
  },
  fr: {
    name: "Traînées lumineuses", description: "Évite les traînées et survis dans trois arènes.",
    arenaLabel: "Arène", arenas: {
      reactor: ["Réacteur", "Deux barrières et des bonus phase et turbo."],
      classic: ["Classique", "Terrain ouvert avec des trous dans les traînées."],
      collapse: ["Resserrement", "Le terrain rétrécit trois fois. La prochaine limite est annoncée."]
    },
    intro: "Maintiens gauche ou droite", steer: "Maintiens pour tourner", left: "Gauche", right: "Droite",
    phase: "Phase · Traverse les traînées", boost: "Turbo · Plus de vitesse",
    alive: "En course", victory: "Victoire", won: (name) => `${name} gagne`,
    solo: "Tu as survécu !", draw: "Égalité", out: "Éliminé", time: "Temps écoulé · Égalité",
    crash: { wall: "Bord percuté", trail: "Traînée percutée", head_clash: "Collision frontale", timeout: "Temps écoulé", reactor: "Barrière percutée", collapse: "Hors de l’arène" },
    next: "Manche suivante", ready: (count) => `${count} prêts`, waiting: "Prépare-toi"
  },
  "pt-BR": {
    name: "Trilhas de Luz", description: "Desvie dos rastros e sobreviva em três arenas.",
    arenaLabel: "Arena", arenas: {
      reactor: ["Reator", "Duas barreiras e bônus de fase e turbo."],
      classic: ["Clássica", "Campo aberto com brechas nos rastros."],
      collapse: ["Colapso", "O campo encolhe três vezes. Observe o próximo limite."]
    },
    intro: "Segure esquerda ou direita", steer: "Segure para virar", left: "Esquerda", right: "Direita",
    phase: "Fase · Atravesse os rastros", boost: "Turbo · Mais velocidade",
    alive: "Na corrida", victory: "Vitória", won: (name) => `${name} venceu`,
    solo: "Você sobreviveu!", draw: "Empate", out: "Eliminado", time: "O tempo acabou · Empate",
    crash: { wall: "Bateu na borda", trail: "Bateu em um rastro", head_clash: "Colisão frontal", timeout: "O tempo acabou", reactor: "Bateu em uma barreira", collapse: "Fora da arena" },
    next: "Próxima rodada", ready: (count) => `${count} prontos`, waiting: "Prepare-se"
  }
};

export function arenaOptions(language: SupportedLanguage) {
  return arenaIds.map((id) => {
    const [label, description] = lightTrailsCopy[language].arenas[id];
    return { id, label, description };
  });
}

function catalog(language: SupportedLanguage): LocalizedGameText {
  const words = lightTrailsCopy[language];
  return {
    displayName: words.name, description: words.description, visual: { eyebrow: "Arcade" },
    lobbySetup: { fields: { arena: {
      label: words.arenaLabel,
      options: Object.fromEntries(arenaOptions(language).map(({ id, label, description }) => [id, { label, description }]))
    } } }
  };
}

export const lightTrailsText = {
  de: catalog("de"), en: catalog("en"), es: catalog("es"), fr: catalog("fr"), "pt-BR": catalog("pt-BR")
};
