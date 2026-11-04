// components/team-builder/components/SearchIcon.tsx
//
// La lupa que va dentro de los inputs de búsqueda de los modales (mismo estilo
// que el botón de buscar Pokémon). Se posiciona sola: el contenedor tiene que
// ser `relative`.
//
// Vivía duplicada DENTRO de AbilityFilterModal e ItemsBrowserModal, declarada
// en el cuerpo del componente. Eso es un componente creado en cada render: para
// React el tipo cambia de identidad cada vez, así que desmonta el <svg> viejo y
// monta uno nuevo en lugar de actualizarlo. Aquí, a nivel de módulo, su
// identidad es estable y además deja de estar escrita dos veces.

export function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
    >
      <circle cx="9" cy="9" r="6.2" stroke="currentColor" strokeWidth="2" />
      <path d="M13.6 13.6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
