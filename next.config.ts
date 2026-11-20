import type { NextConfig } from "next";

// Headers de seguridad para todas las rutas. No se agrega CSP a propósito: necesita
// revisarse con los scripts y las imágenes del bucket antes de activarla.
const headersSeguridad = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: headersSeguridad }];
  },
};

export default nextConfig;
