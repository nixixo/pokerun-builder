import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { StorageNotice } from "@/components/shared/StorageNotice";

// Solo la monoespaciada. Geist Sans también se cargaba, pero no llegaba a
// verse nunca: globals.css fija `body { font-family: Arial, ... }`, que gana
// sobre la variable, y ninguna clase usa `font-sans`. Era una fuente bajada
// de red en cada visita a cambio de nada. La mono sí se usa (`font-mono`, en
// el editor de sprites, las plantillas guardadas y el export de marcadores).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pokerun Builder",
  description: "¡Crea tu equipo y balancealo para tu run de Pokemon!",
};

/**
 * En el móvil, la barra del navegador se pinta de este color en vez de blanco:
 * sin esto, una franja clara corona una página que es casi negra.
 *
 * `#0a0a0a` es el mismo --background de globals.css. Y no se toca el zoom
 * (nada de `maximumScale` ni `userScalable: false`): impedir ampliar deja
 * fuera a quien lo necesita para leer.
 */
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang="es": la aplicación arranca en español (ver `useState<Lang>("es")`
    // en TeamBuilder) y la Guía es solo en español. Decía "en", así que un
    // lector de pantalla leía todo el texto castellano con fonética inglesa, y
    // los traductores automáticos se ofrecían a traducirlo a su propio idioma.
    <html
      lang="es"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <StorageNotice />
        {children}
      </body>
    </html>
  );
}