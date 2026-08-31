// Diagnóstico puntual, solo lectura: por qué reclassify-escalada.ts no
// encontró ninguna CardioEntry que migrar en producción.
import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveDatasourceConfig } from "../src/lib/prisma-datasource-config";

async function main(): Promise<void> {
  const adapter = new PrismaLibSql(resolveDatasourceConfig());
  const prisma = new PrismaClient({ adapter });

  const exercises = await prisma.exercise.findMany({
    where: { name: { contains: "scalada" } },
  });
  console.log("Ejercicios que contienen 'scalada':", JSON.stringify(exercises, null, 2));

  for (const ex of exercises) {
    const cardio = await prisma.cardioEntry.findMany({ where: { exerciseId: ex.id } });
    const strength = await prisma.strengthEntry.findMany({
      where: { exerciseId: ex.id },
      include: { sets: true },
    });
    console.log(`Exercise ${ex.id} (${ex.name}, ${ex.type}): ${cardio.length} CardioEntry, ${strength.length} StrengthEntry`);
    console.log("CardioEntry:", JSON.stringify(cardio, null, 2));
    console.log("StrengthEntry:", JSON.stringify(strength, null, 2));
  }

  await prisma.$disconnect();
}

void main();
