"use client";

// Vista del mapa con los marcadores publicados en mapa.json, de solo lectura.
// Al seleccionar un marcador se navega a su zona.
//
// La tarjeta que aparece al pasar el mouse por un marcador es UNA
// SOLA instancia global (no una por marcador) que sigue al cursor con
// física de resorte (Motion / useSpring), con una entrada tipo "pop"
// con rebote suave, un flote idle casi imperceptible mientras está
// visible, y una salida rápida y prolija. Requiere el paquete `motion`
// (`npm install motion`).
//
// Tooltip que no se corta con el borde: el panel usa overflow-hidden
// (necesario para las esquinas redondeadas del mapa), así que la
// tarjeta —que por defecto aparece a la derecha del cursor— se sale
// del contenedor y queda tapada cuando el marcador está cerca del
// borde derecho. En vez de tocar el overflow, se decide el LADO de la
// tarjeta dinámicamente: si el cursor está en el ~30% derecho del
// mapa, la tarjeta aparece a la IZQUIERDA del cursor en vez de a la
// derecha (mismo criterio de "clamp" que ZoneMapView.tsx con sus
// labels SVG).

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useMotionValue, useSpring } from "motion/react";
import { MapPin, Building2, Route, Leaf } from "lucide-react";
import type { Zone } from "./types";
import { useMapMarkers, type MapMarker, type MarkerKind } from "./useMapMarkers";
import { nombreZona } from "./formato";

// Config visual por tipo de marcador: ícono + color, usados tanto en
// el pin del mapa como en la leyenda.
const MARKER_KIND_CONFIG: Record<
  MarkerKind,
  {
    label: string;
    Icon: typeof MapPin;
    colorClass: string;
    glow: string;
    mutedBg: string;
    vividBg: string;
    mutedBorder: string;
    vividBorder: string;
    glowMuted: string;
    glowVivid: string;
  }
> = {
  ciudad: {
    label: "Ciudad / Pueblo",
    Icon: Building2,
    colorClass: "text-sky-300",
    glow: "#38bdf8",
    mutedBg: "rgba(3,105,161,0.45)",
    vividBg: "#38bdf8",
    mutedBorder: "rgba(2,132,199,0.6)",
    vividBorder: "#e0f2fe",
    glowMuted: "rgba(3,105,161,0.35)",
    glowVivid: "rgba(56,189,248,0.9)",
  },
  ruta: {
    label: "Ruta",
    Icon: Route,
    colorClass: "text-amber-300",
    glow: "#fb923c",
    mutedBg: "rgba(194,65,12,0.45)",
    vividBg: "#fb923c",
    mutedBorder: "rgba(234,88,12,0.6)",
    vividBorder: "#ffedd5",
    glowMuted: "rgba(194,65,12,0.35)",
    glowVivid: "rgba(251,146,60,0.9)",
  },
  secundaria: {
    label: "Zona secundaria",
    Icon: Leaf,
    colorClass: "text-emerald-400",
    glow: "#10b981",
    mutedBg: "rgba(6,78,59,0.55)",
    vividBg: "#10b981",
    mutedBorder: "rgba(4,120,87,0.6)",
    vividBorder: "#a7f3d0",
    glowMuted: "rgba(6,78,59,0.4)",
    glowVivid: "rgba(16,185,129,0.9)",
  },
};

// Ancho estimado (px) de la tarjeta en su caso más largo (nombres de
// zona largos tipo "Catacumbas Meridionales (Opcional)" en negrita
// 16px). Sobreestimado a propósito: mejor flippear un poco antes de
// lo estrictamente necesario que dejar la tarjeta cortada.
const CARD_ESTIMATED_WIDTH = 340;
const CARD_GAP = 24; // separación entre el cursor y la tarjeta (translate-x-6 = 24px)
// Ídem alto estimado, para el clamp vertical.
const CARD_ESTIMATED_HEIGHT = 46;

export function ZoneMapImageView({
  zones,
  activeZoneIndex,
  isVisited,
  onSelect,
}: {
  zones: Zone[];
  activeZoneIndex: number;
  isVisited: (zoneId: string) => boolean;
  onSelect: (zoneIndex: number) => void;
}) {
  const markers = useMapMarkers(zones);
  const containerRef = useRef<HTMLDivElement>(null);

  // Marcador bajo el cursor — maneja la tarjeta flotante premium.
  const [hoveredMarker, setHoveredMarker] = useState<MapMarker | null>(null);
  // Lado/anclaje de la tarjeta según qué tan cerca del borde está el
  // cursor — se recalcula en cada mousemove, no depende de Motion
  // porque necesitamos ramificar clases/transform, no solo interpolar.
  const [cardSide, setCardSide] = useState<"right" | "left">("right");
  const [cardAnchor, setCardAnchor] = useState<"center" | "top">("center");

  // Posición cruda del cursor relativa al contenedor del mapa (px).
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  // La tarjeta no se pega al cursor: lo "persigue" con un resorte
  // suave, dando sensación de peso/fluidez en vez de un seguimiento
  // mecánico 1:1.
  const springX = useSpring(mouseX, { stiffness: 150, damping: 18, mass: 0.6 });
  const springY = useSpring(mouseY, { stiffness: 150, damping: 18, mass: 0.6 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseX.set(x);
    mouseY.set(y);

    const spaceRight = rect.width - x;
    const spaceTop = y;
    setCardSide(spaceRight < CARD_ESTIMATED_WIDTH + CARD_GAP ? "left" : "right");
    setCardAnchor(spaceTop < CARD_ESTIMATED_HEIGHT / 2 ? "top" : "center");
  }

  const hoveredZone = hoveredMarker ? zones[hoveredMarker.zoneIndex] : null;
  const hoveredIsActive = hoveredMarker ? hoveredMarker.zoneIndex === activeZoneIndex : false;
  const hoveredIsVisited = hoveredZone ? isVisited(hoveredZone.id) : false;

  // Clases de posicionamiento de la tarjeta según lado/anclaje
  // calculados en handleMouseMove. Con `left`/`right` fijamos el lado
  // horizontal (además de invertir translate-x); con `top` bajamos el
  // anclaje vertical en vez de centrarlo, para que no se corte arriba.
  const cardPositionClass =
    cardSide === "left"
      ? cardAnchor === "top"
        ? "-translate-x-[calc(100%+24px)] translate-y-0"
        : "-translate-x-[calc(100%+24px)] -translate-y-1/2"
      : cardAnchor === "top"
        ? "translate-x-6 translate-y-0"
        : "translate-x-6 -translate-y-1/2";

  return (
    <div role="region" aria-label="Mapa de zonas" className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-900/70 to-slate-950/70 p-3 shadow-lg shadow-black/30">
      {/* Marcas de esquina */}
      <span className="pointer-events-none absolute left-2.5 top-2.5 h-2.5 w-2.5 border-l border-t border-sky-500/40 z-10" />
      <span className="pointer-events-none absolute right-2.5 top-2.5 h-2.5 w-2.5 border-r border-t border-sky-500/40 z-10" />

      <p className="relative mb-2 text-sm text-slate-500">
        {markers.length} zonas ubicadas en el mapa. Selecciona un punto para ver su zona.
      </p>

      {/* Mapa */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredMarker(null)}
        className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-slate-700/50"
      >
        <Image
          src="/mapa.png"
          alt="Mapa de Pokémon Z"
          width={480}
          height={320}
          className="block w-full h-auto select-none"
          draggable={false}
          priority
        />

        {markers.map((m) => {
          const zone = zones[m.zoneIndex];
          if (!zone) return null;
          const active = m.zoneIndex === activeZoneIndex;
          const visited = isVisited(zone.id);
          const kindConfig = MARKER_KIND_CONFIG[m.kind] ?? MARKER_KIND_CONFIG.secundaria;
          const { Icon, mutedBg, vividBg, mutedBorder, vividBorder, glowMuted, glowVivid } = kindConfig;
          const isHovered = hoveredMarker?.id === m.id;
          // Vivo si está en hover o si es la zona en la que el jugador
          // está parado ahora mismo; apagado en cualquier otro caso.
          const isVivid = isHovered || active;
          return (
            <button
              key={m.id}
              type="button"
              style={{ left: `${m.xPct}%`, top: `${m.yPct}%` }}
              // El marcador es solo un icono sobre el mapa: sin nombre, un
              // lector de pantalla anuncia doscientos "botón" seguidos. El
              // nombre de la zona solo aparecía en el tooltip de hover, que con
              // teclado o lector no existe.
              aria-label={nombreZona(zone.zona)}
              // outline-none dejaba el marcador sin ninguna marca de foco: con
              // el tabulador no se veía dónde estabas.
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              onMouseEnter={() => setHoveredMarker(m)}
              onMouseLeave={() => setHoveredMarker((h) => (h?.id === m.id ? null : h))}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(m.zoneIndex);
              }}
            >
              {/* Capa exterior: la que "levanta" el marcador del mapa
                  (lift + scale + glow) — es la que dispara, en
                  simultáneo, la aparición de la tarjeta flotante. */}
              <motion.span
                style={{ position: "relative", zIndex: isHovered ? 20 : 1 }}
                animate={{
                  scale: isHovered ? 1.22 : 1,
                  y: isHovered ? -9 : 0,
                }}
                transition={{ type: "spring", stiffness: 380, damping: 12, mass: 0.5 }}
                className="block"
              >
                {/* Capa interior: sutil flote idle una vez que el
                    marcador ya está "arriba" y la tarjeta visible —
                    empieza recién tras el asentamiento del spring. */}
                <motion.span
                  animate={isHovered ? { y: [0, -2, 0] } : { y: 0 }}
                  transition={
                    isHovered
                      ? { duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: 0.28 }
                      : { duration: 0.2 }
                  }
                  style={{
                          backgroundColor: isVivid ? vividBg : mutedBg,
                          borderColor: isVivid ? vividBorder : mutedBorder,
                          boxShadow: `0 0 ${isVivid ? 14 : 5}px ${isVivid ? glowVivid : glowMuted}${
                            visited ? ", 0 0 0 2px rgba(255,255,255,0.4)" : ""
                          }`,
                  }}
                  className={`flex items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                    active ? "h-6 w-6" : "h-5 w-5"
                  }`}
                >
                  <Icon className={`${active ? "h-3.5 w-3.5" : "h-3 w-3"} text-slate-950`} strokeWidth={2.5} />
                </motion.span>
              </motion.span>
            </button>
          );
        })}

        {/* Tarjeta flotante premium: una sola instancia global que
            sigue al cursor con resorte, en vez de un tooltip fijo por
            marcador. El lado (translate-x-6 a la derecha vs a la
            izquierda) y el anclaje vertical se deciden en
            cardPositionClass según la cercanía del cursor a los bordes
            del mapa, para que nunca quede cortada por el
            overflow-hidden del panel. */}
        <AnimatePresence mode="wait">
          {hoveredZone && (
            <motion.div
              key={hoveredMarker?.id}
              className={`pointer-events-none absolute z-20 ${cardPositionClass}`}
              style={{ left: springX, top: springY }}
              initial={{ scale: 0.75, y: 6 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 6, transition: { duration: 0.15, ease: "easeIn" } }}
              transition={{ type: "spring", stiffness: 480, damping: 15, mass: 0.5, delay: 0.09 }}
            >
              {/* Flote idle, muy sutil, independiente de la entrada/salida */}
              <motion.div
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-2.5 shadow-xl shadow-black/50 backdrop-blur-sm"
              >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      hoveredIsActive ? "bg-sky-400 shadow-[0_0_6px_#38bdf8]" : hoveredIsVisited ? "bg-emerald-400" : "bg-slate-400"
                    }`}
                  />
                <span className="whitespace-nowrap text-base font-semibold text-slate-100">{nombreZona(hoveredZone.zona)}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative mt-2 flex flex-wrap items-center gap-4 px-1 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-white/40 bg-slate-600" /> Apagado = sin hover
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" /> Vivo = hover / zona activa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600 shadow-[0_0_0_2px_rgba(255,255,255,0.4)]" /> Visitada
        </span>
        <span className="mx-1 h-3 w-px bg-slate-700" />
        {(Object.keys(MARKER_KIND_CONFIG) as MarkerKind[]).map((kind) => {
          const { label, Icon, colorClass } = MARKER_KIND_CONFIG[kind];
          return (
            <span key={kind} className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${colorClass}`} /> {label}
            </span>
          );
        })}

      </div>
    </div>
  );
}
