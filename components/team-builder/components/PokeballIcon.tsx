// ─── Icono de Pokéball (SVG inline, sin dependencias externas) ──────────────
export const PokeballIcon = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
    <defs>
      <clipPath id="pokeball-top-clip">
        <rect x="0" y="0" width="40" height="19" />
      </clipPath>
      <clipPath id="pokeball-bottom-clip">
        <rect x="0" y="21" width="40" height="19" />
      </clipPath>
    </defs>
    <circle cx="20" cy="20" r="18" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
    <g clipPath="url(#pokeball-top-clip)">
      <circle cx="20" cy="20" r="18" fill="#ef4444" stroke="#0f172a" strokeWidth="2" />
    </g>
    <g clipPath="url(#pokeball-bottom-clip)">
      <circle cx="20" cy="20" r="18" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
    </g>
    <rect x="1" y="18.5" width="38" height="3" fill="#0f172a" />
    <circle cx="20" cy="20" r="6.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="2.2" />
    <circle cx="20" cy="20" r="3" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.6" />
  </svg>
);
