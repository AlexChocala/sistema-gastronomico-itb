-- "Envío gratis hasta" pasa a aceptar 0 = sin envío gratis (todos pagan el costo del envío).
ALTER TABLE "Sucursal" DROP CONSTRAINT "Sucursal_cobertura_delivery_valida";

ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_cobertura_delivery_valida" CHECK (
  ("radioDeliveryKm" IS NULL AND "latitud" IS NULL AND "longitud" IS NULL)
  OR (
    "radioDeliveryKm" IS NOT NULL AND "latitud" IS NOT NULL AND "longitud" IS NOT NULL
    AND "radioDeliveryKm" >= 0 AND "radioDeliveryKm" <= 100
    AND "latitud" >= -90 AND "latitud" <= 90
    AND "longitud" >= -180 AND "longitud" <= 180
  )
);

ALTER TABLE "Sucursal" DROP CONSTRAINT "Sucursal_radioMaximoKm_valido";

ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_radioMaximoKm_valido" CHECK (
  "radioMaximoKm" IS NULL
  OR (
    "radioDeliveryKm" IS NOT NULL
    AND "radioMaximoKm" >= 0.1
    AND "radioMaximoKm" >= "radioDeliveryKm"
    AND "radioMaximoKm" <= 100
  )
);
