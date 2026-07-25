import type { MetadataRoute } from "next";

// BL-026: manifest de instalación PWA. theme_color/background_color
// replican los tokens --ember/--background de globals.css en su valor
// claro — el manifest no puede seguir prefers-color-scheme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fitness Coach",
    short_name: "Fitness Coach",
    description: "Seguimiento personal de entrenamiento y peso corporal.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#d9622b",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
