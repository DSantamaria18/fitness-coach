import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, ExerciseType } from "../src/generated/prisma/client";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// Catálogo inicial sembrado a partir de los ejercicios que ya usaba la
// skill "sesion-entrenamiento" (SPEC.md §3). Ampliable por David más
// adelante directamente en base de datos o vía una futura pantalla de
// administración (ver BACKLOG.md).
const exercises: { name: string; type: ExerciseType }[] = [
  { name: "Sentadilla", type: ExerciseType.STRENGTH },
  { name: "Peso muerto", type: ExerciseType.STRENGTH },
  { name: "Press banca", type: ExerciseType.STRENGTH },
  { name: "Press militar", type: ExerciseType.STRENGTH },
  { name: "Dominadas", type: ExerciseType.STRENGTH },
  { name: "Remo con barra", type: ExerciseType.STRENGTH },
  { name: "Zancadas", type: ExerciseType.STRENGTH },
  { name: "Hip thrust", type: ExerciseType.STRENGTH },
  { name: "Carrera", type: ExerciseType.CARDIO },
  { name: "Bicicleta", type: ExerciseType.CARDIO },
  { name: "Remo (máquina)", type: ExerciseType.CARDIO },
  { name: "Natación", type: ExerciseType.CARDIO },
];

async function main() {
  for (const exercise of exercises) {
    await prisma.exercise.upsert({
      where: { name: exercise.name },
      update: { type: exercise.type },
      create: exercise,
    });
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
