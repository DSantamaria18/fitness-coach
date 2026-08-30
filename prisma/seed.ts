import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient, ExerciseType } from "../src/generated/prisma/client";
import { resolveDatasourceConfig } from "../src/lib/prisma-datasource-config";

// Mismo adapter y misma resolución de URL que la app (src/lib/prisma.ts):
// el seed puede sembrar tanto un fichero SQLite local (dev/E2E) como una
// Turso remota si algún día se necesita sembrar producción a mano, sin
// duplicar la lógica de qué variable de entorno gana — ver DECISIONS.md
// 2026-07-20.
const adapter = new PrismaLibSql(resolveDatasourceConfig());
const prisma = new PrismaClient({ adapter });

// Catálogo inicial sembrado a partir de los ejercicios que ya usaba la
// skill "sesion-entrenamiento" (SPEC.md §3). Ampliable por David más
// adelante directamente en base de datos o vía la pantalla de
// administración en /ajustes (ver FEATURES.md).
//
// aiRecommendable: false marca cardio que David hace de forma espontánea
// (surf, salida al monte, escalada, natación) — sigue siendo válido para
// loguear la sesión a mano, pero la IA no debe proponerlo por iniciativa
// propia (list_exercises solo devuelve el resto, ver DECISIONS.md).
const exercises: {
  name: string;
  type: ExerciseType;
  aiRecommendable?: boolean;
}[] = [
  { name: "Sentadilla", type: ExerciseType.STRENGTH },
  { name: "Peso muerto", type: ExerciseType.STRENGTH },
  { name: "Press banca", type: ExerciseType.STRENGTH },
  { name: "Press militar", type: ExerciseType.STRENGTH },
  { name: "Remo con barra", type: ExerciseType.STRENGTH },
  { name: "Zancadas", type: ExerciseType.STRENGTH },
  { name: "Hip thrust", type: ExerciseType.STRENGTH },
  { name: "Press inclinado con mancuernas", type: ExerciseType.STRENGTH },
  { name: "Remo a un brazo con mancuerna", type: ExerciseType.STRENGTH },
  { name: "Peso muerto rumano con mancuernas", type: ExerciseType.STRENGTH },
  { name: "Sentadilla búlgara", type: ExerciseType.STRENGTH },
  { name: "Sentadilla goblet con mancuerna", type: ExerciseType.STRENGTH },
  { name: "Flexiones", type: ExerciseType.STRENGTH },
  { name: "Fondos de tríceps en banco", type: ExerciseType.STRENGTH },
  { name: "Curl de bíceps con mancuernas", type: ExerciseType.STRENGTH },
  { name: "Extensión de tríceps con mancuerna", type: ExerciseType.STRENGTH },
  { name: "Elevaciones laterales con mancuernas", type: ExerciseType.STRENGTH },
  { name: "Pull-over con mancuerna", type: ExerciseType.STRENGTH },
  { name: "Puente de glúteos a una pierna", type: ExerciseType.STRENGTH },
  { name: "Plancha", type: ExerciseType.STRENGTH },
  { name: "Elevación de piernas", type: ExerciseType.STRENGTH },
  { name: "Dominadas negativas", type: ExerciseType.STRENGTH },
  { name: "Suspensión en barra", type: ExerciseType.STRENGTH },
  { name: "Remo invertido en barra", type: ExerciseType.STRENGTH },
  { name: "Fondos en paralelas", type: ExerciseType.STRENGTH },
  { name: "Carrera", type: ExerciseType.CARDIO },
  { name: "Escaladores", type: ExerciseType.CARDIO },
  { name: "Jumping jacks", type: ExerciseType.CARDIO },
  { name: "Rodillas altas", type: ExerciseType.CARDIO },
  {
    name: "Natación",
    type: ExerciseType.CARDIO,
    aiRecommendable: false,
  },
  { name: "Surf", type: ExerciseType.CARDIO, aiRecommendable: false },
  {
    name: "Salida al monte",
    type: ExerciseType.CARDIO,
    aiRecommendable: false,
  },
  { name: "Escalada", type: ExerciseType.CARDIO, aiRecommendable: false },
  // Añadidos junto a la primera ronda de imágenes/instrucciones (ver
  // prisma/exercise-media.json y DECISIONS.md 2026-08-30): movimientos
  // compuestos con el material de David, priorizados sobre aislados,
  // verificados uno a uno contra el GIF real antes de aprobarlos.
  { name: "Flexiones inclinadas", type: ExerciseType.STRENGTH },
  { name: "Dominadas", type: ExerciseType.STRENGTH },
  { name: "Dominadas supinas", type: ExerciseType.STRENGTH },
  { name: "Step-up con mancuernas", type: ExerciseType.STRENGTH },
  { name: "Puente de glúteos", type: ExerciseType.STRENGTH },
  { name: "Burpees", type: ExerciseType.CARDIO },
  { name: "Bear crawl", type: ExerciseType.CARDIO },
];

// Enriquecimiento de imagen/instrucciones (ver prisma/exercise-media.json):
// datos derivados de exercises-dataset (MIT, instrucciones en español) y
// medios © Gym visual, redistribuidos con permiso — atribución obligatoria
// en la UI donde se muestren (ver NOTICE.md del dataset original y
// DECISIONS.md 2026-08-30). Los ficheros binarios ya viven en
// public/exercise-media/<datasetId>.{jpg,gif}.
const exerciseMedia: {
  name: string;
  datasetId: string;
  instructionsEs: string;
  image: string;
  gif: string;
}[] = JSON.parse(
  readFileSync(new URL("./exercise-media.json", import.meta.url), "utf-8"),
);

async function main() {
  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: {
        type: exercise.type,
        aiRecommendable: exercise.aiRecommendable ?? true,
      },
      create: exercise,
    });
  }

  for (const media of exerciseMedia) {
    await prisma.exercise.updateMany({
      where: { name: media.name },
      data: {
        instructionsEs: media.instructionsEs,
        imageUrl: `/exercise-media/${media.datasetId}.jpg`,
        gifUrl: `/exercise-media/${media.datasetId}.gif`,
      },
    });
  }

  // Usuario único del MVP (SPEC §2), sembrado desde variables de entorno en
  // vez de tener un flujo de registro público. ADMIN_PASSWORD_HASH ya debe
  // venir hasheado (ver `npm run hash-password`) — nunca se guarda el
  // password en claro ni en el .env.
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (adminUsername && adminPasswordHash) {
    await prisma.user.upsert({
      where: { username: adminUsername },
      update: { passwordHash: adminPasswordHash },
      create: { username: adminUsername, passwordHash: adminPasswordHash },
    });
  } else {
    console.warn(
      "ADMIN_USERNAME/ADMIN_PASSWORD_HASH no definidos: se omite la siembra del usuario admin.",
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
