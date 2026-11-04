import type { Zone } from "./types";
import { useCollectibleProgress } from "./useCollectibleProgress";
import { collectionId } from "./progressIdentity";

export function countCheckedInhabitants(zones: Zone[], checked: Set<string>): number {
  return zones.reduce((count, zone) => {
    const habitante = zone.habitante_acrilico;
    return habitante && checked.has(habitante.id) ? count + (habitante.cantidad ?? 1) : count;
  }, 0);
}

export function countCheckedMachines(zones: Zone[], checked: Set<string>): number {
  const byNumber = new Map<string, Set<string>>();
  for (const zone of zones) for (const mt of zone.mts) {
    const ids = byNumber.get(mt.numero) ?? new Set<string>();
    ids.add(mt.id);
    byNumber.set(mt.numero, ids);
  }
  let count = 0;
  for (const ids of byNumber.values()) if ([...ids].some((id) => checked.has(id))) count += 1;
  return count;
}

export function getMachineIdsForNumber(zones: Zone[], number: string): string[] {
  return zones.flatMap((zone) => zone.mts.filter((mt) => mt.numero === number).map((mt) => mt.id));
}

export function isMachineNumberChecked(zones: Zone[], number: string, checked: Set<string>): boolean {
  return getMachineIdsForNumber(zones, number).some((id) => checked.has(id));
}

export function useGuideCollections(zones: Zone[]) {
  const paginasProgress = useCollectibleProgress("paginas-alquimia");
  const mtsProgress = useCollectibleProgress("mts");
  const nidosProgress = useCollectibleProgress("nidos-alfa");
  const habitantesProgress = useCollectibleProgress("habitantes-acrilico");
  const mtsCheckedCount = countCheckedMachines(zones, mtsProgress.checked);
  const habitantesCheckedCount = countCheckedInhabitants(zones, habitantesProgress.checked);

  const collection = {
    isPaginaChecked: (zoneIndex: number, pageIndex?: number) =>
      paginasProgress.isChecked(collectionId(zones[zoneIndex], "paginas-alquimia", pageIndex)),
    togglePagina: (zoneIndex: number, pageIndex?: number) =>
      paginasProgress.toggle(collectionId(zones[zoneIndex], "paginas-alquimia", pageIndex)),
    isMtChecked: (zoneIndex: number, mtIndex: number) => {
      const mtNumber = zones[zoneIndex]?.mts[mtIndex]?.numero;
      return mtNumber ? isMachineNumberChecked(zones, mtNumber, mtsProgress.checked) : false;
    },
    toggleMt: (zoneIndex: number, mtIndex: number) => {
      const mtNumber = zones[zoneIndex]?.mts[mtIndex]?.numero;
      if (!mtNumber) return;
      const ids = getMachineIdsForNumber(zones, mtNumber);
      mtsProgress.toggleMany(ids);
    },
    isNidoChecked: (zoneIndex: number) => nidosProgress.isChecked(collectionId(zones[zoneIndex], "nidos-alfa")),
    toggleNido: (zoneIndex: number) => nidosProgress.toggle(collectionId(zones[zoneIndex], "nidos-alfa")),
    isHabitanteChecked: (zoneIndex: number) => habitantesProgress.isChecked(collectionId(zones[zoneIndex], "habitantes-acrilico")),
    toggleHabitante: (zoneIndex: number) => habitantesProgress.toggle(collectionId(zones[zoneIndex], "habitantes-acrilico")),
  };

  return {
    collection,
    paginasProgress,
    mtsProgress: { ...mtsProgress, checkedCount: mtsCheckedCount },
    nidosProgress,
    habitantesProgress: { ...habitantesProgress, checkedCount: habitantesCheckedCount },
  };
}
