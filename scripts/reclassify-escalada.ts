// Migración de datos puntual: "Escalada" pasó de CARDIO a STRENGTH en el
// catálogo (prisma/seed.ts, ver DECISIONS.md 2026-08-31) porque predomina
// la fuerza de agarre/tren superior/core sobre el componente cardiovascular.
// El cambio de `Exercise.type` lo aplica el propio seed (upsert), pero eso
// no mueve las sesiones YA registradas: Session separa fuerza y cardio en
// tablas con columnas incompatibles (StrengthEntry+StrengthSet vs.
// CardioEntry), así que una fila histórica de Escalada quedó guardada como
// CardioEntry (duración/distancia/pulso) y no se reclasifica sola.
//
// No hay forma de derivar reps/peso reales de duración+RPE, así que la
// conversión usa una convención explícita (aprobada por David) para
// actividad a peso corporal medida por tiempo, no por repeticiones:
//   - StrengthSet.reps = 1 (una única "serie" que representa el intento
//     completo; no distorsiona el volumen de get-progress-report.ts porque
//     weightKg es nulo → reps * 0 = 0)
//   - StrengthSet.weightKg = null (peso corporal)
//   - StrengthSet.tempo = duración real, en texto libre (no es un campo
//     numérico agregado, así que no hay riesgo de corromper cálculos)
//   - StrengthSet.rpe = el RPE real reportado
//
// Uso:
//   npx tsx scripts/reclassify-escalada.ts           (contra DATABASE_URL / dev.db)
//   TURSO_DATABASE_URL=<url> TURSO_AUTH_TOKEN=<token> \
//     npx tsx scripts/reclassify-escalada.ts         (contra producción)
//
// Idempotente: si no quedan CardioEntry de Escalada (ya migrada, o nunca
// existió ninguna), no hace nada.
import "dotenv/config";
import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatasourceConfig } from "../src/lib/prisma-datasource-config";

// Datos reales de la única sesión histórica afectada, confirmados por
// David (2026-08-31) — no derivables de los datos guardados en CardioEntry.
const HISTORICAL_DURATION_TEMPO = "90:00";
const HISTORICAL_RPE = 8;

export async function reclassifyEscalada(prisma: PrismaClient): Promise<{
  migrated: number;
}> {
  const exercise = await prisma.exercise.findUnique({
    where: { name: "Escalada" },
  });
  if (!exercise) {
    console.log('No existe ningún ejercicio "Escalada" en este target.');
    return { migrated: 0 };
  }

  const cardioEntries = await prisma.cardioEntry.findMany({
    where: { exerciseId: exercise.id },
  });
  if (cardioEntries.length === 0) {
    console.log("No hay CardioEntry de Escalada pendientes de migrar.");
    return { migrated: 0 };
  }
  if (cardioEntries.length > 1) {
    throw new Error(
      `Se esperaba como mucho 1 CardioEntry histórica de Escalada, hay ${cardioEntries.length}. ` +
        "Revisa manualmente antes de aplicar la duración/RPE fijos de este script a varias sesiones distintas.",
    );
  }

  const cardioEntry = cardioEntries[0];

  await prisma.$transaction([
    prisma.strengthEntry.create({
      data: {
        sessionId: cardioEntry.sessionId,
        exerciseId: exercise.id,
        order: cardioEntry.order,
        sets: {
          create: {
            order: 1,
            reps: 1,
            weightKg: null,
            tempo: HISTORICAL_DURATION_TEMPO,
            rpe: HISTORICAL_RPE,
          },
        },
      },
    }),
    prisma.cardioEntry.delete({ where: { id: cardioEntry.id } }),
  ]);

  console.log(
    `Migrada la sesión ${cardioEntry.sessionId}: CardioEntry ${cardioEntry.id} -> StrengthEntry (${HISTORICAL_DURATION_TEMPO}, RPE ${HISTORICAL_RPE}).`,
  );
  return { migrated: 1 };
}

const isMainModule = process.argv[1]
  ? import.meta.url === `file://${path.resolve(process.argv[1])}`
  : false;

if (isMainModule) {
  void main();
}

async function main(): Promise<void> {
  const adapter = new PrismaLibSql(resolveDatasourceConfig());
  const prisma = new PrismaClient({ adapter });
  try {
    await reclassifyEscalada(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
