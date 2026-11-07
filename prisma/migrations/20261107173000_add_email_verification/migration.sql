-- Verificación de correo.
--
-- `emailVerificationToken` guarda el SHA-256 del token que viaja por mail,
-- no el token: si alguien lee la base no puede verificar cuentas ajenas.
ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationToken" TEXT,
  ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_emailVerificationToken_key"
  ON "User"("emailVerificationToken");
