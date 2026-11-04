"use client";

// components/guia/monCard.tsx
//
// La tarjeta de un Pokémon del equipo de un entrenador: sprite, nivel, tipos,
// habilidad, objeto, naturaleza, movimientos y el consejo de la guía.
//
// Estaba escrita DOS VECES, casi igual, en zoneDetail.tsx y en
// nextImportantBattle.tsx — unas 120 líneas cada una. Y ya habían divergido:
// la del detalle de zona pinta `nota` y pone el consejo antes de los
// movimientos; la del banner no pinta `nota` y lo pone después, con un cuerpo
// de letra más chico.
//
// Esas diferencias se conservan como `variante` en vez de unificarlas por la
// cara: dejar de duplicar es un arreglo, cambiar cómo se ve una de las dos
// pantallas es otra decisión distinta y no toca tomarla aquí.
//
// Los getters NO se reciben por props (serían seis): se piden a sus hooks aquí
// dentro. Sale gratis porque todos van contra el registro de
// components/shared/recursoJson.ts, que cachea por ruta — el JSON ya está
// descargado y parseado por el componente de arriba.

import { Lightbulb, ShieldAlert, X as XIcon, Zap } from "lucide-react";
import type { TrainerMon } from "./types";
import { ZoneSpriteImg } from "./zoneSpriteImage";
import { CategoriaBadge, NaturalezaLine } from "./monBadges";
import { HoverDescription } from "./hoverDescription";
import { StatsHover } from "./statsHover";
import { moveTypeChipStyle, typeEsChipStyle } from "./typeColors";
import { useAbilityDescriptions } from "./useAbilityDescriptions";
import { useItemSprites } from "./useItemSprites";
import { useMoveTypes } from "./useMoveTypes";
import { useSpeciesData } from "./useSpeciesData";

/**
 * `zona`   — el detalle de zona: enseña `nota` y el consejo va antes de los
 *            movimientos.
 * `banner` — el panel de próxima batalla: sin `nota`, consejo al final y más
 *            chico, porque ahí la tarjeta compite con el resto del panel.
 */
export type VarianteMonCard = "zona" | "banner";

export function MonCard({
  mon,
  getSpriteUrl,
  variante,
}: {
  mon: TrainerMon;
  getSpriteUrl?: (speciesName: string, spriteBase?: string) => string | null;
  variante: VarianteMonCard;
}) {
  const { getMoveTypeApi, getAttackProfile } = useMoveTypes();
  const { getItemSpriteUrl, getItemDescription } = useItemSprites();
  const { getAbilityDescription } = useAbilityDescriptions();
  const { getSpeciesInfo } = useSpeciesData();

  const sprite = getSpriteUrl?.(mon.especie, mon.spriteBase) ?? null;

  // Manda lo que traiga el JSON de la guía (las variantes del romhack cambian
  // de tipo respecto de su especie base); si no, se toman de la Pokédex Z.
  const tipos = mon.tipos?.length
    ? mon.tipos
    : (getSpeciesInfo(mon.especie, { spriteBase: mon.spriteBase })?.typesEs ?? []);
  const perfil = getAttackProfile(mon.movimientos ?? []);

  const enZona = variante === "zona";

  const consejo = mon.consejo ? (
    <div
      className={`rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 leading-snug text-amber-200/80 ${
        enZona ? "mt-1 text-[13px]" : "mt-1.5 text-[12px]"
      }`}
    >
      <div className="flex gap-1.5">
        <Lightbulb className="mt-px h-3 w-3 shrink-0 text-amber-400/70" />
        <span>{mon.consejo}</span>
      </div>
      {mon.consejoAviso && (
        <div className="mt-1.5 flex gap-1.5 border-t border-amber-500/20 pt-1.5 text-rose-300/90">
          <ShieldAlert className="mt-px h-3 w-3 shrink-0" />
          <span>{mon.consejoAviso}</span>
        </div>
      )}
    </div>
  ) : null;

  const movimientos =
    mon.movimientos.length > 0 ? (
      <div className="mt-0.5 flex flex-wrap gap-1">
        {/* El índice hace falta en la key: el Ditto del Alto Mando Prímula
            lleva tres movimientos "-". */}
        {mon.movimientos.map((mv, k) => (
          <span
            key={`${mv}-${k}`}
            style={moveTypeChipStyle(getMoveTypeApi(mv))}
            className="rounded border border-slate-600/40 bg-slate-700/50 px-1.5 py-0.5 text-[12px] text-slate-300"
          >
            {mv}
          </span>
        ))}
      </div>
    ) : null;

  return (
    <div className="flex gap-3 rounded-lg border border-slate-700/50 bg-slate-900/70 p-2.5">
      {/* Panel del sprite: ocupa todo el alto de la tarjeta, centrado — el foco
          visual pasa a ser el Pokémon, no un ícono chico al lado del nombre. */}
      <div className="flex w-16 shrink-0 items-center justify-center self-stretch rounded-md bg-slate-950/60 ring-1 ring-slate-700/40">
        {sprite ? (
          <ZoneSpriteImg
            rawUrl={sprite}
            alt={mon.especie}
            className="h-14 w-14 object-contain [image-rendering:pixelated]"
            placeholderClassName="h-6 w-6 opacity-40 animate-pulse"
          />
        ) : (
          <span className="text-[11px] text-slate-600">?</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {mon.condicion && (
          <span className="w-fit rounded-full border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-sky-300">
            {mon.condicion}
          </span>
        )}
        <div className="flex items-baseline justify-between gap-2">
          {/* El hover de stats va en TODOS los entrenadores, no solo en los
              importantes: la tarjeta es la misma y el dato sirve igual contra
              un campesino con un Gogoat que contra un Regente. */}
          <StatsHover stats={getSpeciesInfo(mon.especie, { spriteBase: mon.spriteBase })?.stats ?? null}>
            <span className="truncate text-[13px] font-bold">{mon.especie}</span>
          </StatsHover>
          <span className="shrink-0 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[13px] font-extrabold tabular-nums text-violet-300 ring-1 ring-violet-500/30">
            Nv. {mon.nivel}
          </span>
        </div>

        {(tipos.length > 0 || perfil) && (
          <div className="flex flex-wrap items-center gap-1">
            {tipos.map((tipo) => (
              <span
                key={tipo}
                style={typeEsChipStyle(tipo)}
                className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide"
              >
                {tipo}
              </span>
            ))}
            <CategoriaBadge perfil={perfil} />
          </div>
        )}

        <HoverDescription description={getAbilityDescription(mon.habilidad)}>
          <div className="flex items-start gap-1.5 text-[13px] leading-snug text-slate-400">
            <Zap className="h-3 w-3 shrink-0 translate-y-[1.5px] text-amber-400" />
            <span>{mon.habilidad}</span>
          </div>
        </HoverDescription>

        <HoverDescription description={getItemDescription(mon.objeto)}>
          <div className="flex items-start gap-1.5 text-[13px] leading-snug text-slate-500">
            {getItemSpriteUrl(mon.objeto) ? (
              <img
                src={getItemSpriteUrl(mon.objeto)!}
                alt={mon.objeto}
                className="h-3.5 w-3.5 shrink-0 translate-y-[1px] object-contain [image-rendering:pixelated]"
              />
            ) : (
              <XIcon className="h-3 w-3 shrink-0 translate-y-[1.5px] text-slate-600" />
            )}
            <span>{mon.objeto}</span>
          </div>
        </HoverDescription>

        <NaturalezaLine naturaleza={mon.naturaleza} />

        {enZona && mon.nota && (
          <div className="text-[13px] leading-snug text-slate-500">{mon.nota}</div>
        )}

        {enZona ? (
          <>
            {consejo}
            {movimientos}
          </>
        ) : (
          <>
            {movimientos}
            {consejo}
          </>
        )}
      </div>
    </div>
  );
}
