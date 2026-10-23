-- Costo del envío por tramos de distancia: [{ "hastaKm": 2, "costo": 0 }, { "hastaKm": 5, "costo": 1000 }].
-- Las columnas viejas (radioDeliveryKm, recargoFueraRadio, radioMaximoKm) no se borran todavía:
-- la versión publicada las sigue leyendo hasta que se despliegue este cambio.
ALTER TABLE "Sucursal" ADD COLUMN "tramosDelivery" JSONB NOT NULL DEFAULT '[]';

-- Pasa la configuración vieja a tramos:
--   envío gratis hasta radioDeliveryKm (si es mayor que 0) y
--   recargoFueraRadio hasta la distancia máxima (o 100 km si no había).
UPDATE "Sucursal" SET "tramosDelivery" =
  CASE WHEN "radioDeliveryKm" > 0
    THEN jsonb_build_array(jsonb_build_object('hastaKm', "radioDeliveryKm", 'costo', 0))
    ELSE '[]'::jsonb END
  ||
  CASE WHEN "recargoFueraRadio" IS NOT NULL AND COALESCE("radioMaximoKm", 100) > "radioDeliveryKm"
    THEN jsonb_build_array(jsonb_build_object('hastaKm', COALESCE("radioMaximoKm", 100), 'costo', "recargoFueraRadio"))
    ELSE '[]'::jsonb END
WHERE "radioDeliveryKm" IS NOT NULL;

ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_tramosDelivery_lista" CHECK (jsonb_typeof("tramosDelivery") = 'array');

-- La ubicación ya no depende del radio: alcanza con que latitud y longitud vengan juntas.
ALTER TABLE "Sucursal" DROP CONSTRAINT "Sucursal_cobertura_delivery_valida";
ALTER TABLE "Sucursal" DROP CONSTRAINT "Sucursal_radioMaximoKm_valido";
ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_ubicacion_valida" CHECK (
  ("latitud" IS NULL AND "longitud" IS NULL)
  OR (
    "latitud" IS NOT NULL AND "longitud" IS NOT NULL
    AND "latitud" >= -90 AND "latitud" <= 90
    AND "longitud" >= -180 AND "longitud" <= 180
  )
);
