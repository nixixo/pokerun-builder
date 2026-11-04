// app/page.tsx
// Con la nueva estructura, esta ruta NO implementa lógica ni UI propia:
// solo importa el componente raíz de la feature y lo renderiza.

import TeamBuilder from "@/components/team-builder/TeamBuilder";

export default function Page() {
  return <TeamBuilder />;
}