-- AlterTable
ALTER TABLE "Negocio" ADD COLUMN     "transferenciaAlias" TEXT,
ADD COLUMN     "transferenciaCbu" TEXT,
ADD COLUMN     "transferenciaTitular" TEXT;

-- AlterTable
ALTER TABLE "Sucursal" ADD COLUMN     "ofreceDelivery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ofreceRetiro" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "slug" TEXT;

-- Completa el slug de las sucursales que ya existían, con la misma regla que
-- generarSlug (lib/sucursales-validacion.ts): minúsculas, sin tildes ni ñ, todo lo que
-- no sea [a-z0-9] pasa a '-', sin '-' en los bordes y hasta 60 caracteres.
-- Si queda vacío se usa 'sucursal'. Si es una ruta reservada o se repite (a partir de la
-- segunda sucursal con el mismo nombre), se le agrega '-' || idSucursal.
WITH base AS (
    SELECT "idSucursal",
           trim(both '-' from left(
               trim(both '-' from regexp_replace(
                   lower(translate("nombre", 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')),
                   '[^a-z0-9]+', '-', 'g')),
               60)) AS slug
    FROM "Sucursal"
),
normalizado AS (
    SELECT "idSucursal",
           CASE WHEN slug = '' THEN 'sucursal' ELSE slug END AS slug
    FROM base
),
numerado AS (
    SELECT "idSucursal", slug,
           row_number() OVER (PARTITION BY slug ORDER BY "idSucursal") AS orden
    FROM normalizado
)
UPDATE "Sucursal" AS s
SET "slug" = CASE
    WHEN n.slug IN ('acceso', 'api', 'pantallas', 'pruebas', 'configuracion-inicial', 'configuracion',
                    'dashboard', 'pedidos', 'productos', 'usuarios', 'sucursales', 'reportes', 'perfil')
         OR n.orden > 1
        THEN n.slug || '-' || s."idSucursal"
    ELSE n.slug
END
FROM numerado AS n
WHERE n."idSucursal" = s."idSucursal";

-- Ya con todas las filas completas, el slug pasa a ser obligatorio.
ALTER TABLE "Sucursal" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Sucursal_slug_key" ON "Sucursal"("slug");
