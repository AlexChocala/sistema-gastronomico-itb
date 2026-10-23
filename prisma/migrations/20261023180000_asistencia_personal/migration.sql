BEGIN;
CREATE TABLE "HorarioUsuario" (
  "idHorario" SERIAL PRIMARY KEY,
  "idUsuario" INTEGER NOT NULL REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE,
  "diaSemana" INTEGER NOT NULL,
  "entradaMinutos" INTEGER NOT NULL,
  "salidaMinutos" INTEGER NOT NULL,
  "toleranciaMinutos" INTEGER NOT NULL DEFAULT 10,
  CONSTRAINT "HorarioUsuario_rangos" CHECK ("diaSemana" BETWEEN 0 AND 6 AND "entradaMinutos" BETWEEN 0 AND 1439 AND "salidaMinutos" BETWEEN 0 AND 1439 AND "entradaMinutos" <> "salidaMinutos" AND "toleranciaMinutos" BETWEEN 0 AND 120)
);
CREATE UNIQUE INDEX "HorarioUsuario_idUsuario_diaSemana_key" ON "HorarioUsuario"("idUsuario", "diaSemana");

CREATE TABLE "AsistenciaUsuario" (
  "idAsistencia" SERIAL PRIMARY KEY,
  "idUsuario" INTEGER NOT NULL REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE,
  "idSucursal" INTEGER REFERENCES "Sucursal"("idSucursal") ON DELETE SET NULL ON UPDATE CASCADE,
  "sucursalNombre" TEXT,
  "fechaJornada" DATE NOT NULL,
  "entradaPrevista" TIMESTAMPTZ(3) NOT NULL,
  "salidaPrevista" TIMESTAMPTZ(3) NOT NULL,
  "toleranciaMinutos" INTEGER NOT NULL,
  "entrada" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "salida" TIMESTAMPTZ(3),
  CONSTRAINT "AsistenciaUsuario_rangos" CHECK ("salidaPrevista" > "entradaPrevista" AND "salidaPrevista" < "entradaPrevista" + INTERVAL '24 hours' AND "toleranciaMinutos" BETWEEN 0 AND 120 AND ("salida" IS NULL OR "salida" >= "entrada"))
);
CREATE UNIQUE INDEX "AsistenciaUsuario_idUsuario_fechaJornada_key" ON "AsistenciaUsuario"("idUsuario", "fechaJornada");
CREATE UNIQUE INDEX "AsistenciaUsuario_un_turno_abierto" ON "AsistenciaUsuario"("idUsuario") WHERE "salida" IS NULL;
CREATE INDEX "AsistenciaUsuario_idSucursal_fechaJornada_idx" ON "AsistenciaUsuario"("idSucursal", "fechaJornada");
-- El acceso se realiza desde el servidor con Prisma, nunca desde la API pública.
ALTER TABLE "HorarioUsuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AsistenciaUsuario" ENABLE ROW LEVEL SECURITY;
COMMIT;
