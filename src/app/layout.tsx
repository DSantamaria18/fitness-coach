import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBarGate } from "@/components/nav-bar-gate";
import { SectionIndicator } from "@/components/section-indicator";
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
      <body className="min-h-full flex flex-col">
        {/* NavBarGate resuelve la sesión del lado del servidor y omite la
            nav por completo si no hay usuario autenticado (estará en
            /login). Ver src/components/nav-bar-gate.tsx. */}
        <NavBarGate />
        {/* BL-010: indicador de sección activa, una sola vez aquí en vez de
            repetido en cada page.tsx — se autooculta (devuelve null) en
            rutas que no son ninguna de las 5 secciones (/login, /). Ver
            src/components/section-indicator.tsx. */}
        <SectionIndicator />
        {children}
      </body>
    </html>
  );
}
