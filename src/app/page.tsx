import { Bike, ChevronRight, MapPin, ShoppingBag } from "@/components/icons";

const restaurante = {
  nombre: "Sabor Porteño",
  tagline: "Parrilla y algo más 🔥",
  redes: [
    {
      nombre: "Instagram",
      href: "https://instagram.com",
      icono: (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      nombre: "TikTok",
      href: "https://tiktok.com",
      icono: (
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path
            d="M16 3v10.5a3.5 3.5 0 1 1-3-3.46V7a6.5 6.5 0 1 0 6.5 6.5V9.8a6.3 6.3 0 0 0 3.5 1.06V7.9A4.3 4.3 0 0 1 19 7.5c-1.3-.7-2-1.9-2-3.5h-1Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ],
};

const sucursales = [
  { nombre: "Las Tunas (Pacheco)", slug: "las-tunas", modalidad: "Delivery" },
  { nombre: "Virreyes", slug: "virreyes", modalidad: "Delivery y retiro" },
  { nombre: "Puerto de Frutos, Tigre", slug: "puerto-de-frutos", modalidad: "Delivery y retiro" },
  { nombre: "San Fernando y alrededores", slug: "san-fernando", modalidad: "Delivery y retiro" },
];

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .map((palabra) => palabra[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Home() {
  return (
    <div className="flex flex-1 justify-center bg-bg px-4 py-12 text-text" lang="es">
      <main className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex size-24 items-center justify-center rounded-full bg-accent text-3xl font-bold text-on-accent shadow-sm ring-8 ring-accent-soft">
          {iniciales(restaurante.nombre)}
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="page-title">{restaurante.nombre}</h1>
          <p className="text-sm text-muted">{restaurante.tagline}</p>
        </div>

        <div className="flex items-center gap-3">
          {restaurante.redes.map((red) => (
            <a
              key={red.nombre}
              href={red.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={red.nombre}
              className="flex size-11 items-center justify-center rounded-full bg-surface text-text shadow-sm transition-colors hover:bg-accent hover:text-on-accent"
            >
              {red.icono}
            </a>
          ))}
        </div>

        <section aria-labelledby="titulo-sucursales" className="mt-4 flex w-full flex-col gap-3">
          <h2 id="titulo-sucursales" className="section-label text-center">
            Elegí tu local más cercano
          </h2>

          {sucursales.map((sucursal) => (
            <a
              key={sucursal.slug}
              href={`/${sucursal.slug}`}
              className="group flex w-full items-center gap-4 rounded-3xl bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <MapPin className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="leading-tight">{sucursal.nombre}</span>
                <span className="flex flex-wrap gap-1.5">
                  {sucursal.modalidad.includes("Delivery") && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-0.5 text-xs text-muted">
                      <Bike className="size-3.5" />
                      Delivery
                    </span>
                  )}
                  {sucursal.modalidad.includes("retiro") && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-0.5 text-xs text-muted">
                      <ShoppingBag className="size-3.5" />
                      Retiro
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </a>
          ))}
        </section>
      </main>
    </div>
  );
}

