-- Lotes: el plan guardado en la cuenta, no solo en el navegador.
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT,
    "ids" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lote_userId_createdAt_idx" ON "Lote"("userId", "createdAt");

ALTER TABLE "Lote" ADD CONSTRAINT "Lote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
