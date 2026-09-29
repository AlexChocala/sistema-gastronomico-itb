-- AlterTable
ALTER TABLE "Cliente" ALTER COLUMN "telefono" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "referencias" TEXT;
