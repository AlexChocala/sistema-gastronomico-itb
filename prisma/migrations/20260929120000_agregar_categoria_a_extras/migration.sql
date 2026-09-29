-- AlterTable
ALTER TABLE "Extra" ADD COLUMN     "idCategoria" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Extra" ADD CONSTRAINT "Extra_idCategoria_fkey" FOREIGN KEY ("idCategoria") REFERENCES "Categoria"("idCategoria") ON DELETE RESTRICT ON UPDATE CASCADE;
