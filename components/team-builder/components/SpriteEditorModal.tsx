"use client";

import { Modal } from "@/components/shared/Modal";
import React, { useState, useRef } from "react";
import { UI } from "../utils/i18n";
import type { Lang, SpriteTransform } from "../types";

const DEFAULT_TRANSFORM: SpriteTransform = { x: 0, y: 0, zoom: 0 };

type SpriteEditorProps = {
  src: string;
  initialTransform: SpriteTransform;
  lang: Lang;
  onSave: (t: SpriteTransform) => void;
  onCancel: () => void;
};

export function SpriteEditorModal({ src, initialTransform, lang, onSave, onCancel }: SpriteEditorProps) {
  const t = UI[lang];
  const FRAME = 160; // px – preview frame size
  const [transform, setTransform] = useState<SpriteTransform>(initialTransform);
  // Dos cosas distintas con el mismo nombre, a propósito:
  //
  //   - `dragging` (ref) es la guarda de onPointerMove. Tiene que ser un ref
  //     porque se lee de forma síncrona dentro del propio evento, antes de que
  //     React haya podido re-renderizar.
  //   - `arrastrando` (estado) es lo que se PINTA (el cursor y si hay
  //     transición). Antes esto también salía del ref, y no funcionaba: cambiar
  //     un ref no provoca render, así que el cursor solo pasaba a "grabbing"
  //     cuando algún otro cambio de estado forzaba un repintado — al soltar sin
  //     mover, el sprite se quedaba sin transición hasta el siguiente render.
  const dragging = useRef(false);
  const [arrastrando, setArrastrando] = useState(false);
  const lastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const getScale = (zoom: number) =>
    zoom >= 0 ? 1 + zoom / 100 : 1 + zoom / 200;

  const clamp = (tx: number, ty: number, zoom: number): { x: number; y: number } => {
    const scale = getScale(zoom);
    const extra = (FRAME * (scale - 1)) / 2;
    const maxPxX = Math.max(extra, 0);
    const maxPxY = Math.max(extra, 0);
    const pxX = (tx / 100) * FRAME;
    const pxY = (ty / 100) * FRAME;
    const clampedPxX = Math.min(maxPxX, Math.max(-maxPxX, pxX));
    const clampedPxY = Math.min(maxPxY, Math.max(-maxPxY, pxY));
    return { x: (clampedPxX / FRAME) * 100, y: (clampedPxY / FRAME) * 100 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    setArrastrando(true);
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

  const onPointerUp = () => {
    dragging.current = false;
    setArrastrando(false);
  };

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
    transition: arrastrando ? "none" : "transform 0.1s",
  };

  return (
    <Modal label={t.editorTitle} onClose={onCancel} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
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
            style={{ width: FRAME, height: FRAME, overflow: "hidden", borderRadius: 12, background: "#031421", cursor: arrastrando ? "grabbing" : "grab", border: "1px solid #1e3a5f", userSelect: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
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
          <div className="flex justify-between text-[12px] text-slate-600">
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
    </Modal>
  );
}
