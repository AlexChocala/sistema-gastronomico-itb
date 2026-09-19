// src/app/(panel)/usuarios/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

interface Usuario {
  idUsuario: number
  nombre: string
  apellido: string
  email: string
  username: string
  activo: boolean
  idRol: number
  rol: { idRol: number; nombre: string }
  idSucursal: number | null
  sucursal: { idSucursal: number; nombre: string } | null
}

interface Rol {
  idRol: number
  nombre: string
}

interface Sucursal {
  idSucursal: number
  nombre: string
}

const formVacio = {
  nombre: '',
  apellido: '',
  email: '',
  username: '',
  idRol: '',
  idSucursal: '',
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [passwordGenerada, setPasswordGenerada] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState(formVacio)

  async function cargarDatos() {
    setLoading(true)
    const res = await fetch('/api/usuarios')
    const data = await res.json()
    setUsuarios(data.usuarios ?? [])
    setRoles(data.roles ?? [])
    setSucursales(data.sucursales ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function abrirNuevo() {
    setEditandoId(null)
    setForm(formVacio)
    setError('')
    setMostrarForm(true)
  }

  function abrirEditar(u: Usuario) {
    setEditandoId(u.idUsuario)
    setForm({
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      username: u.username,
      idRol: String(u.idRol),
      idSucursal: u.idSucursal ? String(u.idSucursal) : '',
    })
    setError('')
    setMostrarForm(true)
  }

  function cerrarForm() {
    setMostrarForm(false)
    setEditandoId(null)
    setForm(formVacio)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const esEdicion = editandoId !== null
    const url = esEdicion ? `/api/usuarios/${editandoId}` : '/api/usuarios'
    const method = esEdicion ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        idRol: Number(form.idRol),
        idSucursal: Number(form.idSucursal),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al guardar el usuario')
      return
    }

    if (!esEdicion && data.passwordGenerada) {
      setPasswordGenerada(data.passwordGenerada)
    }
    cerrarForm()
    cargarDatos()
  }

  async function toggleActivo(u: Usuario) {
    setError('')
    const method = u.activo ? 'DELETE' : 'PATCH'
    const res = await fetch(`/api/usuarios/${u.idUsuario}`, { method })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'No se pudo cambiar el estado del usuario')
      return
    }
    cargarDatos()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Button className="w-auto" onClick={mostrarForm ? cerrarForm : abrirNuevo}>
          {mostrarForm ? 'Cancelar' : 'Nuevo usuario'}
        </Button>
      </div>

      {mostrarForm && (
        <Card className="max-w-none mb-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input id="nombre" name="nombre" label="Nombre" value={form.nombre} onChange={handleChange} required />
              <Input id="apellido" name="apellido" label="Apellido" value={form.apellido} onChange={handleChange} required />
              <Input id="email" name="email" type="email" label="Email" value={form.email} onChange={handleChange} required />
              <Input id="username" name="username" label="Username" value={form.username} onChange={handleChange} required />

              <div className="flex flex-col gap-1">
                <label htmlFor="idRol" className="text-sm font-medium text-neutral-700">Rol</label>
                <select
                  id="idRol"
                  name="idRol"
                  value={form.idRol}
                  onChange={handleChange}
                  required
                  className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-neutral-900"
                >
                  <option value="" disabled hidden>Seleccionar rol</option>
                  {roles.map((r) => (
                    <option key={r.idRol} value={r.idRol}>{r.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="idSucursal" className="text-sm font-medium text-neutral-700">Sucursal</label>
                <select
                  id="idSucursal"
                  name="idSucursal"
                  value={form.idSucursal}
                  onChange={handleChange}
                  required
                  className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900 outline-none focus:border-neutral-900"
                >
                  <option value="" disabled hidden>Seleccionar sucursal</option>
                  {sucursales.map((s) => (
                    <option key={s.idSucursal} value={s.idSucursal}>{s.nombre.replace('Prueba - ', '')}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit">{editandoId !== null ? 'Guardar cambios' : 'Crear usuario'}</Button>
          </form>
        </Card>
      )}

      {passwordGenerada && (
        <Card className="max-w-none mb-6 bg-yellow-50 border-yellow-400">
          <p>
            Usuario creado. Contraseña generada: <strong>{passwordGenerada}</strong>
          </p>
          <Button variant="secundario" className="w-auto mt-3" onClick={() => setPasswordGenerada(null)}>
            Cerrar
          </Button>
        </Card>
      )}

      {error && !mostrarForm && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Nombre</th>
              <th className="p-2">Email</th>
              <th className="p-2">Username</th>
              <th className="p-2">Rol</th>
              <th className="p-2">Sucursal</th>
              <th className="p-2">Activo</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.idUsuario} className="border-b">
                <td className="p-2">{u.nombre} {u.apellido}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.username}</td>
                <td className="p-2">{u.rol.nombre}</td>
                <td className="p-2">{u.sucursal ? u.sucursal.nombre.replace('Prueba - ', '') : '-'}</td>
                <td className="p-2">{u.activo ? 'Sí' : 'No'}</td>
                <td className="p-2 flex gap-2">
                  <Button variant="secundario" className="w-auto text-xs px-2 py-1" onClick={() => abrirEditar(u)}>
                    Editar
                  </Button>
                  <Button variant="secundario" className="w-auto text-xs px-2 py-1" onClick={() => toggleActivo(u)}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}