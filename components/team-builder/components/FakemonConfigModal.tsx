"use client";

// components/team-builder/components/FakemonConfigModal.tsx
//
// El modal de "Configurar Fakemon": tipos, stats, sprite y encuadre.
//
// Estaba escrito a mano dentro del return de TeamBuilder.tsx, unas 150 líneas
// de JSX que solo se ven cuando el usuario abre el modal — mientras los otros
// tres modales ya vivían en su archivo y se cargaban con dynamic(). Ahora es
// uno más, y su código no viaja en el bundle inicial.

import { Modal } from "@/components/shared/Modal";
import React from "react";
import type { Lang } from "../types";
import type { useSpriteEditor } from "../hooks/useSpriteEditor";
import { UI } from "../utils/i18n";
import { STAT_LABELS } from "../utils/stats";
import { buildSpriteStyle } from "../utils/spriteHelpers";
import { formatForDisplay } from "../utils/typeHelpers";

export type FakemonConfigModalProps = {
  /**
   * El retorno entero de useSpriteEditor. Se pasa de una pieza y no campo a
   * campo porque son 26 valores que salen todos de ahí: enumerarlos como props
   * sueltas no aporta nada y convierte cualquier cambio del hook en un cambio
   * en tres sitios.
   */
  editor: ReturnType<typeof useSpriteEditor>;
  t: (typeof UI)[Lang];
  tn: (apiKey: string) => string;
  badgeClass: (type: string) => string;
  allTypes: string[];
};

export function FakemonConfigModal({ editor, t, tn, badgeClass, allTypes }: FakemonConfigModalProps) {
  const {
    configDraftTypes,
    configDraftStats,
    configStatsVisible,
    setConfigStatsVisible,
    configDraftSprite,
    configDraftTransform,
    closeFakemonConfig,
    toggleConfigType,
    updateDraftStat,
    saveFakemonConfig,
    fakeSpriteSearch,
    fakeSpriteLoading,
    fakeSpriteResults,
    fakeSpriteOpen,
    fakeSpriteSelectedIdx,
    setFakeSpriteSelectedIdx,
    handleSpriteSearchChange,
    handleSpriteSearchKeyDown,
    selectSpriteSuggestion,
    searchSpriteFromInput,
    handleSpriteFileUpload,
    removeConfigDraftSprite,
    openSpriteFrameEditor,
  } = editor;

  return (

        <Modal label={t.configTitle} onClose={closeFakemonConfig} className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-3 sm:p-4">
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
                          onChange={(e) => handleSpriteSearchChange(e.target.value)}
                          onKeyDown={(e) => handleSpriteSearchKeyDown(e.key, () => e.preventDefault())}
                          className="w-full bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                        />
                        {fakeSpriteOpen && fakeSpriteResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/98 shadow-lg text-sm">
                            {fakeSpriteResults.map((name, resultIdx) => (
                              <button
                                key={name}
                                type="button"
                                ref={(el) => {
                                  if (el && fakeSpriteSelectedIdx === resultIdx) {
                                    el.scrollIntoView({ block: "nearest" });
                                  }
                                }}
                                onMouseEnter={() => setFakeSpriteSelectedIdx(resultIdx)}
                                onMouseDown={(e) => { e.preventDefault(); selectSpriteSuggestion(name); }}
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
                        onClick={searchSpriteFromInput}
                        className="rounded-full bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 shrink-0"
                        disabled={fakeSpriteLoading}
                      >
                        {fakeSpriteLoading ? "…" : t.btnSearch}
                      </button>
                    </div>
                    <div className="text-[14px] text-slate-400 uppercase tracking-widest mt-1">{t.configOrUpload}</div>
                    <label className="flex items-center gap-2 rounded-full border border-dashed border-slate-600 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 cursor-pointer hover:border-blue-500 transition w-fit">
                      <span>📁</span> {t.configChooseFile}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSpriteFileUpload(file);
                        }}
                      />
                    </label>
                    {configDraftSprite && (
                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          type="button"
                          onClick={openSpriteFrameEditor}
                          className="text-[14px] text-sky-400 hover:text-sky-300 text-left"
                        >
                          {t.editorEditFrame}
                        </button>
                        <button type="button" onClick={removeConfigDraftSprite} className="text-[14px] text-red-400 hover:text-red-300 text-left">
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
                    {STAT_LABELS.map(([key, label]) => (
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
        </Modal>
  );
}
