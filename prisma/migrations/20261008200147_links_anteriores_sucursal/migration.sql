-- CreateTable
CREATE TABLE "SlugAnterior" (
    "slug" TEXT NOT NULL,
    "idSucursal" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugAnterior_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "SlugAnterior_idSucursal_idx" ON "SlugAnterior"("idSucursal");

-- AddForeignKey
ALTER TABLE "SlugAnterior" ADD CONSTRAINT "SlugAnterior_idSucursal_fkey" FOREIGN KEY ("idSucursal") REFERENCES "Sucursal"("idSucursal") ON DELETE RESTRICT ON UPDATE CASCADE;
