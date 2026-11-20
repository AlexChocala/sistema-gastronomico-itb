-- Cuándo llegó cada pedido a Cocina y cuándo se marcó listo, para mostrar la espera en las
-- pantallas de Cocina. Las dos columnas aceptan vacío: no rompe nada ni pierde datos.
ALTER TABLE "Pedido" ADD COLUMN "fechaEnCocina" TIMESTAMP(3),
ADD COLUMN "fechaListo" TIMESTAMP(3);

-- Pedidos que ya estaban en curso: se toma la hora en que se cargaron. Los que esperan
-- el comprobante de una transferencia todavía no llegaron a Cocina.
UPDATE "Pedido" SET "fechaEnCocina" = "fecha" WHERE "estadoPedido" <> 'pendiente_pago';
