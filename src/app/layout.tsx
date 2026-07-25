import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBarGate } from "@/components/nav-bar-gate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fitness Coach",
  description: "Seguimiento personal de entrenamiento y peso corporal.",
  // BL-026: iOS ignora manifest.display, necesita esta meta aparte para
  // abrir en modo standalone al añadir a pantalla de inicio.
  appleWebApp: {
    capable: true,
    title: "Fitness Coach",
  },
};

// BL-026: theme_color del manifest no seguiría prefers-color-scheme, este
// viewport sí — mismos valores de --ember claro/oscuro en globals.css.
// colorScheme declara explícitamente que la página soporta ambos temas
// (<meta name="color-scheme">): sin esto, el modo standalone (icono de
// pantalla de inicio) de algunos navegadores móviles no aplica el tema
// oscuro aunque el propio SO esté en oscuro y la pestaña normal sí lo
// muestre bien — visto en producción (BL-019).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d9622b" },
    { media: "(prefers-color-scheme: dark)", color: "#f0813e" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col pb-16">
        {/* NavBarGate resuelve la sesión del lado del servidor y omite la
            nav por completo si no hay usuario autenticado (estará en
            /login). Ver src/components/nav-bar-gate.tsx. */}
        <NavBarGate />
        {/* BL-019: pb-16 (64px) en <body> reserva espacio para que el
            contenido no quede oculto detrás de la barra de pestañas
            inferior fija de NavBar (fixed bottom-0) — altura real medida en
            navegador (51px), con margen para no quedar pegado. Cada página
            ya lleva su propio <h1> de sección (el indicador de sección
            aparte, SectionIndicator, se eliminó por redundante). */}
        {children}
      </body>
    </html>
  );
}
