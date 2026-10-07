'use client'

// Pantalla de Reportes (contenedor): filtros, pedido de datos, resumen y pestañas.
// Arranca en "Hoy" y en la sucursal de la barra superior; si esa cambia, se reinicia.

import { useEffect, useRef, useState } from 'react'
import { useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import { Aviso } from '@/components/ui/Aviso'
import { fechasDelAtajo } from '@/lib/reportes/fechas'
import type { NegocioReporte } from '@/lib/reportes/exportar-pdf'
import { PESTANAS, formatear, type IdPestana } from '@/lib/reportes/pestanas'
import { obtenerReportes, type ResultadoReportes } from '@/lib/reportes/reportes-api'
import type { Agrupacion, DatosReportes } from '@/lib/reportes/tipos'
import type { OpcionSucursal } from '@/lib/sucursales/sucursal-activa'
import { MENSAJES } from '@/lib/utils/mensajes'
import { ExportarReporte, type ContextoDescarga } from './ExportarReporte'
import { FiltrosReportes, type Filtros } from './FiltrosReportes'
import { GraficoReporte } from './GraficoReporte'
import { MapaDemanda } from './MapaDemanda'
import { TablaReporte } from './TablaReporte'

const DIA_MS = 24 * 60 * 60 * 1000

// El gráfico de período se agrupa solo según el largo del rango, para que no queden
// cientos de barras: hasta 31 días, por día; hasta ~6 meses, por semana; más, por mes.
function agrupacionDelRango(desde: string, hasta: string): Agrupacion {
  const dias = (new Date(hasta + 'T00:00:00Z').getTime() - new Date(desde + 'T00:00:00Z').getTime()) / DIA_MS + 1
  if (dias <= 31) return 'dia'
  return dias <= 183 ? 'semana' : 'mes'
}

// `clave` identifica la consulta: si no coincide con la actual, se está cargando otra.
type Estado = { clave: string; resultado: ResultadoReportes | null; error: string | null }

export function PantallaReportes({ negocio }: { negocio: NegocioReporte }) {
  const { sucursal, puedeElegir, opciones } = useSucursalActiva()

  if (!sucursal && !puedeElegir) {
    return (
      <Aviso tipo="advertencia" titulo="Sin sucursal asignada">
        Pedile a un administrador que te asigne una sucursal para ver sus reportes.
      </Aviso>
    )
  }

  return (
    <ContenidoReportes
      key={sucursal?.idSucursal ?? 'todas'}
      negocio={negocio}
      sucursalInicial={sucursal?.idSucursal ?? 'todas'}
      sucursalFija={puedeElegir ? null : (sucursal?.nombre ?? '')}
      opciones={opciones}
    />
  )
}

interface ContenidoReportesProps {
  negocio: NegocioReporte
  sucursalInicial: number | 'todas'
  sucursalFija: string | null
  opciones: OpcionSucursal[]
}

function ContenidoReportes({ negocio, sucursalInicial, sucursalFija, opciones }: ContenidoReportesProps) {
  const [filtros, setFiltros] = useState<Filtros>(() => ({ rango: 'hoy', ...fechasDelAtajo('hoy'), sucursal: sucursalInicial }))
  const [intento, setIntento] = useState(0)
  const [estado, setEstado] = useState<Estado>({ clave: '', resultado: null, error: null })

  const { desde, hasta, sucursal } = filtros
  const rangoValido = desde <= hasta
  const agrupacion = agrupacionDelRango(desde, hasta)
  const clave = `${desde}|${hasta}|${sucursal}|${agrupacion}|${intento}`
  const cargando = rangoValido && estado.clave !== clave

  useEffect(() => {
    if (!rangoValido) return
    let vigente = true
    obtenerReportes({ desde, hasta, sucursal, agrupacion }).then(
      (resultado) => vigente && setEstado({ clave, resultado, error: null }),
      (error: unknown) =>
        vigente && setEstado({ clave, resultado: null, error: error instanceof Error ? error.message : MENSAJES.panel.errorGenerico }),
    )
    return () => {
      vigente = false
    }
  }, [clave, rangoValido, desde, hasta, sucursal, agrupacion])

  const datos = estado.resultado?.datos
  const aFechaLegible = (fecha: string) => fecha.split('-').reverse().join('/')
  const contexto: ContextoDescarga = {
    negocio,
    periodo: desde === hasta ? aFechaLegible(desde) : `Del ${aFechaLegible(desde)} al ${aFechaLegible(hasta)}`,
    sucursal:
      sucursal === 'todas'
        ? 'Todas las sucursales'
        : (sucursalFija ?? opciones.find((opcion) => opcion.idSucursal === sucursal)?.nombre ?? ''),
    sufijoArchivo: desde === hasta ? desde : `${desde}_${hasta}`,
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">Reportes</h1>
        <p className="text-sm text-muted">Ventas de los pedidos entregados.</p>
      </header>

      <FiltrosReportes filtros={filtros} onCambiar={setFiltros} sucursalFija={sucursalFija} opciones={opciones} />

      {!rangoValido && <Aviso tipo="error">La fecha &quot;Desde&quot; no puede ser posterior a &quot;Hasta&quot;.</Aviso>}
      {estado.error && (
        <Aviso tipo="error" accion={{ texto: 'Reintentar', onClick: () => setIntento((n) => n + 1) }}>
          {estado.error}
        </Aviso>
      )}
      {estado.resultado?.esEjemplo && (
        <Aviso tipo="info" titulo="Datos de ejemplo">
          Los reportes todavía no están conectados con la base: estos números son de prueba.
        </Aviso>
      )}

      {datos ? (
        <div aria-busy={cargando} className={`flex flex-col gap-6 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          <Resumen datos={datos} />
          <Pestanas
            datos={datos}
            agrupacion={agrupacion}
            contexto={contexto}
            descargasHabilitadas={!cargando}
          />
        </div>
      ) : (
        cargando && <p className="text-sm text-muted">Cargando reportes…</p>
      )}
    </div>
  )
}

function Resumen({ datos }: { datos: DatosReportes }) {
  const { totalVendido, cantidadPedidos, ticketPromedio } = datos.resumen
  const tarjetas = [
    { titulo: 'Total vendido', valor: formatear(totalVendido, 'precio') },
    { titulo: 'Pedidos entregados', valor: formatear(cantidadPedidos, 'numero') },
    { titulo: 'Ticket promedio', valor: formatear(ticketPromedio, 'precio') },
  ]

  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      {tarjetas.map((tarjeta) => (
        <div key={tarjeta.titulo} className="rounded-3xl bg-surface p-5 shadow-sm">
          <dt className="text-sm text-muted">{tarjeta.titulo}</dt>
          <dd className="mt-1 text-2xl font-semibold text-text tabular-nums">{tarjeta.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

interface PestanasProps {
  datos: DatosReportes
  agrupacion: Agrupacion
  contexto: ContextoDescarga
  // Falso mientras se cargan otros filtros: lo que se ve todavía es lo anterior.
  descargasHabilitadas: boolean
}

function Pestanas({ datos, agrupacion, contexto, descargasHabilitadas }: PestanasProps) {
  const [elegida, setElegida] = useState<IdPestana>('periodo')
  const panel = useRef<HTMLDivElement>(null)
  const visibles = PESTANAS.filter((pestana) => !pestana.disponible || pestana.disponible(datos))
  // "Por sucursal" desaparece al elegir una sucursal: se vuelve a la primera.
  const actual = visibles.find((pestana) => pestana.id === elegida) ?? visibles[0]
  const filas = actual.filas(datos, agrupacion)
  const grafico = actual.grafico

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-surface p-5 shadow-sm">
      <ExportarReporte
        datos={datos}
        pestana={actual}
        filas={filas}
        agrupacion={agrupacion}
        contexto={contexto}
        deshabilitado={!descargasHabilitadas}
        obtenerImagenGrafico={() => panel.current?.querySelector('canvas')?.toDataURL('image/png') ?? null}
      />
      <div role="tablist" aria-label="Reportes" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border">
        {visibles.map((pestana) => {
          const seleccionada = pestana.id === actual.id
          return (
            <button
              key={pestana.id}
              id={`pestana-${pestana.id}`}
              type="button"
              role="tab"
              aria-selected={seleccionada}
              aria-controls="panel-reporte"
              onClick={() => setElegida(pestana.id)}
              className={`-mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${seleccionada ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text'}`}
            >
              {pestana.titulo}
            </button>
          )
        })}
      </div>

      <div ref={panel} role="tabpanel" id="panel-reporte" aria-labelledby={`pestana-${actual.id}`} className="flex flex-col gap-5">
        {datos.resumen.cantidadPedidos === 0 ? (
          <p className="text-sm text-muted">No hay pedidos entregados en este período.</p>
        ) : (
          <>
            {grafico?.tipo === 'mapa' && <MapaDemanda demanda={datos.demanda} />}
            {grafico && grafico.tipo !== 'mapa' && (
              <GraficoReporte
                tipo={grafico.tipo}
                etiquetas={filas.map((fila) => String(fila[grafico.etiqueta]))}
                valores={filas.map((fila) => Number(fila[grafico.valor]))}
                nombreSerie={actual.columnas[grafico.valor].titulo}
                formato={actual.columnas[grafico.valor].formato}
              />
            )}
            {grafico?.tipo !== 'mapa' && <TablaReporte columnas={actual.columnas} filas={filas} />}
          </>
        )}
      </div>
    </section>
  )
}
