ALTER TABLE "Sucursal" ADD COLUMN "recargoFueraRadio" DOUBLE PRECISION;
ALTER TABLE "Pedido" ADD COLUMN "recargoDelivery" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_recargoFueraRadio_valido"
CHECK ("recargoFueraRadio" IS NULL OR ("recargoFueraRadio" >= 0 AND "recargoFueraRadio" <= 10000000 AND "recargoFueraRadio" = floor("recargoFueraRadio")));
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_recargoDelivery_valido"
CHECK ("recargoDelivery" >= 0 AND "recargoDelivery" <= 10000000 AND "recargoDelivery" = floor("recargoDelivery"));
