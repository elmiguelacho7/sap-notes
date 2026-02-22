'use client'

import { useEffect, useMemo, useState, FormEvent } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

type Module = {
  id: string
  code: string
  name: string
}

type ScopeItem = {
  id: string
  code: string
  name: string
  module_id: string | null
}

export default function NewProjectPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [modules, setModules] = useState<Module[]>([])
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([])

  // Campos formulario
  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [environmentType, setEnvironmentType] =
    useState<'on_premise' | 'cloud_public'>('on_premise')
  const [sapVersion, setSapVersion] = useState('')
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [selectedScopeItems, setSelectedScopeItems] = useState<string[]>([])

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Cargar módulos + scope items
  useEffect(() => {
    const loadData = async () => {
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .order('code', { ascending: true })

      if (!modulesError && modulesData) {
        setModules(modulesData as Module[])
      }

      const { data: scopeData, error: scopeError } = await supabase
        .from('scope_items')
        .select('*')
        .order('code', { ascending: true })

      if (!scopeError && scopeData) {
        setScopeItems(scopeData as ScopeItem[])
      }
    }

    loadData()
  }, [])

  // Scope items filtrados por módulos seleccionados
  const filteredScopeItems = useMemo(() => {
    if (selectedModules.length === 0) return []
    return scopeItems.filter(
      (si) => si.module_id && selectedModules.includes(si.module_id)
    )
  }, [scopeItems, selectedModules])

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) => {
      const exists = prev.includes(moduleId)
      const next = exists
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]

      // Limpiar scope items que ya no pertenecen a los módulos seleccionados
      setSelectedScopeItems((prevScope) =>
        prevScope.filter((scopeId) => {
          const si = scopeItems.find((s) => s.id === scopeId)
          return si?.module_id && next.includes(si.module_id)
        })
      )

      return next
    })
  }

  const toggleScopeItem = (scopeId: string) => {
    setSelectedScopeItems((prev) =>
      prev.includes(scopeId)
        ? prev.filter((id) => id !== scopeId)
        : [...prev, scopeId]
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!clientName.trim() || !projectName.trim()) {
      setErrorMessage('Cliente y nombre del proyecto son obligatorios.')
      return
    }

    setLoading(true)

    try {
      // 🔐 Usuario autenticado (para created_by / RLS)
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw new Error('No se pudo obtener el usuario.')
      const userId = userData.user?.id
      if (!userId) throw new Error('Usuario no autenticado.')

      // 🧱 1) Crear cliente
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert([
          {
            name: clientName.trim(),
            created_by: userId,
          },
        ])
        .select()
        .single()

      if (clientError || !client) {
        console.error(clientError)
        throw new Error('No se pudo crear el cliente.')
      }

      // 🧱 2) Crear proyecto
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            client_id: client.id,
            name: projectName.trim(),
            description: description.trim() || null,
            environment_type: environmentType,
            sap_version: sapVersion.trim() || null,
            created_by: userId,
          },
        ])
        .select()
        .single()

      if (projectError || !project) {
        console.error(projectError)
        throw new Error('No se pudo crear el proyecto.')
      }

      // 🧱 3) Módulos
      if (selectedModules.length > 0) {
        const modulesToInsert = selectedModules.map((moduleId) => ({
          project_id: project.id,
          module_id: moduleId,
        }))

        const { error: pmError } = await supabase
          .from('project_modules')
          .insert(modulesToInsert)

        if (pmError) {
          console.error(pmError)
          throw new Error('No se pudieron guardar los módulos del proyecto.')
        }
      }

      // 🧱 4) Scope items (solo Cloud)
      if (
        environmentType === 'cloud_public' &&
        selectedScopeItems.length > 0
      ) {
        const scopeToInsert = selectedScopeItems.map((scopeId) => ({
          project_id: project.id,
          scope_item_id: scopeId,
        }))

        const { error: psiError } = await supabase
          .from('project_scope_items')
          .insert(scopeToInsert)

        if (psiError) {
          console.error(psiError)
          throw new Error('No se pudieron guardar los scope items.')
        }
      }

      setSuccessMessage('Proyecto creado correctamente ✅')

      // 👉 Redirigir a la ficha del proyecto
      router.push(`/projects/${project.id}`)
    } catch (err: any) {
      console.error(err)
      setErrorMessage(err.message || 'Error al crear el proyecto.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-2 mb-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            Nuevo proyecto SAP
          </h1>
          <p className="text-sm text-slate-500">
            Registra el cliente, el entorno (On Prem / Cloud), los módulos y
            los scope items que formarán parte de tu implementación.
          </p>
        </header>

        {/* Mensajes */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        {/* Card principal */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-8"
        >
          {/* Datos generales */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Datos generales del proyecto
              </h2>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                PASO 1 DE 3
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Cliente
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Ej. Sauleda, Lecta, Eurotronic..."
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Más adelante podrás seleccionar clientes existentes. Por
                  ahora, se creará uno nuevo.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nombre del proyecto
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Ej. Rollout motores Eurotronic en Sauleda"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Descripción
              </label>
              <textarea
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                rows={3}
                placeholder="Describe el alcance funcional, plantas, sociedades, flujos intercompany, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Entorno
                </label>
                <div className="flex flex-wrap gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => setEnvironmentType('on_premise')}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
                      environmentType === 'on_premise'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        environmentType === 'on_premise'
                          ? 'bg-blue-600'
                          : 'bg-slate-300'
                      }`}
                    />
                    On Premise
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnvironmentType('cloud_public')}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
                      environmentType === 'cloud_public'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        environmentType === 'cloud_public'
                          ? 'bg-blue-600'
                          : 'bg-slate-300'
                      }`}
                    />
                    S/4HANA Cloud Public Edition
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Esto te permitirá guiar después por módulos y scope items
                  específicos.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Versión SAP
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Ej. S/4HANA 2023, Cloud 2402..."
                  value={sapVersion}
                  onChange={(e) => setSapVersion(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Módulos */}
          <section className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Módulos del proyecto
              </h2>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                PASO 2 DE 3
              </span>
            </div>

            {modules.length === 0 ? (
              <p className="text-sm text-slate-400">
                No hay módulos configurados en la tabla{' '}
                <code className="font-mono text-xs">modules</code>.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {modules.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModule(m.id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                      selectedModules.includes(m.id)
                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-400 hover:text-blue-700'
                    }`}
                  >
                    <span className="font-semibold">{m.code}</span>
                    <span className="hidden sm:inline">{m.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Scope items (solo Cloud) */}
          {environmentType === 'cloud_public' && (
            <section className="space-y-4 border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Scope items (Cloud)
                </h2>
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  PASO 3 DE 3
                </span>
              </div>

              {selectedModules.length === 0 && (
                <p className="text-sm text-slate-400">
                  Selecciona primero uno o más módulos para ver los scope items
                  relacionados.
                </p>
              )}

              {selectedModules.length > 0 &&
                filteredScopeItems.length === 0 && (
                  <p className="text-sm text-slate-400">
                    No hay scope items configurados aún para los módulos
                    seleccionados.
                  </p>
                )}

              {filteredScopeItems.length > 0 && (
                <div className="max-h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  {filteredScopeItems.map((si) => (
                    <label
                      key={si.id}
                      className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopeItems.includes(si.id)}
                        onChange={() => toggleScopeItem(si.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {si.code}
                      </span>
                      <span className="text-slate-800">{si.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Botón enviar */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Guardando proyecto…' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}