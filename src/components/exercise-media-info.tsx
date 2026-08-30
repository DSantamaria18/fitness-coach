"use client";

import { useState } from "react";

// Instrucciones/imagen enriquecidas desde exercises-dataset (MIT) para el
// texto; medios (imagen/GIF) © Gym visual, redistribuidos con permiso — la
// atribución de abajo es obligatoria en cualquier pantalla donde se
// muestren (ver NOTICE.md del dataset y DECISIONS.md 2026-08-30), no un
// adorno opcional.
export function ExerciseMediaInfo({
  name,
  instructionsEs,
  imageUrl,
  gifUrl,
}: {
  name: string;
  instructionsEs: string | null;
  imageUrl: string | null;
  gifUrl: string | null;
}) {
  const [showGif, setShowGif] = useState(false);

  if (!instructionsEs && !imageUrl) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-iron/10 p-3 text-sm">
      {imageUrl ? (
        <div className="flex flex-col items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- asset local 180x180, no justifica next/image para este volumen */}
          <img
            src={showGif && gifUrl ? gifUrl : imageUrl}
            alt={name}
            width={180}
            height={180}
            className="rounded-md"
          />
          {gifUrl ? (
            <button
              type="button"
              onClick={() => setShowGif((prev) => !prev)}
              className="text-xs font-medium underline"
            >
              {showGif ? "Ver imagen estática" : "Ver animación"}
            </button>
          ) : null}
        </div>
      ) : null}
      {instructionsEs ? <p className="text-iron">{instructionsEs}</p> : null}
      {imageUrl ? (
        <p className="text-xs text-iron/70">© Gym visual — gymvisual.com</p>
      ) : null}
    </div>
  );
}
