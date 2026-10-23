-- Aditiva: las sucursales existentes quedan sin límite hasta que el admin lo configure.
ALTER TABLE "Sucursal" ADD COLUMN "radioMaximoKm" DOUBLE PRECISION;

ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_radioMaximoKm_valido" CHECK (
  "radioMaximoKm" IS NULL
  OR (
    "radioDeliveryKm" IS NOT NULL
    AND "radioMaximoKm" >= "radioDeliveryKm"
    AND "radioMaximoKm" <= 100
  )
);
