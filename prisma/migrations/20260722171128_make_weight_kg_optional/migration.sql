-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StrengthSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strengthEntryId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weightKg" REAL,
    "tempo" TEXT,
    "rpe" INTEGER,
    CONSTRAINT "StrengthSet_strengthEntryId_fkey" FOREIGN KEY ("strengthEntryId") REFERENCES "StrengthEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StrengthSet" ("id", "order", "reps", "rpe", "strengthEntryId", "tempo", "weightKg") SELECT "id", "order", "reps", "rpe", "strengthEntryId", "tempo", "weightKg" FROM "StrengthSet";
DROP TABLE "StrengthSet";
ALTER TABLE "new_StrengthSet" RENAME TO "StrengthSet";
CREATE INDEX "StrengthSet_strengthEntryId_idx" ON "StrengthSet"("strengthEntryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
