import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// BL-026: iOS no respeta manifest.icons, solo <link rel="apple-touch-icon">
// (que Next genera solo a partir de este fichero) — sin radio, iOS aplica
// su propia máscara redondeada.
export default function AppleIcon() {
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
          fontSize: 80,
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
