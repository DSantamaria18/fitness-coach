-- CreateTable
CREATE TABLE "ComentarioProgreso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "generadoEn" DATETIME NOT NULL,
    CONSTRAINT "ComentarioProgreso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ComentarioProgreso_userId_key" ON "ComentarioProgreso"("userId");
