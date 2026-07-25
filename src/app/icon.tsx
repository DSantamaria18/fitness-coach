import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// BL-026: icono PWA generado con next/og (incluido en Next.js) en vez de
// un PNG externo o una dependencia nueva (sharp/canvas) solo para pintar
// un cuadrado con texto — ver plan aprobado por David 2026-07-25.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#d9622b",
          color: "#ffffff",
          fontSize: 220,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        FC
      </div>
    ),
    { ...size },
  );
}
