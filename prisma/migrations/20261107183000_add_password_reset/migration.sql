-- Recuperación de contraseña.
--
-- Igual que la verificación de correo: se guarda el SHA-256 del token, no el
-- token que viaja por mail.
ALTER TABLE "User"
  ADD COLUMN "passwordResetToken" TEXT,
  ADD COLUMN "passwordResetSentAt" TIMESTAMP(3),
  ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_passwordResetToken_key"
  ON "User"("passwordResetToken");
