// components/guia/useAbilityDescriptions.ts
//
// Descripciones de habilidades. A diferencia de useMoveTypes/useItemSprites,
// acá el archivo ya viene indexado por nombre en español (es un Record, no un
// array), así que no hace falta normalizar ni buscar — el nombre tal como
// aparece en el equipo del entrenador (m.habilidad) es directamente la clave.

import { recursoJson } from "@/components/shared/recursoJson";

type AbilityEntry = {
  description: string;
  descriptionEn?: string;
  nameEn?: string;
  customAbility?: boolean;
};

const Habilidades = recursoJson<Record<string, AbilityEntry>>(
  "/generated/abilities_descriptions.json",
  { etiqueta: "useAbilityDescriptions" }
);

export function useAbilityDescriptions() {
  const { datos } = Habilidades.useRecurso();

  function getAbilityDescription(abilityName: string): string | null {
    return datos?.[abilityName]?.description ?? null;
  }

  return { getAbilityDescription, loaded: datos !== null };
}
