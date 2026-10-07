-- DropIndex
DROP INDEX "Usuario_username_key";

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "imagenPath" TEXT;

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "username",
ADD COLUMN     "fotoPerfilPath" TEXT;

