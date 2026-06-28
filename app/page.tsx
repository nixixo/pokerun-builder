"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Move = {
  name: string;        // always the English API name (used as key internally)
  nameEs?: string;     // Spanish display name from API
  category: "Status" | "Physical" | "Special";
  type?: string | null;
  isFake?: boolean;
  hiddenPowerType?: string | null;
};

type BaseStats = {
  HP: number;
  ATK: number;
  DEF: number;
  "SP.ATK": number;
  "SP.DEF": number;
  SPE: number;
};

type BaseStatsInput = {
  [K in keyof BaseStats]: string;
};

type SpriteTransform = {
  x: number;   // offset in %, relative to center (clamped)
  y: number;
  zoom: number; // -100 to +100, 0 = default (fits in frame)
};

const DEFAULT_TRANSFORM: SpriteTransform = { x: 0, y: 0, zoom: 0 };

type Slot = {
  name: string;
  isFake: boolean;
  types: string[];
  sprite?: string | null;
  spriteTransform?: SpriteTransform | null;
  moves: Move[];
  stats?: BaseStats | null;
};

const EMPTY_MOVE = (): Move => ({ name: "", category: "Physical", type: null });

const EMPTY_SLOT = (): Slot => ({
  name: "",
  isFake: false,
  types: ["", ""],
  sprite: null,
  moves: [EMPTY_MOVE(), EMPTY_MOVE(), EMPTY_MOVE(), EMPTY_MOVE()],
  stats: null,
});

const EMPTY_STAT_INPUT: BaseStatsInput = {
  HP: "",
  ATK: "",
  DEF: "",
  "SP.ATK": "",
  "SP.DEF": "",
  SPE: "",
};

const STORAGE_KEY = "pokerun-builder-team";
const SAVED_TEAMS_KEY = "pokerun-builder-saved-teams";
const MAX_PLANTILLAS = 5;

type SavedTeam = {
  id: number;
  name: string;
  team: Slot[];
  savedAt: string;
};

// ─── Sistema de roles por puntuación ponderada (Opción A + B + D) ───────────

type RoleDefinition = {
  es: string;
  en: string;
  color: string;
  // Weighted formula: each stat key → weight (must sum to 1.0)
  weights: Partial<Record<keyof BaseStats, number>>;
};

const ROLES: RoleDefinition[] = [
  { es: "Sweeper Físico",           en: "Physical Sweeper",         color: "#ea580c",
    weights: { ATK: 0.5,  SPE: 0.5 } },
  { es: "Sweeper Especial",          en: "Special Sweeper",          color: "#9333ea",
    weights: { "SP.ATK": 0.5, SPE: 0.5 } },
  { es: "Atacante Mixto",            en: "Mixed Attacker",           color: "#c026d3",
    weights: { ATK: 0.3, "SP.ATK": 0.3, SPE: 0.4 } },
  { es: "Muro Físico",               en: "Physical Wall",            color: "#0369a1",
    weights: { HP: 0.4,  DEF: 0.45, SPE: 0.15 } },
  { es: "Muro Especial",             en: "Special Wall",             color: "#1d4ed8",
    weights: { HP: 0.4,  "SP.DEF": 0.45, SPE: 0.15 } },
  { es: "Muro Total",                en: "Full Wall",                color: "#1e40af",
    weights: { HP: 0.35, DEF: 0.325, "SP.DEF": 0.325 } },
  { es: "Tanque Físico Ofensivo",    en: "Offensive Physical Tank",  color: "#b45309",
    weights: { HP: 0.35, ATK: 0.4,  DEF: 0.25 } },
  { es: "Tanque Especial Ofensivo",  en: "Offensive Special Tank",   color: "#7c3aed",
    weights: { HP: 0.35, "SP.ATK": 0.4, "SP.DEF": 0.25 } },
  { es: "Pivot Resistente",          en: "Bulky Pivot",              color: "#0f766e",
    weights: { HP: 0.4,  SPE: 0.35, DEF: 0.15, "SP.DEF": 0.1 } },
  { es: "Defensor Ágil",             en: "Agile Defender",           color: "#0e7490",
    weights: { DEF: 0.45, SPE: 0.4, HP: 0.15 } },
  { es: "Defensor Especial Ágil",    en: "Agile Special Defender",   color: "#0891b2",
    weights: { "SP.DEF": 0.45, SPE: 0.4, HP: 0.15 } },
  { es: "Físico Equilibrado",        en: "Balanced Physical",        color: "#b91c1c",
    weights: { ATK: 0.35, DEF: 0.35, HP: 0.3 } },
  { es: "Especial Equilibrado",      en: "Balanced Special",         color: "#6d28d9",
    weights: { "SP.ATK": 0.35, "SP.DEF": 0.35, HP: 0.3 } },
  { es: "Atacante Físico Sólido",    en: "Solid Physical Attacker",  color: "#dc2626",
    weights: { ATK: 0.45, "SP.DEF": 0.3, HP: 0.25 } },
  { es: "Especial Defensivo",        en: "Defensive Special",        color: "#4338ca",
    weights: { "SP.ATK": 0.35, DEF: 0.35, HP: 0.3 } },
];

// Speed tiers (Opción D)
const getSpeedTier = (spe: number, lang: Lang): { label: string; color: string } => {
  if (spe <= 30)  return { label: lang === "es" ? "Trick Room" : "Trick Room",  color: "#7c3aed" };
  if (spe <= 50)  return { label: lang === "es" ? "Muy lento"  : "Very slow",   color: "#6b7280" };
  if (spe <= 70)  return { label: lang === "es" ? "Lento"      : "Slow",        color: "#78716c" };
  if (spe <= 90)  return { label: lang === "es" ? "Medio"      : "Mid speed",   color: "#ca8a04" };
  if (spe <= 110) return { label: lang === "es" ? "Rápido"     : "Fast",        color: "#16a34a" };
  return               { label: lang === "es" ? "Muy rápido" : "Very fast",   color: "#0891b2" };
};

// Bulk metrics (Opción B)
const getBulk = (stats: BaseStats) => ({
  physical:  Math.round((stats.HP * stats.DEF)        / 100),
  special:   Math.round((stats.HP * stats["SP.DEF"])  / 100),
  offensive: Math.round((Math.max(stats.ATK, stats["SP.ATK"]) * stats.SPE) / 100),
});

// Score a Pokémon against each role formula, return all scores 0–100
const scoreAllRoles = (stats: BaseStats): { role: RoleDefinition; score: number }[] => {
  // Normalize each stat to 0–1 using realistic max of 255
  const norm = (v: number) => Math.min(v / 255, 1);
  return ROLES.map((role) => {
    const score = Object.entries(role.weights).reduce((acc, [key, w]) => {
      return acc + norm(stats[key as keyof BaseStats]) * (w ?? 0);
    }, 0);
    return { role, score: Math.round(score * 100) };
  });
};

const getRole = (stats: BaseStats, lang: Lang = "es"): { label: string; color: string } | null => {
  const scores = scoreAllRoles(stats);
  const best = scores.reduce((a, b) => a.score > b.score ? a : b);
  if (best.score < 20) return null;
  return { label: best.role[lang], color: best.role.color };
};

const STAT_NAMES_I18N: Record<Lang, Record<keyof BaseStats, string>> = {
  es: { HP: "HP", ATK: "Ataque", DEF: "Defensa", "SP.ATK": "Ataque Esp.", "SP.DEF": "Defensa Esp.", SPE: "Velocidad" },
  en: { HP: "HP", ATK: "Attack", DEF: "Defense", "SP.ATK": "Sp. Atk",    "SP.DEF": "Sp. Def",      SPE: "Speed"    },
};

const STAT_ORDER: (keyof BaseStats)[] = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPE"];

const isValidMove = (value: any): value is Move =>
  value && typeof value.name === "string" && typeof value.category === "string" && (value.type === null || typeof value.type === "string");

const isValidSlot = (value: any): value is Slot =>
  value &&
  typeof value.name === "string" &&
  typeof value.isFake === "boolean" &&
  Array.isArray(value.types) &&
  value.types.length === 2 &&
  value.types.every((t: any) => typeof t === "string") &&
  (value.sprite === null || typeof value.sprite === "string") &&
  Array.isArray(value.moves) &&
  value.moves.length === 4 &&
  value.moves.every(isValidMove);

// ─── Internacionalización ───────────────────────────────────────────────────

type Lang = "es" | "en";

/** Nombres de tipo en español (clave = nombre interno de la API en inglés) */
const TYPE_NAMES_ES: Record<string, string> = {
  normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico",
  grass: "Planta", ice: "Hielo", fighting: "Lucha", poison: "Veneno",
  ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho",
  rock: "Roca", ghost: "Fantasma", dragon: "Dragón", dark: "Siniestro",
  steel: "Acero", fairy: "Hada",
};

/** Nombres de tipo en inglés (capitalizado) */
const TYPE_NAMES_EN: Record<string, string> = {
  normal: "Normal", fire: "Fire", water: "Water", electric: "Electric",
  grass: "Grass", ice: "Ice", fighting: "Fighting", poison: "Poison",
  ground: "Ground", flying: "Flying", psychic: "Psychic", bug: "Bug",
  rock: "Rock", ghost: "Ghost", dragon: "Dragon", dark: "Dark",
  steel: "Steel", fairy: "Fairy",
};

const getTypeName = (apiKey: string, lang: Lang): string =>
  (lang === "es" ? TYPE_NAMES_ES[apiKey] : TYPE_NAMES_EN[apiKey]) ?? apiKey;

const getMoveName = (move: Move, lang: Lang): string => {
  if (move.isFake) return move.name;
  if (lang === "es" && move.nameEs) return move.nameEs;
  return move.name;
};

/** Todas las strings de la UI */
const UI: Record<Lang, Record<string, string>> = {
  es: {
    // Header
    appTitle: "PokéRun Builder",
    appSubtitle: "Arma tu equipo ideal, analiza cobertura de tipos y detecta debilidades.",
    tagTypes: "Tipos", tagCoverage: "Cobertura", tagRoles: "Roles", tagFakemons: "Fakemons",
    statSlots: "6 slots", statMoves: "4 por slot", statAnalysis: "En tiempo real",
    labelSlots: "Equipos", labelMoves: "Movimientos", labelAnalysis: "Análisis",
    // Equipo
    myTeam: "Mi Equipo", saveTemplates: "Plantillas", clearTeam: "Limpiar equipo",
    dragHandle: "arrastrar", noSprite: "Sin sprite", noTypes: "Sin tipos",
    searchPokemon: "Buscar Pokémon por nombre", searchFakemon: "Nombre de Fakemon",
    btnSearch: "Buscar", checkFakemon: "Fakemon", btnConfigure: "Configurar",
    fakemonConfigured: "Fakemon configurado", noTypesSet: "Sin tipos definidos",
    // Movimientos
    attackSlot: "Ataque", moveInvented: "Inventado", movePlaceholder: "Movimiento",
    fakeMovePlaceholder: "Nombre del movimiento",
    fakeTypeLabel: "Tipo inventado", hpTypeLabel: "Tipo Poder Oculto",
    catPhysical: "Físico", catSpecial: "Especial", catStatus: "Estado",
    // Análisis
    weaknesses: "Debilidades", strengths: "Resistencias",
    superEffective: "Superefectivo contra",
    atkSuggTitle: "💡 Sugerencias de tipo de ataque",
    atkSuggCovers: "cubre", atkSuggUncovered: "tipo(s) sin cobertura",
    atkSuggAlso: "también es eficaz contra:",
    coverageTitle: "Cobertura ofensiva",
    coverageTypesCovered: "Tipos cubiertos superefectivamente",
    coverageOf: "tipos",
    balanceSugg: "Sugerencias de balance", balancedTeam: "Equipo bien equilibrado",
    loadPokemon: "Carga Pokémon para ver sugerencias",
    statsBalance: "Balance de stats",
    loadStats: "Carga al menos 3 Pokémon para ver el análisis de stats",
    statLevelHigh: "ALTO", statLevelMid: "MEDIO", statLevelLow: "BAJO",
    redundantRoles: "⚠️ Roles redundantes",
    redundantDesc: "Pokémon con el mismo rol", redundantNote: "— demasiada redundancia ofensiva/defensiva",
    roleSuggTitle: "Roles que le vendrían bien al equipo",
    roleExisting: "Ya tienes", roleExistingMid: "con este rol, pero el equipo sigue flojo en",
    roleNew: "Carencia crítica", roleNewAlt: "Carencia", roleNewEnd: "— considera añadir un",
    rolesBelowBest: "pts bajo el mejor", teamRoles: "Roles del equipo",
    basedOn: "Basado en", basedOnEnd: "Pokémon con stats", balancedOk: "✅ ¡Tu equipo tiene stats y roles bien balanceados!",
    // Summary
    summaryTitle: "Pokémon ideal para completar el equipo",
    bestSingle: "Mejor tipo individual", bestDual: "✨ Mejor doble tipo",
    summaryResists: "resiste:", summaryCovers: "cubre:",
    // Plantillas
    templateTitle: "💾 Plantillas guardadas", templateSubtitle: "Guarda y carga distintos equipos",
    templateClose: "Cerrar", templateEmpty: "No hay plantillas guardadas aún",
    templateLoad: "Cargar", templateOverwrite: "Sobreescribir", templateDelete: "Borrar",
    templateSaveBtn: "+ Guardar equipo actual como nueva plantilla",
    templateNamePlaceholder: "Plantilla", templateSave: "Guardar", templateCancel: "✕",
    templateMaxReached: "Máximo", templateMaxEnd: "plantillas. Borra una para guardar otra.",
    templateEmptyTeam: "Equipo vacío", templatePokemon: "Pokémon",
    // Fakemon config
    configTitle: "Configurar Fakemon", configSubtitle: "Selecciona hasta 2 tipos y define stats opcionales.",
    configClose: "Cerrar", configImage: "Imagen", configSearchSprite: "Buscar sprite de Pokémon",
    configOrUpload: "O subir imagen", configChooseFile: "Elegir archivo",
    configRemoveImg: "Quitar imagen", configSearchPlaceholder: "Ej: Charizard",
    configTypes: "Tipos", configTypesNote: "Máximo 2 tipos. Si no defines tipos, el Fakemon no aportará debilidades ni resistencias.",
    configStats: "Stats (opcional)", configStatsNote: "Si no ingresas stats, este Fakemon no contribuirá al análisis de stats.",
    configHide: "Ocultar", configShow: "Mostrar",
    configCancel: "Cancelar", configSave: "Guardar",
    liveBadge: "En vivo",
    // Sprite editor
    editorTitle: "Ajustar encuadre",
    editorSubtitle: "Arrastra para reencuadrar · usa el zoom para escalar",
    editorZoom: "Zoom",
    editorReset: "Restablecer",
    editorSave: "Aplicar",
    editorCancel: "Cancelar",
    editorEditFrame: "✎ Ajustar encuadre",
  },
  en: {
    appTitle: "PokéRun Builder",
    appSubtitle: "Build your perfect team, analyze type coverage and spot weaknesses.",
    tagTypes: "Types", tagCoverage: "Coverage", tagRoles: "Roles", tagFakemons: "Fakemons",
    statSlots: "6 slots", statMoves: "4 per slot", statAnalysis: "Real-time",
    labelSlots: "Team slots", labelMoves: "Moves", labelAnalysis: "Analysis",
    myTeam: "My Team", saveTemplates: "Templates", clearTeam: "Clear team",
    dragHandle: "drag", noSprite: "No sprite", noTypes: "No types",
    searchPokemon: "Search Pokémon by name", searchFakemon: "Fakemon name",
    btnSearch: "Search", checkFakemon: "Fakemon", btnConfigure: "Configure",
    fakemonConfigured: "Fakemon configured", noTypesSet: "No types set",
    attackSlot: "Move", moveInvented: "Custom", movePlaceholder: "Move name",
    fakeMovePlaceholder: "Move name",
    fakeTypeLabel: "Custom type", hpTypeLabel: "Hidden Power type",
    catPhysical: "Physical", catSpecial: "Special", catStatus: "Status",
    weaknesses: "Weaknesses", strengths: "Resistances",
    superEffective: "Super effective against",
    atkSuggTitle: "💡 Attack type suggestions",
    atkSuggCovers: "covers", atkSuggUncovered: "uncovered type(s):",
    atkSuggAlso: "also effective against:",
    coverageTitle: "Offensive Coverage",
    coverageTypesCovered: "Types covered super-effectively",
    coverageOf: "types",
    balanceSugg: "Balance suggestions", balancedTeam: "Well-balanced team",
    loadPokemon: "Add Pokémon to see suggestions",
    statsBalance: "Stats balance",
    loadStats: "Add at least 3 Pokémon to see stats analysis",
    statLevelHigh: "HIGH", statLevelMid: "MID", statLevelLow: "LOW",
    redundantRoles: "⚠️ Redundant roles",
    redundantDesc: "Pokémon with the same role", redundantNote: "— too much role overlap",
    roleSuggTitle: "Roles that would help your team",
    roleExisting: "You already have", roleExistingMid: "with this role, but the team is still weak in",
    roleNew: "Critical gap", roleNewAlt: "Gap", roleNewEnd: "— consider adding a",
    rolesBelowBest: "pts below best", teamRoles: "Team roles",
    basedOn: "Based on", basedOnEnd: "Pokémon with stats", balancedOk: "✅ Your team has well-balanced stats and roles!",
    summaryTitle: "Ideal Pokémon to complete the team",
    bestSingle: "Best single type", bestDual: "✨ Best dual type",
    summaryResists: "resists:", summaryCovers: "covers:",
    templateTitle: "💾 Saved templates", templateSubtitle: "Save and load different teams",
    templateClose: "Close", templateEmpty: "No templates saved yet",
    templateLoad: "Load", templateOverwrite: "Overwrite", templateDelete: "Delete",
    templateSaveBtn: "+ Save current team as new template",
    templateNamePlaceholder: "Template", templateSave: "Save", templateCancel: "✕",
    templateMaxReached: "Maximum", templateMaxEnd: "templates. Delete one to save another.",
    templateEmptyTeam: "Empty team", templatePokemon: "Pokémon",
    configTitle: "Configure Fakemon", configSubtitle: "Select up to 2 types and define optional stats.",
    configClose: "Close", configImage: "Image", configSearchSprite: "Search Pokémon sprite",
    configOrUpload: "Or upload image", configChooseFile: "Choose file",
    configRemoveImg: "Remove image", configSearchPlaceholder: "e.g. Charizard",
    configTypes: "Types", configTypesNote: "Max 2 types. Without types, Fakemon won't contribute weaknesses or resistances.",
    configStats: "Stats (optional)", configStatsNote: "Without stats, this Fakemon won't contribute to stats analysis.",
    configHide: "Hide", configShow: "Show",
    configCancel: "Cancel", configSave: "Save",
    liveBadge: "Live",
    // Sprite editor
    editorTitle: "Adjust framing",
    editorSubtitle: "Drag to reframe · use zoom to scale",
    editorZoom: "Zoom",
    editorReset: "Reset",
    editorSave: "Apply",
    editorCancel: "Cancel",
    editorEditFrame: "✎ Adjust frame",
  },
};

// ────────────────────────────────────────────────────────────────────────────

// Convert spaces to hyphens for API queries
const formatForAPI = (name: string): string => name.toLowerCase().replace(/\s+/g, "-");

// Convert hyphens to spaces and capitalize each word
const formatForDisplay = (name: string): string =>
  name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const normalizeMoveSearch = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .replace(/[.'’]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ─── Sprite transform helpers ────────────────────────────────────────────────

/** Convert a SpriteTransform into CSS object-position + scale values.
 *  frameSize = the rendered frame size in px (e.g. 112 for w-28 h-28).
 */
function buildSpriteStyle(transform: SpriteTransform | null | undefined): React.CSSProperties {
  const tx = transform ?? DEFAULT_TRANSFORM;
  // zoom: 0 → scale 1.0, +100 → scale 2.0, -100 → scale 0.5
  const scale = tx.zoom >= 0 ? 1 + tx.zoom / 100 : 1 + tx.zoom / 200;
  return {
    transform: `translate(${tx.x}%, ${tx.y}%) scale(${scale})`,
    transformOrigin: "center center",
  };
}

// ─── Sprite Editor Modal ─────────────────────────────────────────────────────

type SpriteEditorProps = {
  src: string;
  initialTransform: SpriteTransform;
  lang: Lang;
  onSave: (t: SpriteTransform) => void;
  onCancel: () => void;
};

function SpriteEditorModal({ src, initialTransform, lang, onSave, onCancel }: SpriteEditorProps) {
  const t = UI[lang];
  const FRAME = 160; // px – preview frame size
  const [transform, setTransform] = useState<SpriteTransform>(initialTransform);
  const dragging = useRef(false);
  const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Compute scale from zoom
  const getScale = (zoom: number) =>
    zoom >= 0 ? 1 + zoom / 100 : 1 + zoom / 200;

  // Clamp the translation so the image never shows empty space inside the frame.
  // The image renders at FRAME×FRAME with object-contain, so visually it may have
  // internal whitespace — we allow free pan since uploaded sprites vary in aspect.
  // For proper clamping we clamp based on how much the image "overflows" the frame.
  const clamp = (tx: number, ty: number, zoom: number): { x: number; y: number } => {
    const scale = getScale(zoom);
    // Maximum shift in px before the frame edge goes out of image bounds
    // image is FRAME×FRAME rendered; at scale S the "extra" pixels on each side = (FRAME*(S-1))/2
    const extra = (FRAME * (scale - 1)) / 2;
    const maxPxX = Math.max(extra, 0);
    const maxPxY = Math.max(extra, 0);
    // Convert from % to px (tx is % of FRAME)
    const pxX = (tx / 100) * FRAME;
    const pxY = (ty / 100) * FRAME;
    const clampedPxX = Math.min(maxPxX, Math.max(-maxPxX, pxX));
    const clampedPxY = Math.min(maxPxY, Math.max(-maxPxY, pxY));
    return { x: (clampedPxX / FRAME) * 100, y: (clampedPxY / FRAME) * 100 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setTransform((prev) => {
      const rawX = prev.x + (dx / FRAME) * 100;
      const rawY = prev.y + (dy / FRAME) * 100;
      const { x, y } = clamp(rawX, rawY, prev.zoom);
      return { ...prev, x, y };
    });
  };

  const onPointerUp = () => { dragging.current = false; };

  const onZoomChange = (zoom: number) => {
    setTransform((prev) => {
      const { x, y } = clamp(prev.x, prev.y, zoom);
      return { x, y, zoom };
    });
  };

  const reset = () => setTransform(DEFAULT_TRANSFORM);

  const scale = getScale(transform.zoom);
  const imgStyle: React.CSSProperties = {
    width: `${FRAME}px`,
    height: `${FRAME}px`,
    objectFit: "contain",
    transform: `translate(${transform.x}%, ${transform.y}%) scale(${scale})`,
    transformOrigin: "center center",
    userSelect: "none",
    pointerEvents: "none",
    transition: dragging.current ? "none" : "transform 0.1s",
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-950/98 p-6 shadow-2xl shadow-black/70 flex flex-col gap-5">
        {/* Header */}
        <div>
          <h4 className="text-base font-semibold text-slate-100">{t.editorTitle}</h4>
          <p className="mt-0.5 text-xs text-slate-500">{t.editorSubtitle}</p>
        </div>

        {/* Preview frame */}
        <div className="flex justify-center">
          <div
            ref={frameRef}
            style={{ width: FRAME, height: FRAME, overflow: "hidden", borderRadius: 12, background: "#031421", cursor: dragging.current ? "grabbing" : "grab", border: "1px solid #1e3a5f", userSelect: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imgRef} src={src} alt="sprite preview" style={imgStyle} draggable={false} />
          </div>
        </div>

        {/* Zoom control */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t.editorZoom}</span>
            <span className="font-mono tabular-nums text-slate-300">
              {transform.zoom > 0 ? "+" : ""}{transform.zoom}%
            </span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={transform.zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="w-full accent-sky-500 h-2 rounded-full"
          />
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>−100%</span>
            <span>0</span>
            <span>+100%</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            {t.editorReset}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 transition"
            >
              {t.editorCancel}
            </button>
            <button
              type="button"
              onClick={() => onSave(transform)}
              className="rounded-full bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-sky-500 transition"
            >
              {t.editorSave}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [lang, setLang] = useState<Lang>("es");
  const t = UI[lang];
  const tn = (apiKey: string) => getTypeName(apiKey, lang);
  const [team, setTeam] = useState<Slot[]>(() => Array.from({ length: 6 }, EMPTY_SLOT));
  const [allTypes, setAllTypes] = useState<string[]>([]);
  const [typeRelations, setTypeRelations] = useState<Record<string, any>>({});
  const [loadingRelations, setLoadingRelations] = useState(false);
  const statLabels: [keyof BaseStats, string][] = [
    ["HP", "HP"],
    ["ATK", "ATK"],
    ["DEF", "DEF"],
    ["SP.ATK", "SP.ATK"],
    ["SP.DEF", "SP.DEF"],
    ["SPE", "SPE"],
  ];
  const getStatColor = (value: number) => {
    const ratio = Math.min(Math.max(value / 255, 0), 1);
    return `hsl(${Math.round(ratio * 120)}, 78%, 52%)`;
  };
  const [pokemonList, setPokemonList] = useState<string[]>([]);
  const [moveList, setMoveList] = useState<string[]>([]);
  // es_lower → en_slug  e.g. "lanzallamas" → "flamethrower"
  const [moveEsMap, setMoveEsMap] = useState<Record<string, string>>({});
  // reverse: en_slug → spanish display name  e.g. "flamethrower" → "Lanzallamas"
  const [moveEsDisplay, setMoveEsDisplay] = useState<Record<string, string>>({});
  const [pokemonSearch, setPokemonSearch] = useState<string[]>(() => Array.from({ length: 6 }, () => ""));
  const [pokemonResults, setPokemonResults] = useState<string[][]>(() => Array.from({ length: 6 }, () => []));
  const [pokemonOpen, setPokemonOpen] = useState<boolean[]>(() => Array.from({ length: 6 }, () => false));
  const [pokemonSelectedIdx, setPokemonSelectedIdx] = useState<number[]>(() => Array.from({ length: 6 }, () => -1));
  // moveInputDraft: what the user is currently TYPING in each move input (independent of m.name/m.nameEs)
  // null = not editing (show translated name from move data)
  const [moveInputDraft, setMoveInputDraft] = useState<(string | null)[][]>(
    () => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => null))
  );
  const [moveResults, setMoveResults] = useState<string[][][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => [])));
  const [moveOpen, setMoveOpen] = useState<boolean[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => false)));
  const [moveSelectedIdx, setMoveSelectedIdx] = useState<number[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => -1)));
  const [configSlotIndex, setConfigSlotIndex] = useState<number | null>(null);
  const [configDraftTypes, setConfigDraftTypes] = useState<string[]>([]);
  const [configDraftStats, setConfigDraftStats] = useState<BaseStatsInput>(EMPTY_STAT_INPUT);
  const [configStatsVisible, setConfigStatsVisible] = useState(false);
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([]);
  const [showPlantillas, setShowPlantillas] = useState(false);
  const [plantillaDraftName, setPlantillaDraftName] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [configDraftSprite, setConfigDraftSprite] = useState<string | null>(null);
  const [fakeSpriteSearch, setFakeSpriteSearch] = useState("");
  const [fakeSpriteLoading, setFakeSpriteLoading] = useState(false);
  const [fakeSpriteResults, setFakeSpriteResults] = useState<string[]>([]);
  const [fakeSpriteOpen, setFakeSpriteOpen] = useState(false);
  const [fakeSpriteSelectedIdx, setFakeSpriteSelectedIdx] = useState(-1);
  // ── Sprite editor state ──────────────────────────────────────────────────
  const [spriteEditorOpen, setSpriteEditorOpen] = useState(false);
  const [spriteEditorSrc, setSpriteEditorSrc] = useState<string | null>(null);
  // draft transform while editor is open
  const [editorTransform, setEditorTransform] = useState<SpriteTransform>(DEFAULT_TRANSFORM);
  // persisted transform for the config draft (saved on Apply)
  const [configDraftTransform, setConfigDraftTransform] = useState<SpriteTransform>(DEFAULT_TRANSFORM);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // Touch-based drag-and-drop for mobile
  const touchDragFrom = useRef<number | null>(null);
  const touchDragEl = useRef<HTMLElement | null>(null);
  // Stat tooltip open state per slot (tap on mobile, hover on desktop)
  const [statsTooltipOpen, setStatsTooltipOpen] = useState<boolean[]>(() => Array(6).fill(false));
  // Type picker open state per slot and move.
  const [hpTypeOpen, setHpTypeOpen] = useState<boolean[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => false)));
  const [fakeTypeOpen, setFakeTypeOpen] = useState<boolean[][]>(() => Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => false)));
  const toggleHpType = (si: number, mi: number) =>
    setHpTypeOpen((prev) => prev.map((arr, i) => i === si ? arr.map((v, j) => j === mi ? !v : v) : arr));
  const toggleFakeType = (si: number, mi: number) =>
    setFakeTypeOpen((prev) => prev.map((arr, i) => i === si ? arr.map((v, j) => j === mi ? !v : v) : arr));
  const rootRef = useRef<HTMLDivElement | null>(null);

  const openFakemonConfig = (idx: number) => {
    const slot = team[idx];
    setConfigSlotIndex(idx);
    setConfigDraftTypes(slot.types.filter(Boolean));
    setConfigDraftSprite(slot.sprite ?? null);
    setConfigDraftTransform(slot.spriteTransform ?? DEFAULT_TRANSFORM);
    setFakeSpriteSearch("");
    setConfigDraftStats({
      HP: slot.stats?.HP ? String(slot.stats.HP) : "",
      ATK: slot.stats?.ATK ? String(slot.stats.ATK) : "",
      DEF: slot.stats?.DEF ? String(slot.stats.DEF) : "",
      "SP.ATK": slot.stats?.["SP.ATK"] ? String(slot.stats["SP.ATK"]) : "",
      "SP.DEF": slot.stats?.["SP.DEF"] ? String(slot.stats["SP.DEF"]) : "",
      SPE: slot.stats?.SPE ? String(slot.stats.SPE) : "",
    });
    setConfigStatsVisible(Boolean(slot.stats));
  };

  const closeFakemonConfig = () => {
    setConfigSlotIndex(null);
    setConfigDraftTypes([]);
    setConfigDraftStats(EMPTY_STAT_INPUT);
    setConfigStatsVisible(false);
    setConfigDraftSprite(null);
    setConfigDraftTransform(DEFAULT_TRANSFORM);
    setFakeSpriteSearch("");
  };

  const toggleConfigType = (type: string) => {
    setConfigDraftTypes((prev) => {
      if (prev.includes(type)) return prev.filter((t) => t !== type);
      if (prev.length >= 2) return prev;
      return [...prev, type];
    });
  };

  const updateDraftStat = (key: keyof BaseStats, value: string) => {
    setConfigDraftStats((prev) => ({ ...prev, [key]: value }));
  };

  const saveFakemonConfig = () => {
    if (configSlotIndex === null) return;

    const parsed: Partial<BaseStats> = {};
    let hasStats = false;
    (Object.keys(configDraftStats) as Array<keyof BaseStats>).forEach((key) => {
      const text = configDraftStats[key].trim();
      const value = text === "" ? null : Math.max(1, Math.min(255, Number(text)));
      if (value !== null && !Number.isNaN(value)) {
        parsed[key] = value;
        hasStats = true;
      }
    });

    const nextTypes: [string, string] = [configDraftTypes[0] || "", configDraftTypes[1] || ""];
    updateSlot(configSlotIndex, {
      types: nextTypes,
      sprite: configDraftSprite,
      spriteTransform: configDraftSprite ? configDraftTransform : null,
      stats: hasStats ? ({
        HP: parsed.HP ?? 1,
        ATK: parsed.ATK ?? 1,
        DEF: parsed.DEF ?? 1,
        "SP.ATK": parsed["SP.ATK"] ?? 1,
        "SP.DEF": parsed["SP.DEF"] ?? 1,
        SPE: parsed.SPE ?? 1,
      } as BaseStats) : null,
    });
    closeFakemonConfig();
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 6 && parsed.every(isValidSlot)) {
        setTeam(parsed);
      }
    } catch {
      // invalid saved data, ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(team));
  }, [team]);

  // When lang changes, fetch missing translations for moves that don't have them yet
  useEffect(() => {
    team.forEach((slot, slotIdx) => {
      slot.moves.forEach((m, moveIdx) => {
        if (!m.name || m.isFake) return;
        if (/hidden.?power|poder.?oculto/i.test(m.name)) return;
        // If switching to ES and no Spanish name stored, or switching to EN and name looks Spanish → re-fetch
        const needsFetch = lang === "es" ? !m.nameEs : false;
        if (needsFetch) {
          fetchMove(m.name, slotIdx, moveIdx);
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Load saved plantillas from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SAVED_TEAMS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSavedTeams(parsed);
    } catch { /* ignore */ }
  }, []);

  const persistSavedTeams = (teams: SavedTeam[]) => {
    setSavedTeams(teams);
    if (typeof window !== "undefined") {
      localStorage.setItem(SAVED_TEAMS_KEY, JSON.stringify(teams));
    }
  };

  const saveCurrentTeam = () => {
    const name = plantillaDraftName.trim() || `Plantilla ${savedTeams.length + 1}`;
    const newEntry: SavedTeam = {
      id: Date.now(),
      name,
      team: JSON.parse(JSON.stringify(team)),
      savedAt: new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    };
    persistSavedTeams([...savedTeams, newEntry]);
    setPlantillaDraftName("");
    setSavingNew(false);
  };

  const loadSavedTeam = (saved: SavedTeam) => {
    setTeam(saved.team);
    setShowPlantillas(false);
  };

  const deleteSavedTeam = (id: number) => {
    persistSavedTeams(savedTeams.filter((t) => t.id !== id));
  };

  const overwriteSavedTeam = (id: number) => {
    persistSavedTeams(
      savedTeams.map((t) =>
        t.id === id
          ? { ...t, team: JSON.parse(JSON.stringify(team)), savedAt: new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) }
          : t
      )
    );
  };

  useEffect(() => {
    // fetch types list
    fetch("https://pokeapi.co/api/v2/type?limit=100")
      .then((r) => r.json())
      .then((data) => {
        const names = data.results.map((t: any) => t.name).filter((n: string) => n !== "shadow" && n !== "unknown");
        setAllTypes(names);
      })
      .catch(() => setAllTypes([]));
  }, []);

  // Fetch all type relations (once) when types list ready
  useEffect(() => {
    if (allTypes.length === 0) return;
    setLoadingRelations(true);
    Promise.all(
      allTypes.map((t) => fetch(`https://pokeapi.co/api/v2/type/${t}`).then((r) => r.json()).catch(() => null))
    ).then((arr) => {
      const map: Record<string, any> = {};
      arr.forEach((data: any) => {
        if (!data) return;
        map[data.name] = data.damage_relations;
      });
      setTypeRelations(map);
      setLoadingRelations(false);
    });
  }, [allTypes]);

  useEffect(() => {
    // REST: all slugs for autocomplete
    Promise.all([
      fetch("https://pokeapi.co/api/v2/pokemon?limit=100000").then((r) => r.json()).then((d) => d.results.map((x: any) => x.name)).catch(() => []),
      fetch("https://pokeapi.co/api/v2/move?limit=100000").then((r) => r.json()).then((d) => d.results.map((x: any) => x.name)).catch(() => []),
    ]).then(([pokemons, moves]) => {
      setPokemonList(pokemons || []);
      setMoveList(moves || []);
    });

    // Load Spanish move names — tries two GraphQL variants, then REST fallback
    const loadEsNames = async () => {
      const gqlVariants = [
        {
          url: "https://beta.pokeapi.co/graphql/v1beta",
          query: `{ pokemon_v2_move(limit: 2000) { name pokemon_v2_movenames(where: { pokemon_v2_language: { name: { _eq: "es" } } }) { name } } }`,
          movesKey: "pokemon_v2_move",
          namesKey: "pokemon_v2_movenames",
        },
        {
          url: "https://graphql.pokeapi.co/v1beta2",
          query: `{ move(limit: 2000) { name move_names(where: { language: { name: { _eq: "es" } } }) { name } } }`,
          movesKey: "move",
          namesKey: "move_names",
        },
      ];

      for (const { url, query, movesKey, namesKey } of gqlVariants) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          });
          if (!r.ok) continue;
          const data = await r.json();
          if (data.errors) continue;
          const moves = data?.data?.[movesKey] ?? [];
          if (moves.length === 0) continue;
          const esToEn: Record<string, string> = {};
          const enToEs: Record<string, string> = {};
          moves.forEach((m: any) => {
            const esRaw: string | undefined = m[namesKey]?.[0]?.name;
            if (esRaw) {
              esToEn[esRaw.toLowerCase()] = m.name;
              enToEs[m.name] = esRaw.charAt(0).toUpperCase() + esRaw.slice(1);
            }
          });
          if (Object.keys(esToEn).length === 0) continue;
          console.log(`[PokéRun] ES moves loaded via GraphQL: ${Object.keys(esToEn).length}`);
          setMoveEsMap(esToEn);
          setMoveEsDisplay(enToEs);
          return;
        } catch { continue; }
      }

      // Both GraphQL failed — batch load via REST for common moves
      console.warn("[PokéRun] GraphQL unavailable, using REST fallback for ES move names");
      const commonMoves = [
        "flamethrower","fire-blast","thunderbolt","thunder","surf","hydro-pump",
        "ice-beam","blizzard","psychic","shadow-ball","earthquake","stone-edge",
        "close-combat","poison-jab","iron-tail","iron-head","crunch","dark-pulse",
        "dragon-claw","outrage","dragon-pulse","flare-blitz","brave-bird","bullet-seed",
        "energy-ball","focus-blast","aura-sphere","flash-cannon","power-gem","bug-buzz",
        "x-scissor","aerial-ace","acrobatics","giga-drain","petal-blizzard","moonblast",
        "play-rough","dazzling-gleam","boomburst","hyper-voice","sludge-bomb","sludge-wave",
        "gunk-shot","leech-life","u-turn","volt-switch","flip-turn","rapid-spin",
        "recover","roost","soft-boiled","slack-off","moonlight","morning-sun",
        "protect","substitute","wish","heal-bell","aromatherapy",
        "stealth-rock","spikes","toxic-spikes","sticky-web","defog","trick-room",
        "sunny-day","rain-dance","sandstorm","hail","tailwind",
        "swords-dance","nasty-plot","calm-mind","quiver-dance","shell-smash","dragon-dance",
        "bulk-up","coil","agility","rock-polish",
        "thunder-punch","fire-punch","ice-punch","drain-punch","mach-punch",
        "bullet-punch","sucker-punch","extreme-speed","aqua-jet","shadow-sneak","quick-attack",
        "knock-off","low-kick","superpower","high-horsepower","stomping-tantrum",
        "lava-plume","heat-wave","scorching-sands","muddy-water",
        "freeze-dry","scald","strength-sap","shore-up","body-press","scale-shot",
        "expanding-force","rising-voltage","meteor-beam","glacial-lance","astral-barrage",
        "collision-course","electro-drift","rage-fist","armor-cannon","bitter-blade",
        "hidden-power","water-gun","tackle","scratch","pound","growl","leer","tail-whip",
        "vine-whip","razor-leaf","sleep-powder","stun-spore","poison-powder","fire-spin",
        "wing-attack","swift","slam","hyper-beam","toxic","double-team","reflect","light-screen",
        "rest","rock-slide","thunderwave","confuse-ray","mean-look","attract","return",
        "frustration","earthquake","dig","magnitude","rock-tomb","bullet-seed","aerial-ace",
        "spark","volt-tackle","overheat","leaf-storm","draco-meteor","eruption","water-spout",
        "spacial-rend","roar-of-time","seed-flare","shadow-force","judgment","crush-grip",
        "cross-poison","night-slash","air-slash","leaf-blade","cross-chop","vital-throw",
        "payback","assurance","foul-play","feint-attack","pursuit","bite","hyper-fang",
        "fire-fang","ice-fang","thunder-fang","psycho-cut","zen-headbutt","head-smash",
        "wood-hammer","aqua-tail","waterfall","dive","whirlpool","bind","wrap","constrict",
        "rollout","ice-ball","sparkling-aria","clanging-scales","core-enforcer",
      ];
      const esToEn: Record<string, string> = {};
      const enToEs: Record<string, string> = {};
      const chunkSize = 15;
      for (let i = 0; i < commonMoves.length; i += chunkSize) {
        const chunk = commonMoves.slice(i, i + chunkSize).filter(Boolean);
        await Promise.all(chunk.map(async (slug) => {
          try {
            const r = await fetch(`https://pokeapi.co/api/v2/move/${slug}`);
            if (!r.ok) return;
            const d = await r.json();
            const esRaw = d.names?.find((n: any) => n.language.name === "es")?.name;
            if (esRaw) {
              esToEn[esRaw.toLowerCase()] = slug;
              enToEs[slug] = esRaw.charAt(0).toUpperCase() + esRaw.slice(1);
            }
          } catch { /* skip */ }
        }));
      }
      console.log(`[PokéRun] REST fallback: ${Object.keys(esToEn).length} ES move names loaded`);
      setMoveEsMap(esToEn);
      setMoveEsDisplay(enToEs);
    };
    loadEsNames();
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setPokemonOpen((prev) => prev.map(() => false));
        setMoveOpen((prev) => prev.map((arr) => arr.map(() => false)));
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const updateSlot = (idx: number, patch: Partial<Slot>) => {
    setTeam((t) =>
      t.map((s, i) => {
        if (i !== idx) return s;
        if (patch.name !== undefined && patch.name.trim() === "") {
          return EMPTY_SLOT();
        }
        return { ...s, ...patch };
      })
    );
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    pokemonSearch.forEach((query, idx) => {
      const isFake = team[idx]?.isFake;
      if (query.trim().length >= 2 && !isFake) {
        const timer = setTimeout(() => {
          const filtered = pokemonList
            .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 8);
          setPokemonResults((prev) => prev.map((list, i) => (i === idx ? filtered : list)));
          setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? true : open)));
        }, 300);
        timers.push(timer);
      } else {
        setPokemonResults((prev) => prev.map((list, i) => (i === idx ? [] : list)));
        setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? false : open)));
      }
    });
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [pokemonSearch, pokemonList, team]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    moveInputDraft.forEach((slotDrafts, idx) => {
      slotDrafts.forEach((draft, mi) => {
        // Only search when there's an active draft
        if (draft === null || draft.trim().length < 2) {
          setMoveResults((prev) => prev.map((s, si) => si === idx ? s.map((l, mj) => mj === mi ? [] : l) : s));
          setMoveOpen((prev) => prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? false : o) : s));
          return;
        }
        const timer = setTimeout(() => {
          const query = normalizeMoveSearch(draft);

const matches = moveList.filter((enSlug) => {
  const en = normalizeMoveSearch(
    enSlug.replace(/-/g, " ")
  );

  const es = normalizeMoveSearch(
    moveEsDisplay[enSlug] ?? ""
  );

  return en.includes(query) || es.includes(query);
});

const merged = matches.slice(0, 8);

          setMoveResults((prev) => prev.map((s, si) => si === idx ? s.map((l, mj) => mj === mi ? merged : l) : s));
          setMoveOpen((prev) => prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? merged.length > 0 : o) : s));
        }, 250);
        timers.push(timer);
      });
    });
    return () => timers.forEach(clearTimeout);
  }, [moveInputDraft, moveList, moveEsDisplay]);

  const updateMove = (slotIdx: number, moveIdx: number, patch: Partial<Move>) => {
    setTeam((t) =>
      t.map((s, i) => {
        if (i !== slotIdx) return s;
        const moves = s.moves.map((m, j) => {
          if (j !== moveIdx) return m;
          // Only reset to EMPTY_MOVE when explicitly clearing the name on a real (non-fake) move
          if (patch.name !== undefined && patch.name.trim() === "" && !m.isFake && patch.isFake === undefined) {
            return EMPTY_MOVE();
          }
          // When toggling isFake off, preserve the name but clear API-derived fields
          if (patch.isFake === false) {
            return { ...m, isFake: false, type: null, category: "Physical" as Move["category"] };
          }
          // When toggling isFake on, just set the flag (keep existing name/type)
          if (patch.isFake === true) {
            return { ...m, isFake: true };
          }
          // Name update from autocomplete: also bring type + category + nameEs from patch
          if (patch.name !== undefined) {
            return {
              ...m,
              name: patch.name,
              type: patch.type ?? m.type ?? null,
              category: patch.category ?? m.category,
              // Preserve nameEs from patch if provided, else keep existing
              nameEs: patch.nameEs !== undefined ? patch.nameEs : m.nameEs,
            };
          }
          // Generic partial update (hiddenPowerType, category, type, etc.)
          return { ...m, ...patch };
        });
        return { ...s, moves };
      })
    );
  };

  const swapSlots = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setTeam((t) => {
      const next = [...t];
      const tmp = next[fromIdx];
      next[fromIdx] = next[toIdx];
      next[toIdx] = tmp;
      return next;
    });
  };

  const selectPokemonSuggestion = (idx: number, name: string) => {
    setPokemonSearch((prev) => prev.map((value, i) => (i === idx ? "" : value)));
    setPokemonResults((prev) => prev.map((list, i) => (i === idx ? [] : list)));
    setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? false : open)));
    setPokemonSelectedIdx((prev) => prev.map((sel, i) => (i === idx ? -1 : sel)));
    updateSlot(idx, { name, isFake: false });
    fetchPokemon(name, idx);
  };

  const selectMoveSuggestion = (slotIdx: number, moveIdx: number, name: string) => {
    // Clear the draft (back to display mode)
    setMoveInputDraft((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((d, mi) => mi === moveIdx ? null : d) : s)
    );
    setMoveResults((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((l, mi) => mi === moveIdx ? [] : l) : s)
    );
    setMoveOpen((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((o, mi) => mi === moveIdx ? false : o) : s)
    );
    setMoveSelectedIdx((prev) =>
      prev.map((s, si) => si === slotIdx ? s.map((sel, mi) => mi === moveIdx ? -1 : sel) : s)
    );
    updateMove(slotIdx, moveIdx, { name });
    fetchMove(name, slotIdx, moveIdx);
  };

  const fetchPokemon = async (name: string, idx: number) => {
    if (!name) return;
    try {
      const apiName = formatForAPI(name);
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
      if (!r.ok) throw new Error("not found");
      const data = await r.json();
      const types = data.types.map((t: any) => t.type.name);
      const sprite = data.sprites.front_default || data.sprites.other?.['official-artwork']?.front_default || null;
      const stats: BaseStats = {
        HP: data.stats.find((s: any) => s.stat.name === "hp")?.base_stat ?? 0,
        ATK: data.stats.find((s: any) => s.stat.name === "attack")?.base_stat ?? 0,
        DEF: data.stats.find((s: any) => s.stat.name === "defense")?.base_stat ?? 0,
        "SP.ATK": data.stats.find((s: any) => s.stat.name === "special-attack")?.base_stat ?? 0,
        "SP.DEF": data.stats.find((s: any) => s.stat.name === "special-defense")?.base_stat ?? 0,
        SPE: data.stats.find((s: any) => s.stat.name === "speed")?.base_stat ?? 0,
      };
      updateSlot(idx, { name: formatForDisplay(data.name), types, sprite, stats });
    } catch (e) {
      alert("Pokémon no encontrado: " + name);
    }
  };

  const fetchMove = async (moveName: string, slotIdx: number, moveIdx: number) => {
    if (!moveName) return;
    // Skip API fetch for fake moves or Hidden Power (no real data needed)
    const isHiddenPower = /hidden.?power|poder.?oculto/i.test(moveName);
    if (isHiddenPower) {
      updateMove(slotIdx, moveIdx, { name: moveName, category: "Special", type: "normal" });
      return;
    }
    try {
      const apiName = formatForAPI(moveName);
      const r = await fetch(`https://pokeapi.co/api/v2/move/${apiName}`);
      if (!r.ok) throw new Error("move not found");
      const data = await r.json();
      const mType = data.type.name;
      const category = data.damage_class?.name?.toLowerCase() === "status" ? "Status" : data.damage_class?.name?.toLowerCase() === "special" ? "Special" : "Physical";
      // Try to get Spanish name, fallback to formatted English
      const esName = data.names?.find((n: any) => n.language.name === "es")?.name ?? null;
      const enName = formatForDisplay(data.name);
      // Store both so we can switch language without re-fetching
      updateMove(slotIdx, moveIdx, { type: mType, category, name: enName, nameEs: esName ?? enName });
    } catch (e) {
      // ignore, leave type null
    }
  };

  // Analysis: weaknesses & strengths
  const analysis = useMemo(() => {
    const attackingTypes = Object.keys(typeRelations);
    const weaknessesCount: Record<string, number> = {};
    const strengthsCount: Record<string, number> = {};

    if (!attackingTypes.length) return { weaknesses: weaknessesCount, strengths: strengthsCount };

    // For each attacking type, compute how many Pokémon are >=2 multiplier (weak) or <=0.5 (resistant)
    attackingTypes.forEach((atk) => {
      const rel = typeRelations[atk];
      if (!rel) return;
      const doubleTo = new Set(rel.double_damage_to.map((t: any) => t.name));
      const halfTo = new Set(rel.half_damage_to.map((t: any) => t.name));
      const noTo = new Set(rel.no_damage_to.map((t: any) => t.name));

      let weak = 0;
      let resist = 0;
      team.forEach((poke) => {
        const pokeTypes = poke.types.filter(Boolean);
        if (!pokeTypes.length) return;
        let mult = 1;
        pokeTypes.forEach((def) => {
          if (noTo.has(def)) mult *= 0;
          else if (doubleTo.has(def)) mult *= 2;
          else if (halfTo.has(def)) mult *= 0.5;
        });
        if (mult >= 2) weak++;
        if (mult <= 0.5 && mult > 0) resist++;
      });

      if (weak > 0) weaknessesCount[atk] = weak;
      if (resist > 0) strengthsCount[atk] = resist;
    });

    return { weaknesses: weaknessesCount, strengths: strengthsCount };
  }, [team, typeRelations]);

  // Offense coverage
  const coverage = useMemo(() => {
    const canHitSupereffective: Record<string, number> = {};
    const canHitReduced: Record<string, number> = {};
    Object.keys(typeRelations).forEach((t) => {
      canHitSupereffective[t] = 0;
      canHitReduced[t] = 0;
    });

    team.forEach((slot) => {
      slot.moves.forEach((m) => {
        if (!m.name || m.category === "Status") return;
        // For Hidden Power, use the chosen hiddenPowerType; otherwise use m.type
        const isHP = /hidden.?power|poder.?oculto/i.test(m.name);
        const effectiveType = isHP ? (m.hiddenPowerType ?? null) : m.type;
        if (!effectiveType) return;
        const rel = typeRelations[effectiveType];
        if (!rel) return;
        rel.double_damage_to.forEach((d: any) => (canHitSupereffective[d.name]++));
        rel.half_damage_to.forEach((d: any) => (canHitReduced[d.name]++));
        rel.no_damage_to.forEach((d: any) => (canHitReduced[d.name]++));
      });
    });

    const supCount = Object.values(canHitSupereffective).filter((v) => v > 0).length;
    const redCount = Object.values(canHitReduced).filter((v) => v > 0).length;
    return { supCount, redCount, canHitSupereffective, canHitReduced };
  }, [team, typeRelations]);

  // Attack type suggestions: find which move type covers the most uncovered types
  const attackSuggestions = useMemo(() => {
    if (!Object.keys(typeRelations).length) return [];
    const uncovered = Object.entries(coverage.canHitSupereffective)
      .filter(([_, v]) => v === 0)
      .map(([t]) => t);
    if (uncovered.length === 0) return [];

    const uncoveredSet = new Set(uncovered);
    // For each possible attacking type, count how many uncovered types it hits super-effectively
    const scores: Array<{ atkType: string; covers: string[]; score: number }> = [];
    Object.keys(typeRelations).forEach((atkType) => {
      const rel = typeRelations[atkType];
      if (!rel) return;
      const covers = rel.double_damage_to
        .map((d: any) => d.name)
        .filter((t: string) => uncoveredSet.has(t));
      if (covers.length > 0) scores.push({ atkType, covers, score: covers.length });
    });
    // Sort by coverage count desc, deduplicate by coverage set to avoid near-identical suggestions
    scores.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    return scores
      .filter((s) => { const key = s.covers.slice().sort().join(","); if (seen.has(key)) return false; seen.add(key); return true; })
      .slice(0, 3);
  }, [coverage, typeRelations]);

  // Balance suggestions
  const suggestions = useMemo(() => {
    // Only show suggestions if team has at least one Pokémon with types
    const hasTeamWithTypes = team.some((slot) => slot.types.filter(Boolean).length > 0);
    if (!hasTeamWithTypes) return [];

    const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
    const all: Array<{ category: "defensive" | "offensive"; priority: number; type: string; recommendation: string; resistantTypes?: string[]; coverageTypes?: string[] }> = [];

    // Defensive suggestions: shared weaknesses (2+ Pokémon)
    Object.entries(analysis.weaknesses)
      .filter(([_, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
      .forEach(([weakType, count]) => {
        const resistantTypes = allTypes.filter((t) => {
          const rel = typeRelations[weakType];
          if (!rel) return false;
          const halfTo = new Set(rel.half_damage_to.map((x: any) => x.name));
          const noTo = new Set(rel.no_damage_to.map((x: any) => x.name));
          return halfTo.has(t) || noTo.has(t);
        });
        if (resistantTypes.length > 0) {
          all.push({
            category: "defensive",
            priority: count,
            type: weakType,
            recommendation: lang === "es"
              ? `Tu equipo tiene ${count}× debilidad a ${capitalize(weakType)}`
              : `Your team has ${count}× weakness to ${capitalize(weakType)}`,
            resistantTypes: resistantTypes.slice(0, 3),
          });
        }
      });

    // Offensive suggestions: uncovered types (0 moves)
    const uncoveredTypes = Object.entries(coverage.canHitSupereffective)
      .filter(([_, count]) => count === 0)
      .map(([t]) => t)
      .sort();
    uncoveredTypes.slice(0, 4).forEach((uncoveredType) => {
      const coverageTypes = allTypes.filter((t) => {
        const rel = typeRelations[t];
        if (!rel) return false;
        const doubleTo = new Set(rel.double_damage_to.map((x: any) => x.name));
        return doubleTo.has(uncoveredType);
      });
      if (coverageTypes.length > 0) {
        all.push({
          category: "offensive",
          priority: 1,
          type: uncoveredType,
          recommendation: lang === "es"
            ? `Sin cobertura superefectiva contra ${capitalize(uncoveredType)}`
            : `No super-effective coverage against ${capitalize(uncoveredType)}`,
          coverageTypes: coverageTypes.slice(0, 3),
        });
      }
    });

    // Sort by priority and return top 3-4
    return all
      .sort((a, b) => {
        if (a.category === b.category) return b.priority - a.priority;
        return a.category === "defensive" ? -1 : 1;
      })
      .slice(0, 4);
  }, [team, analysis, coverage, typeRelations, allTypes, lang]);

  // Stats balance analysis with role-based suggestions
  const statsAnalysis = useMemo(() => {
    const STAT_KEYS: (keyof BaseStats)[] = ["HP", "ATK", "DEF", "SP.ATK", "SP.DEF", "SPE"];
    const slotsWithStats = team.filter((s) => s.stats !== null && s.stats !== undefined);
    if (slotsWithStats.length < 3) return null;

    const count = slotsWithStats.length;
    const averages = {} as BaseStats;
    STAT_KEYS.forEach((key) => {
      const total = slotsWithStats.reduce((sum, s) => sum + (s.stats![key] ?? 0), 0);
      averages[key] = Math.round(total / count);
    });

    // More realistic thresholds for competitive Pokémon
    // ALTO ≥ 90, MEDIO 75–89, BAJO < 75
    const level = (v: number): "alto" | "medio" | "bajo" =>
      v >= 90 ? "alto" : v >= 75 ? "medio" : "bajo";

    const levels = {} as Record<keyof BaseStats, "alto" | "medio" | "bajo">;
    STAT_KEYS.forEach((k) => { levels[k] = level(averages[k]); });

    const STAT_NAMES = STAT_NAMES_I18N[lang];

    // Sort stats by average ascending to find the weakest
    const statsByAvg = [...STAT_KEYS].sort((a, b) => averages[a] - averages[b]);

    // Gap score: how far below the team's best stat each stat is
    const teamMax = Math.max(...STAT_KEYS.map((k) => averages[k]));
    const gaps = {} as Record<keyof BaseStats, number>;
    STAT_KEYS.forEach((k) => { gaps[k] = teamMax - averages[k]; });

    // Pre-compute which roles the team already has and how many
    const existingRoleCounts: Record<string, number> = {};
    slotsWithStats.forEach((s) => {
      const r = getRole(s.stats!, lang);
      if (!r) return;
      existingRoleCounts[r.label] = (existingRoleCounts[r.label] ?? 0) + 1;
    });

    // Build role suggestions: score each ROLE against team average stats
    // Prefer roles the team lacks most
    const avgStats: BaseStats = averages;
    const allRoleScores = scoreAllRoles(avgStats);

    // Sort by score ascending (weakest roles in the team avg = most needed)
    // But penalize roles already heavily covered
    const suggestions = allRoleScores
      .map(({ role, score }) => {
        const existingCount = existingRoleCounts[role[lang]] ?? 0;
        // Penalize roles the team already has plenty of: since lower score = "more needed",
        // we must ADD points (push it away from the minimum), not subtract.
        const adjustedScore = score + existingCount * 25;
        // Find which stats are weakest for this role
        const statEntries = Object.entries(role.weights) as [keyof BaseStats, number][];
        const [statA, statB] = statEntries
          .sort(([, a], [, b]) => b - a)
          .map(([k]) => k);
        return { role: { label: role[lang], color: role.color }, statA, statB: statB ?? statA, existingCount, score: adjustedScore };
      })
      .sort((a, b) => a.score - b.score); // lowest score = most needed

    const seen = new Set<string>();
    const topSuggestions = suggestions
      .filter((s) => { if (seen.has(s.role.label)) return false; seen.add(s.role.label); return true; })
      .slice(0, 2);

    // Role redundancy: flag any role with 3+ Pokémon
    const roleCounts: Record<string, { role: { label: string; color: string }; count: number; pokemon: string[] }> = {};
    slotsWithStats.forEach((s) => {
      if (!s.name) return;
      const r = getRole(s.stats!, lang);
      if (!r) return;
      if (!roleCounts[r.label]) roleCounts[r.label] = { role: r, count: 0, pokemon: [] };
      roleCounts[r.label].count++;
      roleCounts[r.label].pokemon.push(s.isFake ? `${s.name} ★` : s.name);
    });
    const redundantRoles = Object.values(roleCounts).filter((r) => r.count >= 3);

    // allBalanced: no stat is BAJO AND no big gap (>25 pts from max) AND no redundancy
    const hasLow = STAT_KEYS.some((k) => levels[k] === "bajo");
    const hasBigGap = STAT_KEYS.some((k) => gaps[k] > 25);
    const allBalanced = !hasLow && !hasBigGap && redundantRoles.length === 0;

    return { averages, levels, gaps, STAT_KEYS, STAT_NAMES, count, topSuggestions, allBalanced, redundantRoles };
  }, [team, lang]);

  // Roles summary — includes Fakemon with stats
  const rolesSummary = useMemo(() => {
    const counts: Record<string, { label: string; color: string; count: number; pokemon: string[] }> = {};
    team.forEach((slot) => {
      // Count any slot with a name and stats, including Fakemon
      if (!slot.name) return;
      if (!slot.stats) return;
      const role = getRole(slot.stats, lang);
      if (!role) return;
      if (!counts[role.label]) counts[role.label] = { ...role, count: 0, pokemon: [] };
      counts[role.label].count++;
      counts[role.label].pokemon.push(slot.isFake ? `${slot.name} ★` : slot.name);
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [team, lang]);

  // Team summary: combine type gaps + stat role gaps → suggest a Pokémon type + role
  const teamSummary = useMemo(() => {
    if (!Object.keys(typeRelations).length) return null;
    const hasTeam = team.some((s) => s.types.filter(Boolean).length > 0);
    if (!hasTeam) return null;

    // 1. Collect defensive needs: types the team is weak to (≥2 Pokémon)
    const defensiveNeeds = Object.entries(analysis.weaknesses)
      .filter(([_, c]) => c >= 2)
      .sort(([, a], [, b]) => b - a)
      .map(([t]) => t);

    // 2. Collect offensive gaps: types with 0 supereffective coverage
    const offensiveGaps = Object.entries(coverage.canHitSupereffective)
      .filter(([_, v]) => v === 0)
      .map(([t]) => t);

    // 3. Stat role needed (top suggestion from statsAnalysis)
    const neededRole = statsAnalysis?.topSuggestions?.[0] ?? null;

    if (defensiveNeeds.length === 0 && offensiveGaps.length === 0 && !neededRole) return null;

    // 4. Score each candidate type (and dual combos) by how many needs they address
    // Single types
    const candidateScores: Record<string, { score: number; defensiveCovers: string[]; offensiveCovers: string[] }> = {};

    allTypes.forEach((candidateType) => {
      const rel = typeRelations[candidateType];
      if (!rel) return;
      // Defensive: does this type RESIST the team's weak types?
      const resistedByCandidate = new Set([
        ...rel.half_damage_from?.map((x: any) => x.name) ?? [],
        ...rel.no_damage_from?.map((x: any) => x.name) ?? [],
      ]);
      const defensiveCovers = defensiveNeeds.filter((t) => resistedByCandidate.has(t));

      // Offensive: does this type hit the gaps super-effectively?
      const superEffTo = new Set(rel.double_damage_to?.map((x: any) => x.name) ?? []);
      const offensiveCovers = offensiveGaps.filter((t) => superEffTo.has(t));

      const score = defensiveCovers.length * 2 + offensiveCovers.length;
      if (score > 0) {
        candidateScores[candidateType] = { score, defensiveCovers, offensiveCovers };
      }
    });

    // Pick top 3 single types
    const topTypes = Object.entries(candidateScores)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 3)
      .map(([t, data]) => ({ type: t, ...data, isDouble: false }));

    // 5. Try top dual-type combos from top candidates
    const topCandidates = Object.entries(candidateScores)
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 5)
      .map(([t]) => t);

    let bestDual: { types: string[]; score: number; defensiveCovers: string[]; offensiveCovers: string[] } | null = null;
    for (let i = 0; i < topCandidates.length; i++) {
      for (let j = i + 1; j < topCandidates.length; j++) {
        const t1 = topCandidates[i], t2 = topCandidates[j];
        const d1 = candidateScores[t1], d2 = candidateScores[t2];
        const combinedDef = [...new Set([...d1.defensiveCovers, ...d2.defensiveCovers])];
        const combinedOff = [...new Set([...d1.offensiveCovers, ...d2.offensiveCovers])];
        const score = combinedDef.length * 2 + combinedOff.length;
        if (!bestDual || score > bestDual.score) {
          bestDual = { types: [t1, t2], score, defensiveCovers: combinedDef, offensiveCovers: combinedOff };
        }
      }
    }

    return {
      topTypes,
      bestDual,
      neededRole,
      defensiveNeeds: defensiveNeeds.slice(0, 3),
      offensiveGaps: offensiveGaps.slice(0, 3),
    };
  }, [team, analysis, coverage, typeRelations, allTypes, statsAnalysis, lang]);

  const badgeClass = (t: string) => `type-badge type-${t.replace(/\s+/g, "-").toLowerCase()}`;

  const moveCategoryClass = (category: Move["category"]) => {
    if (category === "Physical") return "bg-[#7f1d1d]/90 text-slate-200 border border-slate-700/40";
    if (category === "Special") return "bg-[#1e3a5f]/90 text-slate-200 border border-slate-700/40";
    return "bg-[#374151]/90 text-slate-200 border border-slate-700/40";
  };

  const moveCategoryDot = (category: Move["category"]) => {
    if (category === "Physical") return "⛏";
    if (category === "Special") return "✨";
    return "⚙️";
  };

  return (
    <div ref={rootRef} className="min-h-screen px-3 py-4 sm:p-6 bg-linear-to-b from-slate-900 via-[#041229] to-[#031022] text-slate-100">
      <style>{`
        /* ── PokéRun custom scrollbars ── */
        :root {
          --sb-track: #0a1628;
          --sb-thumb: #1e3a5f;
          --sb-thumb-hover: #2563eb;
          --sb-size: 6px;
        }
        /* Webkit (Chrome, Safari, Edge) */
        ::-webkit-scrollbar { width: var(--sb-size); height: var(--sb-size); }
        ::-webkit-scrollbar-track { background: var(--sb-track); border-radius: 99px; }
        ::-webkit-scrollbar-thumb { background: var(--sb-thumb); border-radius: 99px; border: 1px solid var(--sb-track); }
        ::-webkit-scrollbar-thumb:hover { background: var(--sb-thumb-hover); }
        ::-webkit-scrollbar-corner { background: var(--sb-track); }
        /* Firefox */
        * { scrollbar-width: thin; scrollbar-color: var(--sb-thumb) var(--sb-track); }
        /* Touch drag for slot reorder */
        .touch-drag-handle { touch-action: none; }
        /* xs breakpoint (≥420px) */
        @media (min-width: 420px) {
          .xs\\:inline { display: inline !important; }
          .xs\\:hidden { display: none !important; }
          .xs\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
      <header className="mb-6 sm:mb-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-600/20 border border-red-500/30 text-base">⬤</span>
            <span className="text-[11px] uppercase tracking-[0.25em] text-slate-500 font-medium">PokéRun</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language toggle */}
            <div className="flex items-center rounded-full border border-slate-700/60 bg-slate-900/70 p-0.5 gap-0.5">
              {(["es", "en"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide transition ${lang === l ? "bg-blue-700 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {l === "es" ? "🇪🇸 ES" : "🇬🇧 EN"}
                </button>
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-600 font-mono">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t.liveBadge}</span>
            </div>
          </div>
        </div>

        {/* Main hero block */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-[#050f1f] to-[#03091a] px-4 py-5 sm:px-10 sm:py-9 shadow-xl shadow-black/40">
          {/* Decorative rings */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border-[3px] border-slate-700/20 opacity-40" />
          <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full border-[2px] border-blue-700/15 opacity-40" />
          <div className="pointer-events-none absolute -right-2 -top-2 h-32 w-32 rounded-full border border-blue-600/10 opacity-40" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 32px)" }} />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-5">
            <div>
              <div className="flex flex-wrap items-baseline gap-2 mb-1.5 sm:mb-2">
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-none">🎴 PokéRun</h1>
                <span className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent leading-none">Builder</span>
                <span className="text-xl sm:text-2xl">✨</span>
              </div>
              <p className="text-xs sm:text-base text-slate-400 max-w-md leading-relaxed">{t.appSubtitle}</p>
              <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                {[t.tagTypes, t.tagCoverage, t.tagRoles, t.tagFakemons].map((tag) => (
                  <span key={tag} className="inline-flex items-center rounded-full border border-slate-700/60 bg-slate-800/60 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-slate-400 tracking-wide">{tag}</span>
                ))}
              </div>
            </div>
            <div className="flex sm:flex-col gap-2 sm:gap-3 shrink-0 overflow-x-auto pb-1 sm:pb-0">
              {([["🏆", t.labelSlots, t.statSlots], ["⚔️", t.labelMoves, t.statMoves], ["📊", t.labelAnalysis, t.statAnalysis]] as [string,string,string][]).map(([icon, label, value]) => (
                <div key={label} className="flex items-center gap-2 sm:gap-2.5 rounded-xl border border-slate-700/40 bg-slate-900/60 px-2.5 sm:px-3 py-1.5 sm:py-2 min-w-[110px] sm:min-w-[140px] shrink-0">
                  <span className="text-base sm:text-lg shrink-0">{icon}</span>
                  <div>
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-slate-500 leading-none mb-0.5">{label}</div>
                    <div className="text-[11px] sm:text-xs font-semibold text-slate-200">{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>
      {isMounted && (
      <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-6">
        <section className="pokedex-panel p-3 sm:p-4 rounded-lg h-full">
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <h2 className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-semibold tracking-tight text-slate-100">
              <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">📋</span>
              {t.myTeam}
            </h2>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowPlantillas(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-700/80 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <span>💾</span> <span className="hidden xs:inline">{t.saveTemplates}</span><span className="xs:hidden">Plantillas</span> {savedTeams.length > 0 && <span className="inline-flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-white/20 text-xs">{savedTeams.length}</span>}
            </button>
            <button
              type="button"
              onClick={() => {
                const cleared = Array.from({ length: 6 }, EMPTY_SLOT);
                setTeam(cleared);
                if (typeof window !== "undefined") {
                  localStorage.removeItem(STORAGE_KEY);
                }
              }}
              className="inline-flex items-center justify-center rounded-full bg-red-600/90 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              {t.clearTeam}
            </button>
          </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {team.map((slot, idx) => (
              <div
                key={idx}
                data-slot-idx={idx}
                className={`pokedex-card relative hover:z-20 p-2 rounded-lg border-blue-800/30 hover:shadow-lg btn-interactive flex flex-col gap-2 transition-all ${dragOverIdx === idx && dragFromIdx !== idx ? "ring-2 ring-blue-400/70 bg-blue-950/30" : ""} ${dragFromIdx === idx ? "opacity-50" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={(e) => { e.preventDefault(); if (dragFromIdx !== null) swapSlots(dragFromIdx, idx); setDragFromIdx(null); setDragOverIdx(null); }}
              >
                {/* Drag handle */}
                <div
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragFromIdx(idx); }}
                  onDragEnd={() => { setDragFromIdx(null); setDragOverIdx(null); }}
                  onTouchStart={(e) => {
                    touchDragFrom.current = idx;
                    touchDragEl.current = e.currentTarget as HTMLElement;
                    setDragFromIdx(idx);
                  }}
                  onTouchMove={(e) => {
                    if (touchDragFrom.current === null) return;
                    const touch = e.touches[0];
                    const el = document.elementFromPoint(touch.clientX, touch.clientY);
                    const card = el?.closest("[data-slot-idx]") as HTMLElement | null;
                    if (card) {
                      const overIdx = Number(card.dataset.slotIdx);
                      if (!isNaN(overIdx)) setDragOverIdx(overIdx);
                    }
                  }}
                  onTouchEnd={() => {
                    if (touchDragFrom.current !== null && dragOverIdx !== null && touchDragFrom.current !== dragOverIdx) {
                      swapSlots(touchDragFrom.current, dragOverIdx);
                    }
                    touchDragFrom.current = null;
                    setDragFromIdx(null);
                    setDragOverIdx(null);
                  }}
                  className="touch-drag-handle flex items-center justify-between text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing select-none py-1"
                  title="Arrastra para reordenar"
                >
                  <span className="text-lg tracking-widest">⠿</span>
                  <span className="text-[11px] sm:text-[13px] uppercase tracking-widest opacity-50">{t.dragHandle}</span>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-20 h-20 sm:w-32 sm:h-32 bg-[#031421] flex items-center justify-center rounded-lg shrink-0 overflow-hidden">
                    {slot.sprite ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slot.sprite}
                        alt={slot.name}
                        className="w-16 h-16 sm:w-28 sm:h-28 object-contain"
                        style={buildSpriteStyle(slot.spriteTransform)}
                      />
                    ) : (
                      <div className="text-xs text-slate-400">{t.noSprite}</div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-lg font-semibold text-slate-100 capitalize">{slot.name || "Pokémon"}</div>
                        {slot.stats ? (
                          <div className="relative inline-flex items-center group">
                            <span
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-[14px] text-slate-300 cursor-pointer"
                              onClick={() => setStatsTooltipOpen((prev) => prev.map((v, i) => i === idx ? !v : v))}
                            >ⓘ</span>
                            {/* Desktop: group-hover; Mobile: state toggle */}
                            <div className={`absolute top-0 z-50 w-72 sm:w-80 rounded-2xl border border-slate-700 bg-slate-950/97 p-4 text-sm text-slate-100 shadow-xl shadow-black/50 ${statsTooltipOpen[idx] ? "block" : "hidden group-hover:block"} ${idx % 2 === 0 ? "left-full ml-2" : "right-full mr-2"}`}
                              style={{ maxHeight: "70vh", overflowY: "auto" }}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === "es" ? "Stats base" : "Base stats"}</div>
                                <button type="button" className="sm:hidden text-slate-500 hover:text-slate-300 text-xs px-1" onClick={() => setStatsTooltipOpen((prev) => prev.map((v, i) => i === idx ? false : v))}>✕</button>
                              </div>
                              <div className="space-y-2 mb-4">
                                {statLabels.map(([key, label]) => {
                                  const value = slot.stats![key];
                                  const statNames = STAT_NAMES_I18N[lang];
                                  return (
                                    <div key={key} className="space-y-0.5">
                                      <div className="flex items-center justify-between text-[13px] text-slate-300">
                                        <span className="uppercase tracking-wide">{statNames[key]}</span>
                                        <span className="font-semibold tabular-nums">{value}</span>
                                      </div>
                                      <div className="h-1.5 rounded-full bg-slate-800">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((value / 255) * 100)}%`, backgroundColor: getStatColor(value) }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Bulk metrics (Opción B) */}
                              {(() => {
                                const bulk = getBulk(slot.stats!);
                                const speedTier = getSpeedTier(slot.stats!.SPE, lang);
                                return (
                                  <div className="mb-4 space-y-2">
                                    <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === "es" ? "Métricas" : "Metrics"}</div>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      {[
                                        { label: lang === "es" ? "Bulk fís." : "Phys. bulk", value: bulk.physical,  color: "#0369a1" },
                                        { label: lang === "es" ? "Bulk esp." : "Spec. bulk", value: bulk.special,   color: "#1d4ed8" },
                                        { label: lang === "es" ? "Poder of." : "Offense",    value: bulk.offensive, color: "#ea580c" },
                                      ].map(({ label, value, color }) => (
                                        <div key={label} className="rounded-lg bg-slate-900/80 border border-slate-700/50 px-2 py-1.5 text-center">
                                          <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
                                          <div className="text-sm font-bold" style={{ color }}>{value}</div>
                                        </div>
                                      ))}
                                    </div>
                                    {/* Speed tier (Opción D) */}
                                    <div className="flex items-center justify-between rounded-lg bg-slate-900/80 border border-slate-700/50 px-3 py-1.5">
                                      <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{lang === "es" ? "Tier velocidad" : "Speed tier"}</span>
                                      <span className="text-xs font-bold" style={{ color: speedTier.color }}>{speedTier.label} ({slot.stats!.SPE})</span>
                                    </div>
                                  </div>
                                );
                              })()}
                              {/* Role radar (Opción A) */}
                              <div className="space-y-1.5">
                                <div className="text-xs uppercase tracking-[0.3em] text-slate-500">{lang === "es" ? "Aptitud por rol" : "Role aptitude"}</div>
                                {scoreAllRoles(slot.stats!)
                                  .sort((a, b) => b.score - a.score)
                                  .slice(0, 5)
                                  .map(({ role, score }) => (
                                    <div key={role.en} className="flex items-center gap-2">
                                      <div className="text-[11px] text-slate-400 w-32 shrink-0 truncate">{role[lang]}</div>
                                      <div className="flex-1 h-1.5 rounded-full bg-slate-800">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: role.color }} />
                                      </div>
                                      <div className="text-[11px] text-slate-500 w-8 text-right tabular-nums">{score}%</div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {slot.stats && (() => {
                          const role = getRole(slot.stats, lang);
                          return role ? (
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold text-white tracking-wide"
                              style={{ backgroundColor: role.color + "cc" }}
                            >
                              {role.label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {slot.types.filter(Boolean).length ? (
                          slot.types.filter(Boolean).map((t_) => (
                            <span key={t_} className={badgeClass(t_)}>
                              {tn(t_)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">{t.noTypes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-wrap items-center gap-2 text-sm text-slate-300">
                  <input
                    value={slot.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateSlot(idx, { name: value });
                      setPokemonSearch((prev) => prev.map((current, i) => (i === idx ? value : current)));
                    }}
                    onKeyDown={(e) => {
                      if (!pokemonOpen[idx] || pokemonResults[idx].length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setPokemonSelectedIdx((prev) =>
                          prev.map((sel, i) =>
                            i === idx ? Math.min(sel + 1, pokemonResults[idx].length - 1) : sel
                          )
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setPokemonSelectedIdx((prev) =>
                          prev.map((sel, i) => (i === idx ? Math.max(sel - 1, -1) : sel))
                        );
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        if (pokemonSelectedIdx[idx] >= 0 && pokemonSelectedIdx[idx] < pokemonResults[idx].length) {
                          selectPokemonSuggestion(idx, pokemonResults[idx][pokemonSelectedIdx[idx]]);
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setPokemonOpen((prev) => prev.map((open, i) => (i === idx ? false : open)));
                      }
                    }}
                    placeholder={slot.isFake ? t.searchFakemon : t.searchPokemon}
                    className="min-w-0 flex-1 bg-transparent border border-blue-800/40 text-slate-100 placeholder-slate-500 px-2 py-1.5 rounded focus:outline-none focus:ring-2 focus:ring-blue-700 text-[13px] sm:text-sm"
                  />
                  {!slot.isFake && (
                    <button
                      onClick={() => fetchPokemon(slot.name, idx)}
                      className="px-2.5 sm:px-3 py-1 bg-linear-to-r from-blue-700 to-indigo-900 text-white rounded btn-interactive whitespace-nowrap text-xs sm:text-sm"
                    >
                      {t.btnSearch}
                    </button>
                  )}
                  <div className="inline-flex items-center gap-2 sm:gap-3">
                    <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-sm">
                      <input
                        type="checkbox"
                        checked={slot.isFake}
                        onChange={(e) => updateSlot(idx, { isFake: e.target.checked })}
                        className="accent-sky-500"
                      />
                      {t.checkFakemon}
                    </label>
                    {slot.isFake ? (
                      <button
                        type="button"
                        onClick={() => openFakemonConfig(idx)}
                        className="rounded-full bg-slate-800/90 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.15em] text-slate-200 transition hover:bg-slate-700"
                      >
                        {t.btnConfigure}
                      </button>
                    ) : null}
                  </div>
                </div>
                {!slot.isFake && pokemonOpen[idx] && pokemonResults[idx].length > 0 && (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/95 shadow-lg text-sm">
                    {pokemonResults[idx].map((name, resultIdx) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectPokemonSuggestion(idx, name);
                        }}
                        onMouseEnter={() =>
                          setPokemonSelectedIdx((prev) =>
                            prev.map((sel, i) => (i === idx ? resultIdx : sel))
                          )
                        }
                        className={`w-full text-left px-3 py-2 ${
                          pokemonSelectedIdx[idx] === resultIdx ? "bg-blue-700/60" : "hover:bg-slate-700/80"
                        } focus:bg-slate-700/80`}
                      >
                        {formatForDisplay(name)}
                      </button>
                    ))}
                  </div>
                )}
                {slot.isFake ? (
                  <div className="mt-3 rounded-2xl border border-slate-800/60 bg-slate-950/60 p-3 text-slate-300">
                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">{t.fakemonConfigured}</div>
                    <div className="flex flex-wrap gap-2">
                      {slot.types.filter(Boolean).length ? (
                        slot.types.filter(Boolean).map((type) => (
                          <span key={type} className={badgeClass(type)}>
                            {tn(type)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">{t.noTypesSet}</span>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {slot.moves.map((m, mi) => {
                    const isHP = /hidden.?power|poder.?oculto/i.test(m.name);
                    const CategoryIcon = ({ cat }: { cat: string }) => {
                      if (cat === "Physical") return (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="8.5" fill="#C03028" stroke="#7f1010" strokeWidth="1"/>
                          <path d="M5 13L9 5L13 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          <circle cx="9" cy="5" r="1.5" fill="white"/>
                        </svg>
                      );
                      if (cat === "Special") return (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="8.5" fill="#6890F0" stroke="#1e3a8a" strokeWidth="1"/>
                          <path d="M9 4L10.2 7.5H14L11 9.8L12.2 13.2L9 11L5.8 13.2L7 9.8L4 7.5H7.8L9 4Z" fill="white"/>
                        </svg>
                      );
                      return (
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="9" r="8.5" fill="#705898" stroke="#3b1e6b" strokeWidth="1"/>
                          <circle cx="9" cy="9" r="3.5" fill="white" opacity="0.9"/>
                          <circle cx="9" cy="9" r="1.5" fill="#705898"/>
                        </svg>
                      );
                    };
                    return (
                      <div key={mi} className="pokedex-card rounded-xl border-blue-800/30 p-2.5 sm:p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">{t.attackSlot} {mi + 1}</div>
                          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!m.isFake}
                              onChange={(e) => updateMove(idx, mi, { isFake: e.target.checked })}
                              className="h-4 w-4 accent-sky-500"
                            />
                            {t.moveInvented}
                          </label>
                        </div>

                        {m.isFake ? (
                          <div className="space-y-3">
                            <input
                              placeholder={t.fakeMovePlaceholder}
                              value={m.name}
                              onChange={(e) => updateMove(idx, mi, { name: e.target.value })}
                              className="w-full rounded-lg border border-blue-800/40 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
                            />
                            <select
                              value={m.category}
                              onChange={(e) => updateMove(idx, mi, { category: e.target.value as Move["category"] })}
                              className="w-full rounded-lg border border-blue-800/40 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                            >
                              <option value="Physical">{t.catPhysical}</option>
                              <option value="Special">{t.catSpecial}</option>
                              <option value="Status">{t.catStatus}</option>
                            </select>
                            <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-2">
                              <button
                                type="button"
                                onClick={() => toggleFakeType(idx, mi)}
                                className="flex w-full items-center justify-between gap-2 text-sm font-medium text-sky-300 transition hover:text-sky-200"
                              >
                                <span>{t.fakeTypeLabel}{m.type ? `: ${tn(m.type)}` : ""}</span>
                                <span>{fakeTypeOpen[idx][mi] ? "▾" : "▸"}</span>
                              </button>
                              {fakeTypeOpen[idx][mi] && (
                                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {allTypes.map((ty) => (
                                    <button
                                      key={ty}
                                      type="button"
                                      onClick={() => updateMove(idx, mi, { type: m.type === ty ? null : ty })}
                                      className={`${badgeClass(ty)} type-picker-badge min-h-8 w-full px-2 py-1 opacity-75 transition hover:opacity-100 ${m.type === ty ? "ring-2 ring-white/70 opacity-100" : ""}`}
                                    >
                                      {tn(ty)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <input
                              placeholder={t.movePlaceholder}
                              value={moveInputDraft[idx][mi] !== null
                                ? moveInputDraft[idx][mi]!
                                : (() => {
                                    if (lang !== "es") return m.name;
                                    // Priority: stored nameEs → bulk-loaded ES map → EN name
                                    return m.nameEs || moveEsDisplay[m.name] || m.name;
                                  })()
                              }
                              onFocus={() => {
                                // Enter edit mode: pre-fill with the current translated display name
                                const display = lang === "es"
                                  ? (m.nameEs || moveEsDisplay[m.name] || m.name)
                                  : m.name;
                                setMoveInputDraft((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? display : d) : s)
                                );
                              }}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Update draft only — never touch m.name/m.nameEs while typing
                                setMoveInputDraft((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? value : d) : s)
                                );
                              }}
                              onKeyDown={(e) => {
                                if (!moveOpen[idx][mi] || moveResults[idx][mi].length === 0) return;
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  setMoveSelectedIdx((prev) =>
                                    prev.map((s, si) => si === idx
                                      ? s.map((sel, mj) => mj === mi ? Math.min(sel + 1, moveResults[idx][mi].length - 1) : sel)
                                      : s)
                                  );
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  setMoveSelectedIdx((prev) =>
                                    prev.map((s, si) => si === idx
                                      ? s.map((sel, mj) => mj === mi ? Math.max(sel - 1, -1) : sel)
                                      : s)
                                  );
                                } else if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (moveSelectedIdx[idx][mi] >= 0 && moveSelectedIdx[idx][mi] < moveResults[idx][mi].length) {
                                    selectMoveSuggestion(idx, mi, moveResults[idx][mi][moveSelectedIdx[idx][mi]]);
                                  }
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  // Cancel edit: revert to display mode
                                  setMoveInputDraft((prev) =>
                                    prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? null : d) : s)
                                  );
                                  setMoveOpen((prev) =>
                                    prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? false : o) : s)
                                  );
                                }
                              }}
                              onBlur={() => {
                                const draft = moveInputDraft[idx][mi];
                                if (draft === null) return;
                                // Resolve: try ES map first, then use draft as English slug
                                const normalized = normalizeMoveSearch(draft);

const enSlug =
  Object.entries(moveEsMap).find(
    ([es]) => normalizeMoveSearch(es) === normalized
  )?.[1] ?? formatForAPI(draft);
                                // Clear draft → back to display mode
                                setMoveInputDraft((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((d, mj) => mj === mi ? null : d) : s)
                                );
                                setMoveOpen((prev) =>
                                  prev.map((s, si) => si === idx ? s.map((o, mj) => mj === mi ? false : o) : s)
                                );
                                if (enSlug) {
                                  updateMove(idx, mi, { name: enSlug });
                                  fetchMove(enSlug, idx, mi);
                                }
                              }}
                              className="w-full rounded-lg border border-blue-800/40 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-sky-500"
                            />
                            {moveOpen[idx][mi] && moveResults[idx][mi].length > 0 && (
                              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/95 text-sm shadow-lg">
                                {moveResults[idx][mi].map((name, resultIdx) => {
                                  // Show ES display name if available, EN slug as hint
                                  const esDisplay = moveEsDisplay[name];
                                  const label = lang === "es" && esDisplay ? esDisplay : formatForDisplay(name);
                                  const hint = lang === "es" && esDisplay ? formatForDisplay(name) : undefined;
                                  return (
                                    <button
                                      key={name}
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        selectMoveSuggestion(idx, mi, name);
                                      }}
                                      onMouseEnter={() =>
                                        setMoveSelectedIdx((prev) =>
                                          prev.map((s, si) => si === idx
                                            ? s.map((sel, mj) => mj === mi ? resultIdx : sel)
                                            : s)
                                        )
                                      }
                                      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 ${
                                        moveSelectedIdx[idx][mi] === resultIdx ? "bg-blue-700/60" : "hover:bg-slate-700/80"
                                      }`}
                                    >
                                      <span>{label}</span>
                                      {hint && <span className="text-[11px] text-slate-500 shrink-0">{hint}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {isHP && (
                              <div className="mt-3 rounded-lg border border-sky-900/50 bg-sky-950/20 p-2">
                                <button
                                  type="button"
                                  onClick={() => toggleHpType(idx, mi)}
                                  className="flex w-full items-center justify-between gap-2 text-sm font-medium text-sky-300 transition hover:text-sky-200"
                                >
                                  <span>{t.hpTypeLabel}{m.hiddenPowerType ? `: ${tn(m.hiddenPowerType)}` : ""}</span>
                                  <span>{hpTypeOpen[idx][mi] ? "▾" : "▸"}</span>
                                </button>
                                {hpTypeOpen[idx][mi] && (
                                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                    {allTypes.filter((ty) => ty !== "normal" && ty !== "fairy").map((ty) => (
                                      <button
                                        key={ty}
                                        type="button"
                                        onClick={() => updateMove(idx, mi, { hiddenPowerType: m.hiddenPowerType === ty ? null : ty })}
                                        className={`${badgeClass(ty)} min-h-7 px-2 py-1 text-[12px] opacity-75 transition hover:opacity-100 ${m.hiddenPowerType === ty ? "ring-2 ring-white/70 opacity-100" : ""}`}
                                      >
                                        {tn(ty)}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800/70 pt-3">
                          <span className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${moveCategoryClass(m.category)}`}>
                            <CategoryIcon cat={m.category} />
                            {m.category === "Physical" ? t.catPhysical : m.category === "Special" ? t.catSpecial : t.catStatus}
                          </span>
                          {isHP && m.hiddenPowerType ? (
                            <span className={`${badgeClass(m.hiddenPowerType)} min-h-8 px-3 py-1 text-sm`}>{tn(m.hiddenPowerType)}</span>
                          ) : m.type ? (
                            <span className={`${badgeClass(m.type)} min-h-8 px-3 py-1 text-sm`}>{tn(m.type)}</span>
                          ) : (
                            <span className="inline-flex min-h-8 items-center rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-500">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="pokedex-panel p-3 sm:p-4 rounded-lg h-full flex flex-col gap-4 min-h-0 overflow-hidden">
          <h2 className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-semibold tracking-tight mb-1 sm:mb-2 text-slate-100">
            <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">📊</span>
            {lang === "es" ? "Análisis" : "Analysis"}
          </h2>
          <div className="grid gap-2 flex-1 min-h-0 overflow-hidden">
            <div className="p-3 sm:p-4 pokedex-card rounded-lg border-blue-800/30 h-full min-h-0 overflow-hidden">
              <div className="flex items-center gap-2 text-base sm:text-lg font-semibold tracking-tight mb-2 sm:mb-3 text-slate-100">
                <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">⚔️</span>
                {lang === "es" ? "Tipos" : "Types"}
              </div>
              {loadingRelations ? (
                <div className="text-slate-300">{lang === "es" ? "Cargando relaciones de tipos..." : "Loading type chart..."}</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
                    <div className="rounded-lg bg-slate-950/70 p-3 border border-blue-800/20">
                      <div className="font-semibold text-slate-100 mb-2">{t.weaknesses} (×2 {lang === "es" ? "o más" : "or more"})</div>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(analysis.weaknesses).length ? (
                          Object.entries(analysis.weaknesses)
                            .sort(([, a], [, b]) => b - a)
                            .map(([ty, c]) => (
                              <div key={ty} className={`flex items-center gap-1.5 h-10 rounded-lg bg-slate-900/80 px-2.5 py-1 text-slate-200 whitespace-nowrap w-fit ${c >= 3 ? "border border-amber-500/30 shadow-sm shadow-amber-500/10" : ""}`}>
                                <span className={`${badgeClass(ty)} text-[14px]`}>{tn(ty)}</span>
                                <span className={`text-xs font-semibold ${c >= 3 ? "text-amber-200" : "text-slate-300"}`}>{c}×</span>
                              </div>
                            ))
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-lg bg-slate-900/80 px-3 py-4 text-slate-500 text-sm gap-2">
                            <span className="text-lg">∘</span>
                            <span>{lang === "es" ? "No hay datos de debilidades aún" : "No weakness data yet"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-950/70 p-3 border border-blue-800/20">
                      <div className="font-semibold text-slate-100 mb-2">{t.strengths} (≤×0.5)</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(analysis.strengths).length ? (
                          Object.entries(analysis.strengths)
                            .sort(([, a], [, b]) => b - a)
                            .map(([ty, c]) => (
                              <div key={ty} className={`flex items-center gap-1.5 h-10 rounded-lg bg-slate-900/80 px-2.5 py-1 text-slate-200 whitespace-nowrap w-fit ${c >= 3 ? "border border-emerald-500/30 shadow-sm shadow-emerald-500/10" : ""}`}>
                                <span className={`${badgeClass(ty)} text-[14px]`}>{tn(ty)}</span>
                                <span className={`text-xs font-semibold ${c >= 3 ? "text-emerald-200" : "text-slate-300"}`}>{c}×</span>
                              </div>
                            ))
                        ) : (
                          <div className="flex flex-col items-center justify-center rounded-lg bg-slate-900/80 px-3 py-4 text-slate-500 text-sm gap-2">
                            <span className="text-lg">∘</span>
                            <span>No hay datos de resistencias aún</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4 pokedex-card rounded-lg border-blue-800/30 h-full min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 text-base sm:text-lg font-semibold tracking-tight mb-2 sm:mb-3 text-slate-100">
                <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">⚡</span>
                {t.coverageTitle}
              </div>
              <div className="flex-1 grid gap-3 min-h-0 overflow-hidden">
                <div className="rounded-lg bg-slate-950/70 p-3 border border-blue-800/20 text-slate-200">
                  <div className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-1">{t.coverageTypesCovered}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold">{coverage.supCount}</span>
                    <span className="text-slate-500 text-sm">/ {Object.keys(typeRelations).length} {t.coverageOf}</span>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-slate-100 mb-2 text-sm">{t.superEffective}</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(coverage.canHitSupereffective)
                      .filter(([_, v]) => v > 0)
                      .map(([ty]) => (
                        <div key={ty} className="flex items-center gap-1.5 h-8 rounded-lg bg-slate-900/80 px-2 py-1 text-slate-200 whitespace-nowrap w-fit">
                          <span className={`${badgeClass(ty)} text-[14px]`}>{tn(ty)}</span>
                          <span className="text-xs font-semibold text-slate-300">{coverage.canHitSupereffective[ty]}×</span>
                        </div>
                      ))}
                    {Object.values(coverage.canHitSupereffective).every((v) => v === 0) && (
                      <span className="text-sm text-slate-500">{lang === "es" ? "Añade movimientos para ver cobertura" : "Add moves to see coverage"}</span>
                    )}
                  </div>
                </div>
                {attackSuggestions.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-100 mb-2 text-sm">{t.atkSuggTitle}</div>
                    <div className="space-y-2">
                      {attackSuggestions.map(({ atkType, covers }) => {
                        const allSuperEffective = typeRelations[atkType]?.double_damage_to?.map((d: any) => d.name) ?? [];
                        const secondaryCoverage = allSuperEffective.filter((ty: string) => !covers.includes(ty));
                        return (
                          <div key={atkType} className="rounded-xl border border-slate-700/40 bg-slate-900/60 px-3 py-2">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className={`${badgeClass(atkType)} text-[14px] shrink-0`}>{tn(atkType)}</span>
                              <span className="text-xs text-slate-400">{t.atkSuggCovers} {covers.length} {t.atkSuggUncovered}</span>
                              {covers.map((ty: string) => (
                                <span key={ty} className={`${badgeClass(ty)} text-[14px]`}>{tn(ty)}</span>
                              ))}
                            </div>
                            {secondaryCoverage.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[13px] text-slate-600">{t.atkSuggAlso}</span>
                                {secondaryCoverage.map((ty: string) => (
                                  <span key={ty} className={`${badgeClass(ty)} text-[12px] px-1.5 py-0.5 opacity-50`}>{tn(ty)}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 sm:p-4 pokedex-card rounded-lg border-blue-800/30 h-full min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 text-base sm:text-lg font-semibold tracking-tight mb-2 sm:mb-3 text-slate-100">
                <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">💡</span>
                {t.balanceSugg}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                {suggestions.length > 0 ? (
                  <>
                    {suggestions.map((sug, idx) => (
                      <div key={idx} className="rounded-lg bg-slate-900/50 p-2.5 border border-slate-700/40 space-y-1.5">
                        <div className="text-xs font-semibold text-slate-200">{sug.recommendation}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(sug.resistantTypes || []).map((ty) => (
                            <span key={ty} className={`${badgeClass(ty)} text-[13px] px-2 py-0.5`}>{tn(ty)}</span>
                          ))}
                          {(sug.coverageTypes || []).map((ty) => (
                            <span key={ty} className={`${badgeClass(ty)} text-[13px] px-2 py-0.5`}>{tn(ty)}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                ) : team.some((slot) => slot.types.filter(Boolean).length > 0) ? (
                  <div className="flex flex-col items-center justify-center py-4 text-slate-500 text-sm">
                    <span className="text-lg mb-1">✓</span>
                    <span>{t.balancedTeam}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-slate-500 text-sm">
                    <span className="text-lg mb-1">-</span>
                    <span>{t.loadPokemon}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-3 sm:p-4 pokedex-card rounded-lg border-blue-800/30 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 text-base sm:text-lg font-semibold tracking-tight mb-2 sm:mb-3 text-slate-100">
                <span className="inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-900/80 text-slate-200">📈</span>
                {t.statsBalance}
              </div>
              {statsAnalysis ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {statsAnalysis.STAT_KEYS.map((key) => {
                      const value = statsAnalysis.averages[key];
                      const lv = statsAnalysis.levels[key];
                      const lvColor = lv === "alto" ? "text-emerald-400" : lv === "medio" ? "text-yellow-400" : "text-red-400";
                      const lvLabel = lv === "alto" ? t.statLevelHigh : lv === "medio" ? t.statLevelMid : t.statLevelLow;
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-[14px] uppercase tracking-[0.15em]">
                            <span className="text-slate-300 w-16">{statsAnalysis.STAT_NAMES[key]}</span>
                            <span className="text-slate-400 w-8 text-center">{value}</span>
                            <span className={`font-semibold w-12 text-right ${lvColor}`}>{lvLabel}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.round((value / 255) * 100)}%`, backgroundColor: getStatColor(value) }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {statsAnalysis.allBalanced ? (
                    <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/30 px-3 py-2.5 text-xs text-emerald-300 leading-relaxed">
                      {t.balancedOk}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {statsAnalysis.redundantRoles.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[13px] uppercase tracking-[0.2em] text-amber-500">{t.redundantRoles}</div>
                          {statsAnalysis.redundantRoles.map(({ role, count: rc, pokemon }) => (
                            <div key={role.label} className="flex items-center gap-3 rounded-xl border border-amber-800/40 bg-amber-950/30 px-3 py-2.5">
                              <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[14px] font-semibold text-white" style={{ backgroundColor: role.color + "cc" }}>
                                {role.label}
                              </span>
                              <div className="text-xs text-amber-300 leading-relaxed">
                                <span className="font-semibold">{rc} {t.redundantDesc}</span> ({pokemon.join(", ")}) {t.redundantNote}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {statsAnalysis.topSuggestions.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[13px] uppercase tracking-[0.2em] text-slate-500">{t.roleSuggTitle}</div>
                          {statsAnalysis.topSuggestions.map(({ role, statA, statB, existingCount }) => {
                            const gapA = statsAnalysis.gaps[statA];
                            const gapB = statsAnalysis.gaps[statB];
                            const isUrgent = statsAnalysis.levels[statA] === "bajo" || statsAnalysis.levels[statB] === "bajo";
                            return (
                              <div key={role.label} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isUrgent ? "border-red-800/40 bg-red-950/20" : "border-slate-700/40 bg-slate-900/60"}`}>
                                <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[14px] font-semibold text-white" style={{ backgroundColor: role.color + "cc" }}>
                                  {role.label}
                                </span>
                                <div className="text-xs text-slate-300 leading-relaxed">
                                  {existingCount > 0
                                    ? <>{t.roleExisting} <span className="font-semibold text-yellow-300">{existingCount}</span> {t.roleExistingMid} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statA]}</span> ({gapA} {t.rolesBelowBest}) {lang === "es" ? "y" : "and"} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statB]}</span> ({gapB} {t.rolesBelowBest})</>
                                    : <>{isUrgent ? <span className="text-red-300 font-semibold">{t.roleNew}</span> : t.roleNewAlt} {lang === "es" ? "en" : "in"} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statA]}</span> {lang === "es" ? "y" : "and"} <span className="font-semibold text-slate-100">{statsAnalysis.STAT_NAMES[statB]}</span> — {t.roleNewEnd} {role.label}</>
                                  }
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  {rolesSummary.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[13px] uppercase tracking-[0.2em] text-slate-500">{t.teamRoles}</div>
                      <div className="flex flex-wrap gap-2">
                        {rolesSummary.map((r) => (
                          <div key={r.label} className="group relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[14px] font-semibold text-white cursor-default" style={{ backgroundColor: r.color + "cc" }}>
                            <span>{r.label}</span>
                            {r.count > 1 && <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[13px]">{r.count}</span>}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-300 whitespace-nowrap shadow-lg">
                              {r.pokemon.join(", ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-[13px] text-slate-500 text-right">{t.basedOn} {statsAnalysis.count} {t.basedOnEnd}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500 text-sm gap-2">
                  <span className="text-2xl">📊</span>
                  <span>{t.loadStats}</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      {/* Team Summary Panel */}
      {teamSummary && (
        <div className="mt-0">
          <div className="p-3 sm:p-4 pokedex-panel rounded-lg max-w-4xl mx-auto">
            <div className="flex items-center gap-2 text-base font-semibold tracking-tight mb-3 text-slate-100">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-slate-200 text-sm">🎯</span>
              {t.summaryTitle}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {teamSummary.topTypes.length > 0 && (
                <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 p-3 space-y-2">
                  <div className="text-[14px] uppercase tracking-[0.2em] text-slate-500">{t.bestSingle}</div>
                  {teamSummary.topTypes.slice(0, 2).map(({ type, defensiveCovers, offensiveCovers }) => (
                    <div key={type} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`${badgeClass(type)} text-xs`}>{tn(type)}</span>
                        {teamSummary.neededRole?.role?.label && (
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[14px] font-semibold text-white" style={{ backgroundColor: (teamSummary.neededRole.role.color ?? "#333") + "cc" }}>
                            {teamSummary.neededRole.role.label}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs text-slate-400">
                        {defensiveCovers.length > 0 && (
                          <span className="flex items-center gap-1 flex-wrap">{t.summaryResists}{defensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                        )}
                        {offensiveCovers.length > 0 && (
                          <span className="flex items-center gap-1 flex-wrap">{t.summaryCovers}{offensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {teamSummary.bestDual && teamSummary.bestDual.score > (teamSummary.topTypes[0]?.score ?? 0) && (
                <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-3 space-y-2">
                  <div className="text-[14px] uppercase tracking-[0.2em] text-blue-400">{t.bestDual}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {teamSummary.bestDual.types.map((ty) => (
                      <span key={ty} className={`${badgeClass(ty)} text-xs`}>{tn(ty)}</span>
                    ))}
                    {teamSummary.neededRole?.role?.label && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[14px] font-semibold text-white" style={{ backgroundColor: (teamSummary.neededRole.role.color ?? "#333") + "cc" }}>
                        {teamSummary.neededRole.role.label}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 text-xs text-slate-400">
                    {teamSummary.bestDual.defensiveCovers.length > 0 && (
                      <span className="flex items-center gap-1 flex-wrap">{t.summaryResists}{teamSummary.bestDual.defensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                    )}
                    {teamSummary.bestDual.offensiveCovers.length > 0 && (
                      <span className="flex items-center gap-1 flex-wrap">{t.summaryCovers}{teamSummary.bestDual.offensiveCovers.map((ty) => <span key={ty} className={`${badgeClass(ty)} text-[13px] px-1.5 py-0.5 mx-0.5`}>{tn(ty)}</span>)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Narrative summary */}
            <div className="mt-3 rounded-xl border border-slate-700/30 bg-slate-900/40 px-3 py-2.5 text-sm text-slate-200 leading-relaxed">
              {teamSummary.neededRole?.role?.label
                ? lang === "es"
                  ? `Tu equipo se beneficiaría de un Pokémon con rol de ${teamSummary.neededRole.role.label}${teamSummary.topTypes[0] ? `, preferiblemente de tipo ${tn(teamSummary.topTypes[0].type)}${teamSummary.bestDual && teamSummary.bestDual.score > (teamSummary.topTypes[0]?.score ?? 0) ? ` o doble tipo ${teamSummary.bestDual.types.map(tn).join("/")}` : ""}` : ""}.`
                  : `Your team would benefit from a Pokémon with the ${teamSummary.neededRole.role.label} role${teamSummary.topTypes[0] ? `, ideally ${tn(teamSummary.topTypes[0].type)} type${teamSummary.bestDual && teamSummary.bestDual.score > (teamSummary.topTypes[0]?.score ?? 0) ? ` or dual ${teamSummary.bestDual.types.map(tn).join("/")}` : ""}` : ""}.`
                : lang === "es"
                  ? `Considera añadir un Pokémon de tipo ${tn(teamSummary.topTypes[0]?.type ?? "")}${teamSummary.bestDual && teamSummary.bestDual.score > (teamSummary.topTypes[0]?.score ?? 0) ? ` o doble tipo ${teamSummary.bestDual.types.map(tn).join("/")}` : ""} para equilibrar el equipo.`
                  : `Consider adding a ${tn(teamSummary.topTypes[0]?.type ?? "")} type Pokémon${teamSummary.bestDual && teamSummary.bestDual.score > (teamSummary.topTypes[0]?.score ?? 0) ? ` or dual ${teamSummary.bestDual.types.map(tn).join("/")}` : ""} to balance the team.`
              }
            </div>
          </div>
        </div>
      )}
      </div>
      )}
      {showPlantillas && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowPlantillas(false); setSavingNew(false); setPlantillaDraftName(""); } }}
        >
        <div className="w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-950/97 p-4 sm:p-6 text-slate-100 shadow-2xl shadow-black/60 flex flex-col gap-4 my-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-100">{t.templateTitle}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{t.templateSubtitle}</p>
              </div>
              <button type="button" onClick={() => { setShowPlantillas(false); setSavingNew(false); setPlantillaDraftName(""); }}
                className="rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100">
                {t.templateClose}
              </button>
            </div>
            <div className="space-y-2 max-h-[50vh] sm:max-h-64 overflow-y-auto pr-1">
              {savedTeams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-sm gap-2">
                  <span className="text-3xl">📂</span>
                  <span>{t.templateEmpty}</span>
                </div>
              ) : (
                savedTeams.map((saved) => {
                  const filledCount = saved.team.filter((s) => s.name).length;
                  const types = saved.team.flatMap((s) => s.types.filter(Boolean)).slice(0, 6);
                  return (
                    <div key={saved.id} className="flex items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/60 px-3 sm:px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-100 text-sm truncate">{saved.name}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {types.map((ty, i) => (
                            <span key={i} className={`${badgeClass(ty)} text-[12px] px-1.5 py-0.5`}>{tn(ty)}</span>
                          ))}
                          {filledCount === 0 && <span className="text-[13px] text-slate-500">{t.templateEmptyTeam}</span>}
                        </div>
                        <div className="text-[12px] sm:text-[13px] text-slate-500 mt-1">{filledCount}/6 {t.templatePokemon} · {saved.savedAt}</div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button type="button" onClick={() => loadSavedTeam(saved)}
                          className="rounded-full bg-blue-700/80 px-2.5 sm:px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-600">{t.templateLoad}</button>
                        <button type="button" onClick={() => overwriteSavedTeam(saved.id)}
                          className="rounded-full bg-slate-700/80 px-2.5 sm:px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-600">{t.templateOverwrite}</button>
                        <button type="button" onClick={() => deleteSavedTeam(saved.id)}
                          className="rounded-full bg-red-900/60 px-2.5 sm:px-3 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-800/60">{t.templateDelete}</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {savedTeams.length < MAX_PLANTILLAS ? (
              savingNew ? (
                <div className="flex gap-2 items-center border-t border-slate-800 pt-4">
                  <input type="text" placeholder={`${t.templateNamePlaceholder} ${savedTeams.length + 1}`} value={plantillaDraftName}
                    onChange={(e) => setPlantillaDraftName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveCurrentTeam(); if (e.key === "Escape") { setSavingNew(false); setPlantillaDraftName(""); } }}
                    autoFocus
                    className="flex-1 rounded-full border border-blue-700/50 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                  />
                  <button type="button" onClick={saveCurrentTeam} className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600">{t.templateSave}</button>
                  <button type="button" onClick={() => { setSavingNew(false); setPlantillaDraftName(""); }} className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-400 transition hover:text-slate-200">{t.templateCancel}</button>
                </div>
              ) : (
                <div className="border-t border-slate-800 pt-4">
                  <button type="button" onClick={() => setSavingNew(true)}
                    className="w-full rounded-full border border-dashed border-blue-700/50 bg-blue-900/20 px-4 py-2.5 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/40 hover:border-blue-500">
                    {t.templateSaveBtn}
                  </button>
                </div>
              )
            ) : (
              <div className="border-t border-slate-800 pt-4 text-center text-xs text-slate-500">
                {t.templateMaxReached} {MAX_PLANTILLAS} {t.templateMaxEnd}
              </div>
            )}
          </div>
        </div>
      )}
      {configSlotIndex !== null ? (        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) closeFakemonConfig(); }}
        >
          <div className="w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-950/95 p-4 sm:p-6 text-slate-100 shadow-2xl shadow-black/60 my-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-100">{t.configTitle}</h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-400">{t.configSubtitle}</p>
              </div>
              <button type="button" onClick={closeFakemonConfig}
                className="self-start rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100">
                {t.configClose}
              </button>
            </div>
            <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              {/* Image picker section */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 col-span-full">
                <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500">{t.configImage}</div>
                <div className="flex gap-4 items-start flex-wrap">
                  <div className="w-24 h-24 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {configDraftSprite
                      ? <img src={configDraftSprite} alt="sprite" className="w-20 h-20 object-contain" style={buildSpriteStyle(configDraftTransform)} />
                      : <span className="text-slate-500 text-xs text-center">{t.noSprite}</span>
                    }
                  </div>
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <div className="text-[14px] text-slate-400 uppercase tracking-widest">{t.configSearchSprite}</div>
                    <div className="relative flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder={t.configSearchPlaceholder}
                          value={fakeSpriteSearch}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFakeSpriteSearch(v);
                            setFakeSpriteSelectedIdx(-1);
                            if (v.trim().length >= 2) {
                              const filtered = pokemonList.filter((n) => n.toLowerCase().includes(v.toLowerCase())).slice(0, 8);
                              setFakeSpriteResults(filtered);
                              setFakeSpriteOpen(filtered.length > 0);
                            } else {
                              setFakeSpriteResults([]);
                              setFakeSpriteOpen(false);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (fakeSpriteOpen && fakeSpriteResults.length > 0) {
                              if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setFakeSpriteSelectedIdx((prev) => Math.min(prev + 1, fakeSpriteResults.length - 1));
                                return;
                              }
                              if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setFakeSpriteSelectedIdx((prev) => Math.max(prev - 1, -1));
                                return;
                              }
                              if (e.key === "Enter" && fakeSpriteSelectedIdx >= 0) {
                                e.preventDefault();
                                const name = fakeSpriteResults[fakeSpriteSelectedIdx];
                                setFakeSpriteSearch(formatForDisplay(name));
                                setFakeSpriteOpen(false);
                                setFakeSpriteSelectedIdx(-1);
                                setFakeSpriteLoading(true);
                                fetch(`https://pokeapi.co/api/v2/pokemon/${name}`)
                                  .then((r) => r.json())
                                  .then((d) => { const sp = d.sprites.front_default || d.sprites.other?.["official-artwork"]?.front_default || null; setConfigDraftSprite(sp); setConfigDraftTransform(DEFAULT_TRANSFORM); })
                                  .catch(() => alert("Pokémon no encontrado"))
                                  .finally(() => setFakeSpriteLoading(false));
                                return;
                              }
                            }
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setFakeSpriteOpen(false);
                              const name = formatForAPI(fakeSpriteSearch);
                              setFakeSpriteLoading(true);
                              fetch(`https://pokeapi.co/api/v2/pokemon/${name}`)
                                .then((r) => r.json())
                                .then((d) => { const sp = d.sprites.front_default || d.sprites.other?.["official-artwork"]?.front_default || null; setConfigDraftSprite(sp); setConfigDraftTransform(DEFAULT_TRANSFORM); })
                                .catch(() => alert("Pokémon no encontrado"))
                                .finally(() => setFakeSpriteLoading(false));
                            } else if (e.key === "Escape") {
                              setFakeSpriteOpen(false);
                              setFakeSpriteSelectedIdx(-1);
                            }
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                        />
                        {fakeSpriteOpen && fakeSpriteResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/98 shadow-lg text-sm">
                            {fakeSpriteResults.map((name, resultIdx) => (
                              <button
                                key={name}
                                type="button"
                                onMouseEnter={() => setFakeSpriteSelectedIdx(resultIdx)}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setFakeSpriteSearch(formatForDisplay(name));
                                  setFakeSpriteOpen(false);
                                  setFakeSpriteSelectedIdx(-1);
                                  setFakeSpriteLoading(true);
                                  fetch(`https://pokeapi.co/api/v2/pokemon/${name}`)
                                    .then((r) => r.json())
                                    .then((d) => { const sp = d.sprites.front_default || d.sprites.other?.["official-artwork"]?.front_default || null; setConfigDraftSprite(sp); setConfigDraftTransform(DEFAULT_TRANSFORM); })
                                    .catch(() => {})
                                    .finally(() => setFakeSpriteLoading(false));
                                }}
                                className={`w-full text-left px-3 py-2 ${fakeSpriteSelectedIdx === resultIdx ? "bg-blue-700/60" : "hover:bg-slate-700/80"} text-slate-200`}
                              >
                                {formatForDisplay(name)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFakeSpriteOpen(false);
                          const name = formatForAPI(fakeSpriteSearch);
                          setFakeSpriteLoading(true);
                          fetch(`https://pokeapi.co/api/v2/pokemon/${name}`)
                            .then((r) => r.json())
                            .then((d) => { const sp = d.sprites.front_default || d.sprites.other?.["official-artwork"]?.front_default || null; setConfigDraftSprite(sp); setConfigDraftTransform(DEFAULT_TRANSFORM); })
                            .catch(() => alert("Pokémon no encontrado"))
                            .finally(() => setFakeSpriteLoading(false));
                        }}
                        className="rounded-full bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 shrink-0"
                        disabled={fakeSpriteLoading}
                      >
                        {fakeSpriteLoading ? "..." : t.btnSearch}
                      </button>
                    </div>
                    <div className="text-[14px] text-slate-400 uppercase tracking-widest mt-1">{t.configOrUpload}</div>
                    <label className="flex items-center gap-2 rounded-full border border-dashed border-slate-600 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 cursor-pointer hover:border-blue-500 transition w-fit">
                      <span>📁</span> {t.configChooseFile}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const dataUrl = ev.target?.result as string;
                            setConfigDraftSprite(dataUrl);
                            // Reset transform and open editor for custom uploads
                            setEditorTransform(DEFAULT_TRANSFORM);
                            setSpriteEditorSrc(dataUrl);
                            setSpriteEditorOpen(true);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {configDraftSprite && (
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setEditorTransform(configDraftTransform);
                            setSpriteEditorSrc(configDraftSprite);
                            setSpriteEditorOpen(true);
                          }}
                          className="text-[14px] text-sky-400 hover:text-sky-300 text-left"
                        >
                          {t.editorEditFrame}
                        </button>
                        <button type="button" onClick={() => { setConfigDraftSprite(null); setConfigDraftTransform(DEFAULT_TRANSFORM); }} className="text-[14px] text-red-400 hover:text-red-300 text-left">
                          {t.configRemoveImg}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500">{t.configTypes}</div>
                <div className="grid grid-cols-3 gap-2">
                  {allTypes.map((type) => {
                    const selected = configDraftTypes.includes(type);
                    return (
                      <button key={type} type="button" onClick={() => toggleConfigType(type)}
                        className={`inline-flex items-center justify-center rounded-full px-2 py-2 text-[14px] font-semibold transition ${badgeClass(type)} ${selected ? "ring-2 ring-slate-200/40 scale-105" : "opacity-80 hover:opacity-100"}`}>
                        {tn(type)}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 text-sm text-slate-400">{t.configTypesNote}</div>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.3em] text-slate-500">{t.configStats}</div>
                    <p className="text-sm text-slate-400">{t.configStatsNote}</p>
                  </div>
                  <button type="button" onClick={() => setConfigStatsVisible((prev) => !prev)}
                    className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200 transition hover:border-slate-500">
                    {configStatsVisible ? t.configHide : t.configShow}
                  </button>
                </div>
                {configStatsVisible ? (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {statLabels.map(([key, label]) => (
                      <label key={key} className="space-y-1 text-sm">
                        <span className="text-slate-300">{label}</span>
                        <input
                          type="number"
                          min={1}
                          max={255}
                          value={configDraftStats[key]}
                          onChange={(e) => updateDraftStat(key, e.target.value)}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-500"
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-4 sm:mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeFakemonConfig}
                className="w-full sm:w-auto rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2.5 sm:py-2 text-sm text-slate-200 transition hover:bg-slate-800">
                {t.configCancel}
              </button>
              <button type="button" onClick={saveFakemonConfig}
                className="w-full sm:w-auto rounded-full bg-sky-600 px-4 py-2.5 sm:py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                {t.configSave}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* ── Sprite Editor Modal ── */}
      {spriteEditorOpen && spriteEditorSrc && (
        <SpriteEditorModal
          src={spriteEditorSrc}
          initialTransform={editorTransform}
          lang={lang}
          onSave={(saved) => {
            setConfigDraftTransform(saved);
            setSpriteEditorOpen(false);
            setSpriteEditorSrc(null);
          }}
          onCancel={() => {
            setSpriteEditorOpen(false);
            setSpriteEditorSrc(null);
          }}
        />
      )}
    </div>
  );
}