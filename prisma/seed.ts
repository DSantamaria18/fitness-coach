import "dotenv/config";
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
