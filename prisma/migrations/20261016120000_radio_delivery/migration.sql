-- Aditiva: las sucursales existentes quedan pendientes de configurar su cobertura.
-- No se cambian pedidos, direcciones ni formas de entrega existentes.
ALTER TABLE "Sucursal"
  ADD COLUMN "radioDeliveryKm" DOUBLE PRECISION,
  ADD COLUMN "latitud" DOUBLE PRECISION,
  ADD COLUMN "longitud" DOUBLE PRECISION;

ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_cobertura_delivery_valida" CHECK (
  ("radioDeliveryKm" IS NULL AND "latitud" IS NULL AND "longitud" IS NULL)
  OR (
    "radioDeliveryKm" IS NOT NULL AND "latitud" IS NOT NULL AND "longitud" IS NOT NULL
    AND "radioDeliveryKm" >= 0.1 AND "radioDeliveryKm" <= 100
    AND "latitud" >= -90 AND "latitud" <= 90
    AND "longitud" >= -180 AND "longitud" <= 180
  )
);
