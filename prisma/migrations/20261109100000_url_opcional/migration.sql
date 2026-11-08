-- La oferta puede guardarse pegando su texto, sin URL posteable
-- (portales con login o sin página pública reciben el texto directo).
ALTER TABLE "Postulacion" ALTER COLUMN "url" DROP NOT NULL;
