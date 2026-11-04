// components/guia/HoverDescription.tsx
//
// Tooltip simple con CSS puro (sin librerías): envuelve cualquier
// elemento y, al hacer hover, muestra una descripción flotando arriba
// del contenido, centrada y con ancho acotado — pensado para filas
// angostas dentro de columnas de grid (habilidad/objeto en las
// tarjetas de equipo), donde un tooltip a los costados se cortaría
// contra la columna vecina.
//
// El affordance de "esto es hoveable" es un ícono de información
// chico al lado del contenido (en vez de un subrayado punteado sobre
// el texto), para no interferir visualmente con nombres de habilidad/
// objeto que ya llevan su propio ícono adelante.
//
// Si no hay descripción (undefined/null), no envuelve nada extra ni
// agrega el ícono: devuelve los children tal cual.

import { Info } from "lucide-react";

export function HoverDescription({
  description,
  children,
}: {
  description: string | null;
  children: React.ReactNode;
}) {
  if (!description) {
    return <span className="contents">{children}</span>;
  }
  return (
    <div className="group/tip relative flex cursor-help items-start gap-1">
      {children}
      <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
      {/* En la escala con nombre (text-xs = 14px, ver @theme en globals.css) y
          no en píxeles sueltos: aquí dentro va una frase entera — la
          descripción de una habilidad o de un objeto —, no una etiqueta. El
          ancho sube con la letra, que si no la caja se vuelve una columna
          altísima de tres palabras por línea. */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-slate-700/70 bg-slate-950/95 px-2.5 py-2 text-xs font-normal leading-snug text-slate-300 opacity-0 shadow-xl shadow-black/50 transition-opacity duration-150 group-hover/tip:opacity-100">
        {description}
      </div>
    </div>
  );
}