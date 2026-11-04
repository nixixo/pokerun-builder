import { Modal } from "@/components/shared/Modal";
import { useState, useMemo, useEffect, useRef } from "react";
import type { Lang, SavedTeam, Slot } from "../../types";
import { normalizarEquipo } from "../../utils/validation";
import { FolderOpen, Download, Upload, Copy, Check, X } from "lucide-react";

type SavedTeamsModalProps = {
  show: boolean;
  onClose: () => void;
  lang: Lang;
  team: Slot[];
  onImportTeam: (team: Slot[]) => void;
  savedTeams: SavedTeam[];
  maxPlantillas: number;
  savingNew: boolean;
  onStartSavingNew: () => void;
  onCancelSavingNew: () => void;
  plantillaDraftName: string;
  onDraftNameChange: (name: string) => void;
  onSaveCurrentTeam: () => void;
  onLoadTeam: (saved: SavedTeam) => void;
  onOverwriteTeam: (id: number) => void;
  onDeleteTeam: (id: number) => void;
  t: Record<string, string>;
  tn: (apiKey: string) => string;
  badgeClass: (t: string) => string;
};

/**
 * Modal de "Equipos guardados" (plantillas): lista los equipos guardados por
 * el usuario para la pokédex activa, permite cargar/sobrescribir/eliminar, y
 * guardar el equipo actual como una plantilla nueva. Extraído tal cual del
 * render principal de TeamBuilder.tsx (Fase 6) — sin cambios de lógica.
 *
 * Nota: el bloque original de donde salió este componente también incluía,
 * justo a continuación, el modal "Configurar Fakemon" — son dos modales
 * independientes que compartían el mismo tramo de JSX; ese otro quedó
 * pendiente para una extracción separada (ej. FakemonConfigModal.tsx).
 */
export function SavedTeamsModal({
  show,
  onClose,
  lang,
  team,
  onImportTeam,
  savedTeams,
  maxPlantillas,
  savingNew,
  onStartSavingNew,
  onCancelSavingNew,
  plantillaDraftName,
  onDraftNameChange,
  onSaveCurrentTeam,
  onLoadTeam,
  onOverwriteTeam,
  onDeleteTeam,
  t,
  tn,
  badgeClass,
}: SavedTeamsModalProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const exportJson = useMemo(() => JSON.stringify(team, null, 2), [team]);

  /**
   * Foco automático en el nombre de la plantilla, PERO solo con ratón.
   *
   * Antes era un `autoFocus` a secas. En un teléfono eso levanta el teclado en
   * cuanto abres el modal: se come media pantalla justo cuando ibas a leer la
   * lista de plantillas guardadas, y el navegador desplaza la vista para
   * encajar el campo. Con teclado y ratón sí se agradece, así que se decide por
   * el tipo de puntero.
   *
   * Va en un efecto y no en el render porque `matchMedia` no existe en el
   * servidor.
   */
  const campoNombreRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!savingNew) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    campoNombreRef.current?.focus();
  }, [savingNew]);

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard bloqueado (permisos/HTTP no seguro): el textarea de abajo
      // ya deja el JSON seleccionado para copiar a mano.
    }
  };

  const handleImport = () => {
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError(lang === "es" ? "Eso no es un JSON válido." : "That's not valid JSON.");
      return;
    }
    const normalized = normalizarEquipo(parsed);
    if (!normalized) {
      setImportError(
        lang === "es"
          ? "El equipo debe contener 6 espacios válidos, cada uno con tipos y 4 movimientos."
          : "The team must contain 6 valid slots, each with types and 4 moves."
      );
      return;
    }
    onImportTeam(normalized);
    setImportText("");
    setImportOpen(false);
  };

  if (!show) return null;

  return (
    <Modal label={t.templateTitle} onClose={onClose} className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-3 sm:p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-950/97 p-5 sm:p-8 text-slate-100 shadow-2xl shadow-black/60 flex flex-col gap-5 my-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg sm:text-2xl font-semibold text-slate-100">{t.templateTitle}</h3>
            <p className="text-sm text-slate-400 mt-1">{t.templateSubtitle}</p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100">
            {t.templateClose}
          </button>
        </div>

        {/* Exportar/importar como JSON (copiar/pegar) — separado de las
            plantillas guardadas de arriba: esto es para respaldar o
            compartir el equipo actual como texto plano, sin depender del
            localStorage del navegador. */}
        <div className="flex gap-2 border-b border-slate-800 pb-4">
          <button
            type="button"
            onClick={() => { setExportOpen((v) => !v); setImportOpen(false); }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs sm:text-sm font-semibold transition ${
              exportOpen ? "bg-sky-800/60 text-sky-200 ring-1 ring-sky-600/50" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
            }`}
          >
            <Download className="h-4 w-4 shrink-0" />
            {lang === "es" ? "Exportar equipo actual" : "Export current team"}
          </button>
          <button
            type="button"
            onClick={() => { setImportOpen((v) => !v); setExportOpen(false); setImportError(null); }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs sm:text-sm font-semibold transition ${
              importOpen ? "bg-sky-800/60 text-sky-200 ring-1 ring-sky-600/50" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
            }`}
          >
            <Upload className="h-4 w-4 shrink-0" />
            {lang === "es" ? "Importar equipo" : "Import team"}
          </button>
        </div>

        {exportOpen && (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 -mt-2">
            <p className="text-xs text-slate-400 mb-2">
              {lang === "es"
                ? "Copia este texto para guardar o compartir tu equipo actual. Puedes pegarlo después con \"Importar equipo\"."
                : "Copy this text to save or share your current team. You can paste it back later with \"Import team\"."}
            </p>
            <textarea
              readOnly
              value={exportJson}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-40 rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-[13px] font-mono text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="button"
              onClick={handleCopyExport}
              className={`mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                copied ? "bg-emerald-700 text-white" : "bg-sky-700 text-white hover:bg-sky-600"
              }`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? (lang === "es" ? "Copiado" : "Copied") : (lang === "es" ? "Copiar al portapapeles" : "Copy to clipboard")}
            </button>
          </div>
        )}

        {importOpen && (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 -mt-2">
            <p className="text-xs text-slate-400 mb-2">
              {lang === "es"
                ? "Pega aquí el JSON de un equipo exportado. Esto reemplaza tu equipo actual."
                : "Paste an exported team's JSON here. This replaces your current team."}
            </p>
            <textarea
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setImportError(null); }}
              placeholder={lang === "es" ? "Pega el JSON aquí…" : "Paste the JSON here…"}
              className="w-full h-40 rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-[13px] font-mono text-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {importError && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                <X className="h-3.5 w-3.5 shrink-0" /> {importError}
              </p>
            )}
            <button
              type="button"
              onClick={handleImport}
              disabled={!importText.trim()}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-sky-700"
            >
              <Upload className="h-4 w-4" />
              {lang === "es" ? "Importar equipo" : "Import team"}
            </button>
          </div>
        )}
        <div className="space-y-3 max-h-[65vh] sm:max-h-[28rem] overflow-y-auto pr-1">
          {savedTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-sm gap-2">
              <FolderOpen className="h-8 w-8 text-slate-600" />
              <span>{t.templateEmpty}</span>
            </div>
          ) : (
            savedTeams.map((saved) => {
              const filledCount = saved.team.filter((s) => s.name).length;
              const types = saved.team.flatMap((s) => s.types.filter(Boolean)).slice(0, 6);
              return (
                <div key={saved.id} className="flex items-center gap-4 rounded-2xl border border-slate-700/50 bg-slate-900/60 px-4 sm:px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-100 text-base truncate">{saved.name}</div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {types.map((ty, i) => (
                        <span key={i} className={`${badgeClass(ty)} text-[13px] px-2 py-1`}>{tn(ty)}</span>
                      ))}
                      {filledCount === 0 && <span className="text-sm text-slate-500">{t.templateEmptyTeam}</span>}
                    </div>
                    <div className="text-sm text-slate-500 mt-1.5">{filledCount}/6 {t.templatePokemon} · {saved.savedAt}</div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button type="button" onClick={() => onLoadTeam(saved)}
                      className="rounded-full bg-blue-700/80 px-3 sm:px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-600">{t.templateLoad}</button>
                    <button type="button" onClick={() => onOverwriteTeam(saved.id)}
                      className="rounded-full bg-slate-700/80 px-3 sm:px-4 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-600">{t.templateOverwrite}</button>
                    <button type="button" onClick={() => onDeleteTeam(saved.id)}
                      className="rounded-full bg-red-900/60 px-3 sm:px-4 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-800/60">{t.templateDelete}</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {savedTeams.length < maxPlantillas ? (
          savingNew ? (
            <div className="flex gap-2 items-center border-t border-slate-800 pt-5">
              <input type="text" placeholder={`${t.templateNamePlaceholder} ${savedTeams.length + 1}`} value={plantillaDraftName}
                onChange={(e) => onDraftNameChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onSaveCurrentTeam(); if (e.key === "Escape") onCancelSavingNew(); }}
                ref={campoNombreRef}
                aria-label={t.templateNamePlaceholder}
                className="flex-1 rounded-full border border-blue-700/50 bg-slate-900/80 px-5 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
              />
              <button type="button" onClick={onSaveCurrentTeam} className="rounded-full bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600">{t.templateSave}</button>
              <button type="button" onClick={onCancelSavingNew} className="rounded-full border border-slate-700 px-4 py-3 text-sm text-slate-400 transition hover:text-slate-200">{t.templateCancel}</button>
            </div>
          ) : (
            <div className="border-t border-slate-800 pt-5">
              <button type="button" onClick={onStartSavingNew}
                className="w-full rounded-full border border-dashed border-blue-700/50 bg-blue-900/20 px-4 py-3 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/40 hover:border-blue-500">
                {t.templateSaveBtn}
              </button>
            </div>
          )
        ) : (
          <div className="border-t border-slate-800 pt-5 text-center text-sm text-slate-500">
            {t.templateMaxReached} {maxPlantillas} {t.templateMaxEnd}
          </div>
        )}
      </div>
    </Modal>
  );
}