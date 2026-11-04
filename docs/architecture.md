# Organización y mantenimiento

- `app/` compone rutas y metadatos. La interacción vive en cada funcionalidad.
- `components/team-builder/TeamBuilder.tsx` coordina el Builder. Los catálogos
  estándar y Z se cargan en hooks independientes; validación y control de
  solicitudes viven en `utils/`, sin depender de la interfaz.
- `components/guia/Guia.tsx` compone la Guía. `useGuideCollections` adapta sus
  posiciones de navegación a IDs persistentes. `progressIdentity` contiene la
  migración y resolución de identidad, separadas de los componentes.
- `components/shared/Modal.tsx` usa un diálogo nativo: el navegador confina el
  foco, hace inerte el fondo y maneja modales anidados. El componente añade
  nombre accesible, cierre y restauración del foco al desmontar.
- `almacenLocal` conserva cambios pendientes en memoria cuando falla el disco;
  `preferenciaLocal` lo integra con React; `StorageNotice` informa y reintenta.
- `data-src/` guarda las fuentes editables; `public/generated/` es derivado.
  `scripts/guia-identities.mjs` preserva IDs durante la regeneración y valida
  que no se publiquen identificadores ausentes o duplicados.

## Convenciones para cambios nuevos

Componentes nuevos en PascalCase, hooks con prefijo `use`, utilidades en
camelCase. Mantener el vocabulario del módulo: español para conceptos de la
Guía e inglés para el modelo del Builder. Usar `@/` entre funcionalidades e
imports relativos dentro de una funcionalidad. Los nombres históricos se
migran al trabajar sobre su responsabilidad, sin renombrados masivos.

Extraer por responsabilidad y comportamiento, no solo por cantidad de líneas.
Los paneles grandes aún pueden dividirse por secciones independientes cuando
se modifiquen; no duplicar datos de dominio ni crear estado para valores
que se pueden derivar. React Compiler está activo; evitar memoización manual
sin una dependencia estable o evidencia de un problema de rendimiento.

## Persistencia y compatibilidad

No borrar las claves v1 ni regenerar `legacyProgress.json`. No generar IDs en
runtime ni a partir de la posición actual. Una modificación de textos conserva
el ID existente. Reordenar MTs y zonas no cambia sus IDs. Si se cambia la
descripción de una página, mover su ID a la nueva clave en `progressIds`.

La regeneración desde el documento original compara con la guía anterior y
aborta ante asociaciones ambiguas. Una visita nueva con un nombre existente
requiere revisar explícitamente su identidad. El snapshot legado solo existe
para migrar usuarios anteriores, nunca para asignar IDs a contenido nuevo.

## Validación

`npm run check` es la puerta de entrada: lint estricto, tipos con generación de
rutas, pruebas unitarias y build. Después, `npm run test:e2e` ejecuta Chromium
sobre el build local en el puerto 3100. CI utiliza instalación reproducible con
`npm ci`. Las pruebas de navegador bloquean servicios externos para comprobar
que los flujos locales no dependen de PokéAPI.

## Dependencias y seguridad

Next y `eslint-config-next` se mantienen en la misma versión exacta. Node usa la
rama 22 y sus tipos correspondientes. Revisar actualizaciones con `npm audit`
y volver a ejecutar todas las comprobaciones antes de aceptar cambios.

Revisión del 2026-11-04: Next se actualizó a 16.4.5 y se aplicaron correcciones
compatibles del lockfile. `npm audit --omit=dev` no reportó vulnerabilidades.
La auditoría completa conserva 16 avisos moderados derivados de `minimatch` en
el árbol de ESLint. La propuesta automática con `--force` retrocede ESLint y
su configuración a versiones incompatibles; no debe aplicarse sin revisar el
árbol de herramientas. Estos resultados son una fotografía, no una garantía
permanente: volver a consultar la auditoría en cada actualización.
