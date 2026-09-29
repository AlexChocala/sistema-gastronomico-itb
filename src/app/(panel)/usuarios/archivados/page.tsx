'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { ArrowLeft, CircleUserRound, RotateCcw, Store } from '@/components/icons'

type UsuarioArchivado = {
  idUsuario: number
  nombre: string
  apellido: string
  email: string
  idRol: number
  rol: { idRol: number; nombre: string }
  idSucursal: number | null
  sucursal: { idSucursal: number; nombre: string } | null
}

type RespuestaUsuarios = {
  usuarios?: UsuarioArchivado[]
  error?: string
}

function nombreSucursal(nombre: string) {
  return nombre.replace('Prueba - ', '')
}

export default function UsuariosArchivadosPage() {
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<UsuarioArchivado[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [rol, setRol] = useState<string | null>(null)
  const [idSucursal, setIdSucursal] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let paginaActiva = true

    async function cargarUsuarios() {
      try {
        const respuesta = await fetch('/api/usuarios?estado=archivados', { cache: 'no-store' })
        if (respuesta.status === 401 || respuesta.status === 403) {
          router.replace('/dashboard')
          return
        }
        if (!respuesta.headers.get('content-type')?.includes('application/json')) {
          throw new Error('El servidor devolvió una respuesta inesperada.')
        }
        const datos = await respuesta.json() as RespuestaUsuarios
        if (!respuesta.ok) throw new Error(datos.error || 'No se pudieron cargar los usuarios archivados.')
        if (paginaActiva) setUsuarios(datos.usuarios ?? [])
      } catch (errorDesconocido) {
        if (paginaActiva) {
          setError(
            errorDesconocido instanceof Error
              ? errorDesconocido.message
              : 'No se pudieron cargar los usuarios archivados.',
          )
        }
      } finally {
        if (paginaActiva) setCargando(false)
      }
    }

    void cargarUsuarios()
    return () => {
      paginaActiva = false
    }
  }, [router])

  const roles = useMemo(
    () => [...new Set(usuarios.map((usuario) => usuario.rol.nombre))].sort(),
    [usuarios],
  )
  const sucursales = useMemo(() => {
    const unicas = new Map<number, string>()
    for (const usuario of usuarios) {
      if (usuario.sucursal) unicas.set(usuario.sucursal.idSucursal, usuario.sucursal.nombre)
    }
    return [...unicas.entries()].map(([id, nombre]) => ({ id, nombre }))
  }, [usuarios])

  const usuariosVisibles = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es')
    return usuarios.filter((usuario) => {
      const coincideTexto = !texto || [
        usuario.nombre,
        usuario.apellido,
        usuario.email,
      ].some((valor) => valor.toLocaleLowerCase('es').includes(texto))
      const coincideRol = rol === null || usuario.rol.nombre === rol
      const coincideSucursal = idSucursal === null || usuario.idSucursal === idSucursal
      return coincideTexto && coincideRol && coincideSucursal
    })
  }, [busqueda, idSucursal, rol, usuarios])

  async function reactivar(usuario: UsuarioArchivado) {
    setError('')
    setMensaje('')
    const respuesta = await fetch(`/api/usuarios/${usuario.idUsuario}`, { method: 'PATCH' })
    if (!respuesta.headers.get('content-type')?.includes('application/json')) {
      setError('El servidor devolvió una respuesta inesperada.')
      return
    }
    const datos = await respuesta.json() as { error?: string }
    if (!respuesta.ok) {
      setError(datos.error || 'No se pudo reactivar el usuario.')
      return
    }
    setUsuarios((actuales) => actuales.filter((actual) => actual.idUsuario !== usuario.idUsuario))
    setMensaje(`${usuario.nombre} ${usuario.apellido} fue reactivado.`)
  }

  return (
    <main className="flex w-full flex-col gap-6 p-6" lang="es">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Usuarios archivados</h1>
          <p className="mt-1 text-sm text-muted">
            Consultá o reactivá cuentas que ya no están trabajando.
          </p>
        </div>
        <Button
          type="button"
          variant="secundario"
          className="flex w-auto! items-center gap-2 rounded-full!"
          onClick={() => router.push('/usuarios')}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a usuarios
        </Button>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <Card className="max-w-none! rounded-3xl! border-0! shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Buscar y filtrar</h2>
              <p className="text-sm text-muted">Encontrá una cuenta por sus datos.</p>
            </div>

            <Input
              id="buscar-usuario-archivado"
              label="Buscar usuario"
              className="rounded-full! px-4! py-2.5! text-sm focus:border-accent!"
              placeholder="Nombre, apellido o email"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />

            <div>
              <p className="mb-2 text-sm text-muted">Rol</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className={`w-auto! rounded-full! ${
                    rol === null ? 'bg-accent! text-on-accent! hover:bg-accent-hover!' : ''
                  }`}
                  variant={rol === null ? 'primario' : 'secundario'}
                  onClick={() => setRol(null)}
                >
                  Todos
                </Button>
                {roles.map((nombre) => (
                  <Button
                    key={nombre}
                    type="button"
                    className={`w-auto! rounded-full! capitalize ${
                      rol === nombre ? 'bg-accent! text-on-accent! hover:bg-accent-hover!' : ''
                    }`}
                    variant={rol === nombre ? 'primario' : 'secundario'}
                    onClick={() => setRol(nombre)}
                  >
                    {nombre}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-muted">Sucursal</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className={`w-auto! rounded-full! ${
                    idSucursal === null
                      ? 'bg-accent! text-on-accent! hover:bg-accent-hover!'
                      : ''
                  }`}
                  variant={idSucursal === null ? 'primario' : 'secundario'}
                  onClick={() => setIdSucursal(null)}
                >
                  Todas
                </Button>
                {sucursales.map((sucursal) => (
                  <Button
                    key={sucursal.id}
                    type="button"
                    className={`w-auto! rounded-full! ${
                      idSucursal === sucursal.id
                        ? 'bg-accent! text-on-accent! hover:bg-accent-hover!'
                        : ''
                    }`}
                    variant={idSucursal === sucursal.id ? 'primario' : 'secundario'}
                    onClick={() => setIdSucursal(sucursal.id)}
                  >
                    {nombreSucursal(sucursal.nombre)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex max-w-none! flex-col justify-between rounded-3xl! border-0! bg-accent! text-on-accent! shadow-sm">
          <div className="flex items-start justify-between">
            <p>Usuarios archivados</p>
            <span className="rounded-full bg-surface/20 p-2">
              <CircleUserRound size={20} aria-hidden="true" />
            </span>
          </div>
          <div>
            <p className="text-4xl font-semibold">{usuarios.length}</p>
            <p className="mt-2 text-sm">Cuentas fuera del equipo activo</p>
          </div>
        </Card>
      </section>

      {mensaje && (
        <p className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success">{mensaje}</p>
      )}
      {error && (
        <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {cargando && (
        <Card className="max-w-none! rounded-3xl! border-0! shadow-sm">
          <p className="text-muted">Cargando usuarios archivados...</p>
        </Card>
      )}

      {!cargando && !error && (
        <Card className="max-w-none! overflow-hidden rounded-3xl! border-0! p-0! shadow-sm">
          <div className="flex flex-col gap-1 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Cuentas archivadas</h2>
              <p className="text-sm text-muted">
                {usuariosVisibles.length} usuario(s) encontrado(s)
              </p>
            </div>
            {(busqueda || rol !== null || idSucursal !== null) && (
              <Button
                type="button"
                variant="secundario"
                className="mt-3 flex w-auto! items-center gap-2 rounded-full! sm:mt-0"
                onClick={() => {
                  setBusqueda('')
                  setRol(null)
                  setIdSucursal(null)
                }}
              >
                <RotateCcw size={16} aria-hidden="true" />
                Limpiar filtros
              </Button>
            )}
          </div>

          {usuariosVisibles.length === 0 ? (
            <div className="m-5 rounded-2xl bg-bg p-8 text-center text-muted">
              No hay usuarios que coincidan con los filtros.
            </div>
          ) : (
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full min-w-2xl text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    <th className="border-b border-border px-3 py-3 font-medium">Usuario</th>
                    <th className="border-b border-border px-3 py-3 font-medium">Rol</th>
                    <th className="border-b border-border px-3 py-3 font-medium">Sucursal</th>
                    <th className="border-b border-border px-3 py-3 text-right font-medium">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosVisibles.map((usuario) => (
                    <tr key={usuario.idUsuario} className="transition-colors hover:bg-bg/60">
                      <td className="border-b border-border px-3 py-4">
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-accent-soft p-2 text-accent">
                            <CircleUserRound size={20} aria-hidden="true" />
                          </span>
                          <div>
                            <p className="font-medium">
                              {usuario.nombre} {usuario.apellido}
                            </p>
                            <p className="text-sm text-muted">{usuario.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-border px-3 py-4">
                        <span className="rounded-full bg-bg px-3 py-1 capitalize">
                          {usuario.rol.nombre}
                        </span>
                      </td>
                      <td className="border-b border-border px-3 py-4">
                        <span className="flex items-center gap-2">
                          <Store size={16} className="text-accent" aria-hidden="true" />
                          {usuario.sucursal
                            ? nombreSucursal(usuario.sucursal.nombre)
                            : 'Sin sucursal'}
                        </span>
                      </td>
                      <td className="border-b border-border px-3 py-4 text-right">
                        <Button
                          type="button"
                          className="ml-auto flex w-auto! items-center gap-2 rounded-full! bg-accent! text-on-accent! hover:bg-accent-hover!"
                          onClick={() => void reactivar(usuario)}
                        >
                          <RotateCcw size={16} aria-hidden="true" />
                          Reactivar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </main>
  )
}
