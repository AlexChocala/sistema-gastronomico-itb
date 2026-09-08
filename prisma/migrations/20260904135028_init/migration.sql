-- CreateTable
CREATE TABLE "Rol" (
    "idRol" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("idRol")
);

-- CreateTable
CREATE TABLE "Provincia" (
    "idProvincia" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Provincia_pkey" PRIMARY KEY ("idProvincia")
);

-- CreateTable
CREATE TABLE "Localidad" (
    "idLocalidad" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "idProvincia" INTEGER NOT NULL,

    CONSTRAINT "Localidad_pkey" PRIMARY KEY ("idLocalidad")
);

-- CreateTable
CREATE TABLE "Sucursal" (
    "idSucursal" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT NOT NULL,
    "horario" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "idLocalidad" INTEGER NOT NULL,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("idSucursal")
);

-- CreateTable
CREATE TABLE "SucursalLocalidad" (
    "idSucursal" INTEGER NOT NULL,
    "idLocalidad" INTEGER NOT NULL,

    CONSTRAINT "SucursalLocalidad_pkey" PRIMARY KEY ("idSucursal","idLocalidad")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "idUsuario" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "idRol" INTEGER NOT NULL,
    "idSucursal" INTEGER,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("idUsuario")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "idCategoria" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("idCategoria")
);

-- CreateTable
CREATE TABLE "Producto" (
    "idProducto" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "idCategoria" INTEGER NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("idProducto")
);

-- CreateTable
CREATE TABLE "SucursalProducto" (
    "idSucursal" INTEGER NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SucursalProducto_pkey" PRIMARY KEY ("idSucursal","idProducto")
);

-- CreateTable
CREATE TABLE "Variacion" (
    "idVariacion" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioAdicional" DOUBLE PRECISION NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "idProducto" INTEGER NOT NULL,

    CONSTRAINT "Variacion_pkey" PRIMARY KEY ("idVariacion")
);

-- CreateTable
CREATE TABLE "Extra" (
    "idExtra" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioAdicional" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Extra_pkey" PRIMARY KEY ("idExtra")
);

-- CreateTable
CREATE TABLE "ProductoExtra" (
    "idProducto" INTEGER NOT NULL,
    "idExtra" INTEGER NOT NULL,

    CONSTRAINT "ProductoExtra_pkey" PRIMARY KEY ("idProducto","idExtra")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "idCliente" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "telefono" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("idCliente")
);

-- CreateTable
CREATE TABLE "TipoEntrega" (
    "idTipoEntrega" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "TipoEntrega_pkey" PRIMARY KEY ("idTipoEntrega")
);

-- CreateTable
CREATE TABLE "Descuento" (
    "idDescuento" SERIAL NOT NULL,
    "descripcion" TEXT NOT NULL,
    "porcentaje" DOUBLE PRECISION NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Descuento_pkey" PRIMARY KEY ("idDescuento")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "idPedido" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origenPedido" TEXT NOT NULL,
    "estadoPedido" TEXT NOT NULL,
    "metodoPago" TEXT NOT NULL,
    "estadoPago" TEXT NOT NULL,
    "direccion" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "idCliente" INTEGER NOT NULL,
    "idSucursal" INTEGER NOT NULL,
    "idUsuario" INTEGER,
    "idTipoEntrega" INTEGER NOT NULL,
    "idLocalidad" INTEGER,
    "idDescuento" INTEGER,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("idPedido")
);

-- CreateTable
CREATE TABLE "DetallePedido" (
    "idDetalle" SERIAL NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioBaseAplicado" DOUBLE PRECISION NOT NULL,
    "precioVariacionAplicado" DOUBLE PRECISION NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "idPedido" INTEGER NOT NULL,
    "idProducto" INTEGER NOT NULL,
    "idVariacion" INTEGER,

    CONSTRAINT "DetallePedido_pkey" PRIMARY KEY ("idDetalle")
);

-- CreateTable
CREATE TABLE "DetallePedidoExtra" (
    "idDetalle" INTEGER NOT NULL,
    "idExtra" INTEGER NOT NULL,
    "precioExtraAplicado" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DetallePedidoExtra_pkey" PRIMARY KEY ("idDetalle","idExtra")
);

-- CreateTable
CREATE TABLE "HistorialPrecioProducto" (
    "idHistorial" SERIAL NOT NULL,
    "precioAnterior" DOUBLE PRECISION,
    "precioNuevo" DOUBLE PRECISION NOT NULL,
    "fechaCambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idProducto" INTEGER NOT NULL,

    CONSTRAINT "HistorialPrecioProducto_pkey" PRIMARY KEY ("idHistorial")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombre_key" ON "Rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Provincia_nombre_key" ON "Provincia"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Localidad_nombre_idProvincia_key" ON "Localidad"("nombre", "idProvincia");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "TipoEntrega_nombre_key" ON "TipoEntrega"("nombre");

-- AddForeignKey
ALTER TABLE "Localidad" ADD CONSTRAINT "Localidad_idProvincia_fkey" FOREIGN KEY ("idProvincia") REFERENCES "Provincia"("idProvincia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_idLocalidad_fkey" FOREIGN KEY ("idLocalidad") REFERENCES "Localidad"("idLocalidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SucursalLocalidad" ADD CONSTRAINT "SucursalLocalidad_idSucursal_fkey" FOREIGN KEY ("idSucursal") REFERENCES "Sucursal"("idSucursal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SucursalLocalidad" ADD CONSTRAINT "SucursalLocalidad_idLocalidad_fkey" FOREIGN KEY ("idLocalidad") REFERENCES "Localidad"("idLocalidad") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_idRol_fkey" FOREIGN KEY ("idRol") REFERENCES "Rol"("idRol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_idSucursal_fkey" FOREIGN KEY ("idSucursal") REFERENCES "Sucursal"("idSucursal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_idCategoria_fkey" FOREIGN KEY ("idCategoria") REFERENCES "Categoria"("idCategoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SucursalProducto" ADD CONSTRAINT "SucursalProducto_idSucursal_fkey" FOREIGN KEY ("idSucursal") REFERENCES "Sucursal"("idSucursal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SucursalProducto" ADD CONSTRAINT "SucursalProducto_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variacion" ADD CONSTRAINT "Variacion_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoExtra" ADD CONSTRAINT "ProductoExtra_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoExtra" ADD CONSTRAINT "ProductoExtra_idExtra_fkey" FOREIGN KEY ("idExtra") REFERENCES "Extra"("idExtra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idCliente_fkey" FOREIGN KEY ("idCliente") REFERENCES "Cliente"("idCliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idSucursal_fkey" FOREIGN KEY ("idSucursal") REFERENCES "Sucursal"("idSucursal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idUsuario_fkey" FOREIGN KEY ("idUsuario") REFERENCES "Usuario"("idUsuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idTipoEntrega_fkey" FOREIGN KEY ("idTipoEntrega") REFERENCES "TipoEntrega"("idTipoEntrega") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idLocalidad_fkey" FOREIGN KEY ("idLocalidad") REFERENCES "Localidad"("idLocalidad") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idDescuento_fkey" FOREIGN KEY ("idDescuento") REFERENCES "Descuento"("idDescuento") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetallePedido" ADD CONSTRAINT "DetallePedido_idPedido_fkey" FOREIGN KEY ("idPedido") REFERENCES "Pedido"("idPedido") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetallePedido" ADD CONSTRAINT "DetallePedido_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetallePedido" ADD CONSTRAINT "DetallePedido_idVariacion_fkey" FOREIGN KEY ("idVariacion") REFERENCES "Variacion"("idVariacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetallePedidoExtra" ADD CONSTRAINT "DetallePedidoExtra_idDetalle_fkey" FOREIGN KEY ("idDetalle") REFERENCES "DetallePedido"("idDetalle") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetallePedidoExtra" ADD CONSTRAINT "DetallePedidoExtra_idExtra_fkey" FOREIGN KEY ("idExtra") REFERENCES "Extra"("idExtra") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialPrecioProducto" ADD CONSTRAINT "HistorialPrecioProducto_idProducto_fkey" FOREIGN KEY ("idProducto") REFERENCES "Producto"("idProducto") ON DELETE RESTRICT ON UPDATE CASCADE;
