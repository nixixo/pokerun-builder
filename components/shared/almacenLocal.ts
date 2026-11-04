type StorageAccess = Pick<Storage, "getItem" | "setItem">;

/** Los cambios sin persistir sobreviven a un fallo de cuota durante esta sesión. */
export function crearAlmacenLocal(acceder: () => StorageAccess) {
  const pendientes = new Map<string, string>();
  const leidos = new Map<string, string | null>();
  const oyentes = new Set<() => void>();
  const avisar = () => oyentes.forEach((f) => f());
  return {
    leer(clave: string, anterior?: string): string | null {
      if (pendientes.has(clave)) return pendientes.get(clave)!;
      try {
        const storage = acceder();
        const valor = storage.getItem(clave) ?? (anterior ? storage.getItem(anterior) : null);
        leidos.set(clave, valor);
        return valor;
      } catch {
        return leidos.get(clave) ?? null;
      }
    },
    escribir(clave: string, valor: string) {
      pendientes.set(clave, valor);
      try {
        acceder().setItem(clave, valor);
        pendientes.delete(clave);
        leidos.set(clave, valor);
      } catch {
        // El valor permanece disponible en memoria hasta reintentar.
      }
      avisar();
    },
    reintentar() {
      for (const [clave, valor] of pendientes) {
        try {
          acceder().setItem(clave, valor);
          pendientes.delete(clave);
          leidos.set(clave, valor);
        } catch { break; }
      }
      avisar();
    },
    hayPendientes: () => pendientes.size > 0,
    suscribir(f: () => void) {
      oyentes.add(f);
      return () => { oyentes.delete(f); };
    },
    avisar,
  };
}

export const almacenLocal = crearAlmacenLocal(() => window.localStorage);
if (typeof window !== "undefined") {
  window.addEventListener("storage", () => almacenLocal.avisar());
}
