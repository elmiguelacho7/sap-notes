"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export type ClientOption = { id: string; name: string };

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function ClientSelector({
  value,
  onChange,
  disabled,
  placeholder = "Buscar cliente…",
}: {
  value: string;
  onChange: (clientId: string | null, clientName: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCompany, setCreateCompany] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/clients", { headers });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray((data as { clients?: ClientOption[] }).clients)) {
        setClients((data as { clients: ClientOption[] }).clients);
      } else {
        setClients([]);
      }
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = search.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : clients;
  const selectedClient = value ? clients.find((c) => c.id === value) : null;
  const displayValue = selectedClient ? selectedClient.name : "";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrim = createName.trim();
    if (!nameTrim) {
      setCreateError("El nombre es obligatorio.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const headers = await getAuthHeaders();
      headers["Content-Type"] = "application/json";
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: nameTrim,
          display_name: createCompany.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError((data as { error?: string }).error ?? "No se pudo crear el cliente.");
        return;
      }
      const newClient = (data as { client?: ClientOption }).client;
      if (newClient) {
        setClients((prev) => [...prev, newClient]);
        onChange(newClient.id, newClient.name);
      }
      setCreateModalOpen(false);
      setCreateName("");
      setCreateCompany("");
      setOpen(false);
    } catch {
      setCreateError("Error de conexión.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          readOnly
          placeholder={placeholder}
          value={displayValue}
          disabled={disabled}
          onFocus={() => !disabled && setOpen(true)}
          onClick={() => !disabled && setOpen(true)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-0 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</span>
      </div>
      {open && !disabled && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              placeholder="Buscar por nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-3 text-sm text-slate-500">Cargando…</div>
            ) : (
              <>
                {value && (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 border-b border-slate-100"
                    onClick={() => {
                      onChange(null, null);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    Ninguno
                  </button>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-slate-50"
                    onClick={() => {
                      onChange(c.id, c.name);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    {c.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 border-t border-slate-100"
                  onClick={() => {
                    setSearch("");
                    setCreateModalOpen(true);
                  }}
                >
                  + Crear nuevo cliente
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900">Crear cliente</h3>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Empresa (opcional)</label>
                <input
                  type="text"
                  value={createCompany}
                  onChange={(e) => setCreateCompany(e.target.value)}
                  placeholder="Empresa"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateName("");
                    setCreateCompany("");
                    setCreateError(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {creating ? "Creando…" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
