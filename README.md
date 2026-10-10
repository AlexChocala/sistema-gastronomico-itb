# Mise — Sistema de Gestión de Pedidos para Restaurantes

Sistema web para negocios gastronómicos con una o varias sucursales. Reúne la carta online, la toma de pedidos, la caja, la cocina, la administración del negocio y los reportes de ventas.

> Proyecto final del ITB (2026). Equipo de 4 personas.

## 🚀 Demos online

| Sección | Link |
|---|---|
| 🛒 Lado del cliente | [mise-gastronomico.vercel.app](https://mise-gastronomico.vercel.app) |
| ⚙️ Panel interno | [mise-gastronomico.vercel.app/acceso](https://mise-gastronomico.vercel.app/acceso) |

## Funcionalidades por rol

- **Cliente:** carta pública por sucursal, carrito y checkout con retiro o delivery, pago en efectivo o transferencia, y monitor público de pedidos del mostrador.
- **Empleado:** dashboard del día, gestión de pedidos de su sucursal y pantallas de caja y cocina.
- **Supervisor:** todo lo del empleado, más gestión de productos, categorías y extras, reportes de su sucursal e importación/exportación de productos por CSV.
- **Administrador:** todo lo anterior en todas las sucursales, más gestión de usuarios y sucursales, y configuración del negocio.

## Otras funcionalidades

- **Reportes:** gráficos y tablas por fechas, con exportación a PDF, Excel, CSV y JSON.
- **Acceso:** login por roles y recuperación de contraseña por email.

## Stack

| Área | Tecnologías |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend y datos | PostgreSQL (Supabase), Prisma 7, NextAuth |
| Otros | Nodemailer, Chart.js |
| Deploy | Vercel |

## Equipo

- Alex Chocala
- Damian Rodriguez
- Nicolas Otero
- Erika Wereta

## Estado

🚧 En desarrollo.

**Funcionando:** acceso, usuarios, sucursales, productos, carta online, pedidos, caja, cocina y reportes.

**Próximo paso:** subida de imágenes de productos, logo y perfiles.
