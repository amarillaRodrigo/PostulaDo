-- AlterTable
ALTER TABLE "Postulacion" ADD COLUMN     "aniosExperiencia" INTEGER,
ADD COLUMN     "responsabilidades" TEXT[],
ADD COLUMN     "tecnologias" TEXT[],
ADD COLUMN     "tonoEmpresa" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileText" TEXT;
