'use client'

// Pantalla de Reportes (contenedor): filtros, pedido de datos, resumen y pestañas.
// Arranca en "Hoy" y en la sucursal de la barra superior; si esa cambia, se reinicia.

import { useEffect, useRef, useState } from 'react'
import { Search, X } from '@/components/icons'
import { buscarPedidos } from '@/lib/reportes/buscar-pedidos'
import { useSucursalActiva } from '@/components/sucursal/SucursalActiva'
import { Aviso } from '@/components/ui/Aviso'
import { EVENTO_PEDIDOS_ACTUALIZADOS, INTERVALO_ACTUALIZACION_MS } from '@/lib/pedidos/pedidos-pantallas'
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
    let enCurso = false
    let repetir = false
    const consultar = async () => {
      if (!vigente || document.hidden) return
      if (enCurso) {
        repetir = true
        return
      }
      enCurso = true
      try {
        const resultado = await obtenerReportes({ desde, hasta, sucursal, agrupacion })
        if (vigente) setEstado({ clave, resultado, error: null })
      } catch (error: unknown) {
        if (vigente) {
          setEstado((previo) => ({
            clave, resultado: previo.clave === clave ? previo.resultado : null,
            error: error instanceof Error ? error.message : MENSAJES.panel.errorGenerico,
          }))
        }
      } finally {
        enCurso = false
        if (repetir && vigente) {
          repetir = false
          void consultar()
        }
      }
    }
    const actualizar = () => void consultar()
    void consultar()
    const temporizador = setInterval(actualizar, INTERVALO_ACTUALIZACION_MS)
    document.addEventListener('visibilitychange', actualizar)
    window.addEventListener('focus', actualizar)
    window.addEventListener(EVENTO_PEDIDOS_ACTUALIZADOS, actualizar)
    return () => {
      vigente = false
      clearInterval(temporizador)
      document.removeEventListener('visibilitychange', actualizar)
      window.removeEventListener('focus', actualizar)
      window.removeEventListener(EVENTO_PEDIDOS_ACTUALIZADOS, actualizar)
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
        <p className="text-sm text-muted">Ventas de los pedidos pagados, independientemente de su entrega.</p>
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
    { titulo: 'Pedidos pagados', valor: formatear(cantidadPedidos, 'numero') },
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
  const [busqueda, setBusqueda] = useState('')
  const panel = useRef<HTMLDivElement>(null)
  const visibles = PESTANAS.filter((pestana) => !pestana.disponible || pestana.disponible(datos))
  // "Por sucursal" desaparece al elegir una sucursal: se vuelve a la primera.
  const actual = visibles.find((pestana) => pestana.id === elegida) ?? visibles[0]
  const pedidosVisibles = buscarPedidos(datos.pedidos, busqueda)
  const datosVisibles = actual.id === 'pedidos' ? { ...datos, pedidos: pedidosVisibles } : datos
  const busquedaActiva = actual.id === 'pedidos' ? busqueda.trim() : ''
  const contextoDescarga = busquedaActiva ? { ...contexto, busquedaPedidos: busquedaActiva } : contexto
  const filas = actual.filas(datosVisibles, agrupacion)
  const grafico = actual.grafico
  const sinDatos = actual.id === 'pedidos' ? pedidosVisibles.length === 0 : datos.resumen.cantidadPedidos === 0

  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-surface p-5 shadow-sm">
      <div className="flex min-w-0 items-center justify-between gap-3">
        {actual.id === 'pedidos' && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-lg">
              <label className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 focus-within:border-accent">
                <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="sr-only">Buscar pedidos por producto, cliente, empleado, número o sucursal</span>
                <input
                  type="search"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Producto, cliente, empleado o N.º de pedido"
                  aria-describedby="alcance-busqueda-pedidos"
                  className="min-w-0 w-full bg-transparent pr-6 text-sm text-text outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
                />
              </label>
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  aria-label="Limpiar búsqueda"
                  title="Limpiar búsqueda"
                  className="absolute inset-y-0 right-1 my-auto inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            <p role="status" className="sr-only shrink-0 text-xs text-muted sm:not-sr-only">
              {pedidosVisibles.length} de {datos.pedidos.length} pedidos
            </p>
            <p id="alcance-busqueda-pedidos" className="sr-only">La búsqueda filtra el detalle y sus descargas. Los totales corresponden al período completo.</p>
          </div>
        )}
        <div className="ml-auto shrink-0">
          <ExportarReporte
            datos={datosVisibles}
            pestana={actual}
            filas={filas}
            agrupacion={agrupacion}
            contexto={contextoDescarga}
            deshabilitado={!descargasHabilitadas}
            obtenerImagenGrafico={() => panel.current?.querySelector('canvas')?.toDataURL('image/png') ?? null}
          />
        </div>
      </div>
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
        {sinDatos ? (
          <p className="text-sm text-muted">
            {actual.id === 'pedidos'
              ? datos.pedidos.length > 0 ? 'No hay pedidos que coincidan con la búsqueda.' : 'No hay pedidos registrados en este período.'
              : 'No hay pedidos pagados en este período.'}
          </p>
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
            {grafico?.tipo !== 'mapa' && <TablaReporte columnas={actual.columnas} filas={filas} compacta={actual.id === 'pedidos'} centrada={['periodo', 'horario', 'productos', 'pago', 'origen', 'entrega'].includes(actual.id)} />}
          </>
        )}
      </div>
    </section>
  )
}
