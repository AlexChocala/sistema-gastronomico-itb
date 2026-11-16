-- Historial independiente para los precios finales de las variaciones.
CREATE TABLE "HistorialPrecioVariacion" (
    "idHistorial" SERIAL NOT NULL,
    "precioAnterior" DOUBLE PRECISION,
    "precioNuevo" DOUBLE PRECISION NOT NULL,
    "fechaCambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idVariacion" INTEGER NOT NULL,

    CONSTRAINT "HistorialPrecioVariacion_pkey" PRIMARY KEY ("idHistorial")
);

CREATE INDEX "HistorialPrecioVariacion_idVariacion_fechaCambio_idx"
ON "HistorialPrecioVariacion"("idVariacion", "fechaCambio" DESC, "idHistorial" DESC);

ALTER TABLE "HistorialPrecioVariacion"
ADD CONSTRAINT "HistorialPrecioVariacion_idVariacion_fkey"
FOREIGN KEY ("idVariacion") REFERENCES "Variacion"("idVariacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cuando cambia el precio base, cambia también el precio final de cada variación.
CREATE OR REPLACE FUNCTION public.registrar_historial_precio_variaciones_producto()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."precio" IS DISTINCT FROM NEW."precio" THEN
    INSERT INTO public."HistorialPrecioVariacion" ("precioAnterior", "precioNuevo", "idVariacion")
    SELECT
      OLD."precio" + v."precioAdicional",
      NEW."precio" + v."precioAdicional",
      v."idVariacion"
    FROM public."Variacion" v
    WHERE v."idProducto" = NEW."idProducto";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historial_precio_producto_variaciones ON public."Producto";
CREATE TRIGGER trg_historial_precio_producto_variaciones
AFTER UPDATE OF "precio" ON public."Producto"
FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_precio_variaciones_producto();

-- Cuando se crea o cambia el adicional, se registra el precio final de esa variación.
CREATE OR REPLACE FUNCTION public.registrar_historial_precio_variacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  precio_base DOUBLE PRECISION;
BEGIN
  SELECT "precio" INTO precio_base
  FROM public."Producto"
  WHERE "idProducto" = NEW."idProducto";

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public."HistorialPrecioVariacion" ("precioAnterior", "precioNuevo", "idVariacion")
    VALUES (NULL, precio_base + NEW."precioAdicional", NEW."idVariacion");
  ELSIF OLD."precioAdicional" IS DISTINCT FROM NEW."precioAdicional" THEN
    INSERT INTO public."HistorialPrecioVariacion" ("precioAnterior", "precioNuevo", "idVariacion")
    VALUES (
      precio_base + OLD."precioAdicional",
      precio_base + NEW."precioAdicional",
      NEW."idVariacion"
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_historial_precio_variacion ON public."Variacion";
CREATE TRIGGER trg_historial_precio_variacion
AFTER INSERT OR UPDATE OF "precioAdicional" ON public."Variacion"
FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_precio_variacion();
