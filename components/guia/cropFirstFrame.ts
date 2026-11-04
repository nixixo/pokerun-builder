// components/guia/cropFirstFrame.ts
//
// La implementación vive en @/components/shared/cropFirstFrame, compartida con
// el Builder. Aquí solo queda fijada la variante que quiere la Guía: recorte al
// contenido, para que un Solosis (que ocupa un tercio de su frame) y un Murkrow
// (que lo llena) se vean del mismo tamaño en la lista.

import { cropFirstFrame as recortar } from "@/components/shared/cropFirstFrame";

export function cropFirstFrame(url: string, escala: number = 1): Promise<string> {
  return recortar(url, { escala, alContenido: true });
}
