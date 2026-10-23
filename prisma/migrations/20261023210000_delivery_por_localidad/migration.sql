-- El costo del envío pasa a ser por localidad: cada sucursal elige a qué localidades
-- entrega y cuánto cobra en cada una.
--
-- Las filas que había en SucursalLocalidad eran solo sugerencias del desplegable viejo del
-- checkout (no limitaban ni cobraban nada). Se borran para que ninguna sucursal quede
-- entregando gratis a esas localidades sin que el admin lo haya decidido.
DELETE FROM "SucursalLocalidad";

ALTER TABLE "SucursalLocalidad" ADD COLUMN "costoEnvio" DOUBLE PRECISION NOT NULL;

ALTER TABLE "SucursalLocalidad" ADD CONSTRAINT "SucursalLocalidad_costoEnvio_valido"
CHECK ("costoEnvio" >= 0 AND "costoEnvio" <= 10000000 AND "costoEnvio" = floor("costoEnvio"));
