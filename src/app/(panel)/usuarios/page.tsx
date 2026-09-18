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
  idSucursal: number | null
}

interface Sucursal {
  idSucursal: number
  nombre: string
  activa: boolean
}

const ROLES = [
  { idRol: 1, nombre: 'admin' },
  { idRol: 2, nombre: 'supervisor' },
  { idRol: 3, nombre: 'empleado' },
]

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [passwordGenerada, setPasswordGenerada] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    username: '',
    idRol: '',
    idSucursal: '',
  })

  async function cargarDatos() {
    setLoading(true)
    const [resUsuarios, resSucursales] = await Promise.all([
      fetch('/api/usuarios'),
      fetch('/api/sucursales'),
    ])
    setUsuarios(await resUsuarios.json())
    setSucursales(await resSucursales.json())
    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        idRol: Number(form.idRol),
        idSucursal: Number(form.idSucursal),
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al crear el usuario')
      return
    }

    setPasswordGenerada(data.passwordGenerada)
    setForm({ nombre: '', apellido: '', email: '', username: '', idRol: '', idSucursal: '' })
    setMostrarForm(false)
    cargarDatos()
  }

  function nombreRol(idRol: number) {
    return ROLES.find((r) => r.idRol === idRol)?.nombre ?? idRol
  }

  function nombreSucursal(idSucursal: number | null) {
    if (!idSucursal) return '-'
    const nombre = sucursales.find((s) => s.idSucursal === idSucursal)?.nombre
    return nombre?.replace('Prueba - ', '') ?? idSucursal
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <Button className="w-auto" onClick={() => setMostrarForm(!mostrarForm)}>
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
                  {ROLES.map((r) => (
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
            <Button type="submit">Crear usuario</Button>
          </form>
        </Card>
      )}

      {passwordGenerada && (
        <Card className="max-w-none mb-6 bg-yellow-50 border-yellow-400">
          <p>
            Usuario creado. Contrase├▒a generada: <strong>{passwordGenerada}</strong>
          </p>
          <Button variant="secundario" className="w-auto mt-3" onClick={() => setPasswordGenerada(null)}>
            Cerrar
          </Button>
        </Card>
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
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.idUsuario} className="border-b">
                <td className="p-2">{u.nombre} {u.apellido}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.username}</td>
                <td className="p-2">{nombreRol(u.idRol)}</td>
                <td className="p-2">{nombreSucursal(u.idSucursal)}</td>
                           <td className="p-2">{u.activo ? 'Sí' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
