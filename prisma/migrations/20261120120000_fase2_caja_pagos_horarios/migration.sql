-- Fase 2: caja con turnos y arqueo, pagos por pedido (pago dividido), registro de
-- cancelaciones y modificaciones, horarios de pedidos online, accesos propios de pantalla
-- y bloqueo firme por intentos fallidos. Solo agrega tablas y columnas con valor por defecto
-- o vacías: no borra ni cambia lo existente. Revisar entre los tres antes de aplicar.

-- AlterTable
ALTER TABLE "Sucursal" ADD COLUMN     "pausaPedidosOnline" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "bloqueadoHasta" TIMESTAMP(3),
ADD COLUMN     "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pinBloqueadoHasta" TIMESTAMP(3),
ADD COLUMN     "pinClave" TEXT,
ADD COLUMN     "pinIntentosFallidos" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_pinClave_key" ON "Usuario"("pinClave");

-- CreateTable
CREATE TABLE "Caja" (
    "idCaja" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "idSucursal" INTEGER NOT NULL,

    CONSTRAINT "Caja_pkey" PRIMARY KEY ("idCaja")
);

-- CreateTable
CREATE TABLE "TurnoCaja" (
    "idTurno" SERIAL NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "montoInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efectivoEsperado" DOUBLE PRECISION,
    "efectivoContado" DOUBLE PRECISION,
    "observacion" TEXT,
    "idCaja" INTEGER NOT NULL,
    "idUsuarioApertura" INTEGER NOT NULL,
    "idUsuarioCierre" INTEGER,

    CONSTRAINT "TurnoCaja_pkey" PRIMARY KEY ("idTurno")
);

-- CreateTable
CREATE TABLE "Pago" (
    "idPago" SERIAL NOT NULL,
    "metodo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idPedido" INTEGER NOT NULL,
    "idUsuario" INTEGER,
    "idTurno" INTEGER,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("idPago")
);

-- CreateTable
CREATE TABLE "EventoPedido" (
    "idEvento" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT,
    "detalle" JSONB,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idPedido" INTEGER NOT NULL,
    "idUsuario" INTEGER,

    CONSTRAINT "EventoPedido_pkey" PRIMARY KEY ("idEvento")
);

-- CreateTable
CREATE TABLE "HorarioSucursal" (
    "idHorario" SERIAL NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "abreMin" INTEGER NOT NULL,
    "cierraMin" INTEGER NOT NULL,
    "idSucursal" INTEGER NOT NULL,

    CONSTRAINT "HorarioSucursal_pkey" PRIMARY KEY ("idHorario")
);

-- CreateTable
CREATE TABLE "AccesoPantalla" (
    "idAcceso" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocadoEn" TIMESTAMP(3),
    "idSucursal" INTEGER NOT NULL,

    CONSTRAINT "AccesoPantalla_pkey" PRIMARY KEY ("idAcceso")
);

-- CreateIndex
CREATE UNIQUE INDEX "Caja_idSucursal_nombre_key" ON "Caja"("idSucursal", "nombre");

-- CreateIndex
CREATE INDEX "TurnoCaja_idCaja_fechaApertura_idx" ON "TurnoCaja"("idCaja", "fechaApertura");

-- CreateIndex
CREATE INDEX "Pago_idPedido_idx" ON "Pago"("idPedido");

-- CreateIndex
CREATE INDEX "Pago_idTurno_idx" ON "Pago"("idTurno");

-- CreateIndex
CREATE INDEX "EventoPedido_idPedido_idx" ON "EventoPedido"("idPedido");

-- CreateIndex
CREATE INDEX "HorarioSucursal_idSucursal_diaSemana_idx" ON "HorarioSucursal"("idSucursal", "diaSemana");

-- CreateIndex
CREATE UNIQUE INDEX "AccesoPantalla_tokenHash_key" ON "AccesoPantalla"("tokenHash");

-- CreateIndex
CREATE INDEX "AccesoPantalla_idSucursal_idx" ON "AccesoPantalla"("idSucursal");

-- AddForeignKey
ALTER TABLE "Caja" ADD CONSTRAINT "Caja_idSucursal_fkey" FOREIGN KEY ("idSucursal") REFERENCES "Sucursal"("idSucursal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoCaja" ADD CONSTRAINT "TurnoCaja_idCaja_fkey" FOREIGN KEY ("idCaja") REFERENCES "Caja"("idCaja") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoCaja" ADD CONSTRAINT "TurnoCaja_idUsuarioApertura_fkey" FOREIGN KEY ("idUsuarioApertura") REFERENCES "Usuario"("idUsuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoCaja" ADD CONSTRAINT "TurnoCaja_idUsuarioCierre_fkey" FOREIGN KEY ("idUsuarioCierre") REFERENCES "Usuario"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_idPedido_fkey" FOREIGN KEY ("idPedido") REFERENCES "Pedido"("idPedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_idTurno_fkey" FOREIGN KEY ("idTurno") REFERENCES "TurnoCaja"("idTurno") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoPedido" ADD CONSTRAINT "EventoPedido_idPedido_fkey" FOREIGN KEY ("idPedido") REFERENCES "Pedido"("idPedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoPedido" ADD CONSTRAINT "EventoPedido_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioSucursal" ADD CONSTRAINT "HorarioSucursal_idSucursal_fkey" FOREIGN KEY ("idSucursal") REFERENCES "Sucursal"("idSucursal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccesoPantalla" ADD CONSTRAINT "AccesoPantalla_idSucursal_fkey" FOREIGN KEY ("idSucursal") REFERENCES "Sucursal"("idSucursal") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------------------
-- Reglas que Prisma no puede expresar en el esquema
-- ---------------------------------------------------------------------------------------

-- Una caja tiene a lo sumo un turno abierto a la vez.
CREATE UNIQUE INDEX "TurnoCaja_un_turno_abierto_por_caja" ON "TurnoCaja"("idCaja") WHERE "fechaCierre" IS NULL;

-- Valores válidos de las columnas nuevas.
ALTER TABLE "HorarioSucursal" ADD CONSTRAINT "HorarioSucursal_dia_valido" CHECK ("diaSemana" BETWEEN 0 AND 6);
ALTER TABLE "HorarioSucursal" ADD CONSTRAINT "HorarioSucursal_franja_valida" CHECK ("abreMin" >= 0 AND "abreMin" < 1440 AND "cierraMin" > "abreMin" AND "cierraMin" <= 2880);
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_metodo_valido" CHECK ("metodo" IN ('efectivo', 'transferencia'));
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_monto_positivo" CHECK ("monto" > 0);
ALTER TABLE "EventoPedido" ADD CONSTRAINT "EventoPedido_tipo_valido" CHECK ("tipo" IN ('cancelacion', 'modificacion'));
ALTER TABLE "AccesoPantalla" ADD CONSTRAINT "AccesoPantalla_tipo_valido" CHECK ("tipo" IN ('cocina', 'entregas', 'mostrador'));

-- ---------------------------------------------------------------------------------------
-- Datos existentes (no se pierde nada)
-- ---------------------------------------------------------------------------------------

-- Cada sucursal arranca con una caja, así el local que usa una sola no tiene que configurar nada.
INSERT INTO "Caja" ("nombre", "idSucursal") SELECT 'Caja 1', "idSucursal" FROM "Sucursal";

-- Los pedidos ya cobrados pasan a tener un único pago, con su método y su monto. Quién cobró
-- es quien cargó el pedido (en Caja cobra quien lo carga); sin turno, porque no existían.
INSERT INTO "Pago" ("metodo", "monto", "fecha", "idPedido", "idUsuario")
SELECT "metodoPago", "total", "fecha", "idPedido", "idUsuario"
FROM "Pedido"
WHERE "estadoPago" = 'pagado' AND "total" > 0 AND "metodoPago" IN ('efectivo', 'transferencia');
