-- Distingue "rotado" de "revocado".
--
-- Solo un token revocado por rotación puede tolerar la ventana de gracia de dos
-- pestañas. Un token cerrado por logout o por cambio de contraseña tiene que
-- dejar de servir al instante.
ALTER TABLE "RefreshToken" ADD COLUMN "rotated" BOOLEAN NOT NULL DEFAULT false;
