/** Un token solo puede aplicar su respuesta mientras siga siendo el más reciente. */
export function createRequestTracker(scope: string) {
  let epoch = 0;
  const versions = new Map<string, number>();
  const invalidate = (key: string) => {
    const version = (versions.get(key) ?? 0) + 1;
    versions.set(key, version);
    return version;
  };
  return {
    scope,
    begin(key: string) {
      const version = invalidate(key);
      const started = epoch;
      return () => started === epoch && versions.get(key) === version;
    },
    invalidate,
    invalidateSlot(slot: number) {
      invalidate(`pokemon:${slot}`);
      for (let move = 0; move < 4; move++) invalidate(`move:${slot}:${move}`);
    },
    invalidateAll() { epoch++; versions.clear(); },
  };
}
