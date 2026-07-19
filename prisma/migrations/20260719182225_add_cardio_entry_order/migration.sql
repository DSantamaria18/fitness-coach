-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CardioEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "distanceKm" REAL,
    "avgSpeedKmh" REAL,
    "avgPaceSecPerKm" INTEGER,
    "avgHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "steps" INTEGER,
    "stepFrequency" REAL,
    "kcal" INTEGER,
    "rpe" INTEGER,
    "notes" TEXT,
    CONSTRAINT "CardioEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CardioEntry_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CardioEntry" ("avgHeartRate", "avgPaceSecPerKm", "avgSpeedKmh", "distanceKm", "durationSeconds", "exerciseId", "id", "kcal", "maxHeartRate", "notes", "rpe", "sessionId", "stepFrequency", "steps") SELECT "avgHeartRate", "avgPaceSecPerKm", "avgSpeedKmh", "distanceKm", "durationSeconds", "exerciseId", "id", "kcal", "maxHeartRate", "notes", "rpe", "sessionId", "stepFrequency", "steps" FROM "CardioEntry";
DROP TABLE "CardioEntry";
ALTER TABLE "new_CardioEntry" RENAME TO "CardioEntry";
CREATE INDEX "CardioEntry_sessionId_idx" ON "CardioEntry"("sessionId");
CREATE INDEX "CardioEntry_exerciseId_idx" ON "CardioEntry"("exerciseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
