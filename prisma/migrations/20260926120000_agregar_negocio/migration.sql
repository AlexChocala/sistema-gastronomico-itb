-- CreateTable
CREATE TABLE "Negocio" (
    "idNegocio" INTEGER NOT NULL DEFAULT 1,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "logoPath" TEXT,
    "instagram" TEXT,
    "tiktok" TEXT,
    "facebook" TEXT,

    CONSTRAINT "Negocio_pkey" PRIMARY KEY ("idNegocio"),
    -- Single-tenant: solo puede existir el negocio con id 1.
    CONSTRAINT "Negocio_unico" CHECK ("idNegocio" = 1)
);

-- AlterTable: se renombra (no se borra) para conservar los números ya cargados.
ALTER TABLE "Sucursal" RENAME COLUMN "telefono" TO "whatsapp";
