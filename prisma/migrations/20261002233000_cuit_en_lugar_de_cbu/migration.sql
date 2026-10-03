-- El CBU/CVU deja de pedirse: en su lugar va el CUIT/CUIL del titular, para que el
-- cliente verifique a quién le transfiere. Un CBU no se puede convertir en CUIT, así que
-- el dato anterior se descarta.

-- AlterTable
ALTER TABLE "Negocio" DROP COLUMN "transferenciaCbu",
ADD COLUMN     "transferenciaCuit" VARCHAR(11);
