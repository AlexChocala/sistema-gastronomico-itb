-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "nombresVariaciones" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "aclaracion" VARCHAR(200);
