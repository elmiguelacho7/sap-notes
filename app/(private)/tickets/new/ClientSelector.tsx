"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export type ClientOption = { id: string; name: string };

const triggerClass =
  "w-full cursor-pointer rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2.5 pr-10 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:border-[rgb(var(--rb-brand-primary))]/35 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35 disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-[rgb(var(--rb-surface))]/95";

const innerInputClass =
  "w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3 py-2 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:border-[rgb(var(--rb-brand-primary))]/35 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35";

const labelClass = "mb-1.5 block text-xs font-medium text-[rgb(var(--rb-text-secondary))]";

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
  placeholder = "Search client…",
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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const nameTrim = createName.trim();
    if (!nameTrim) {
      setCreateError("Name is required.");
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
        setCreateError((data as { error?: string }).error ?? "Could not create client.");
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
      setCreateError("Connection error.");
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
          className={triggerClass}
          aria-expanded={open}
          aria-haspopup="listbox"
        />
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--rb-text-muted))]"
          aria-hidden
        />
      </div>
      {open && !disabled && (
        <div
          className="absolute z-50 mt-1.5 flex max-h-60 w-full flex-col overflow-hidden rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] shadow-lg"
          role="listbox"
        >
          <div className="border-b border-[rgb(var(--rb-surface-border))]/60 p-2">
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={innerInputClass}
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgb(var(--rb-surface-border))_transparent]">
            {loading ? (
              <div className="p-3 text-sm text-[rgb(var(--rb-text-muted))]">Loading…</div>
            ) : (
              <>
                {value && (
                  <button
                    type="button"
                    className="w-full border-b border-[rgb(var(--rb-surface-border))]/60 px-3 py-2.5 text-left text-sm text-[rgb(var(--rb-text-muted))] transition-colors hover:bg-[rgb(var(--rb-surface))]/80 hover:text-[rgb(var(--rb-text-primary))]"
                    onClick={() => {
                      onChange(null, null);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    None
                  </button>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full px-3 py-2.5 text-left text-sm text-[rgb(var(--rb-text-primary))] transition-colors hover:bg-[rgb(var(--rb-surface))]/80"
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
                  className="w-full border-t border-[rgb(var(--rb-surface-border))]/60 px-3 py-2.5 text-left text-sm font-medium text-[rgb(var(--rb-brand-primary))] transition-colors hover:bg-[rgb(var(--rb-brand-primary))]/8"
                  onClick={() => {
                    setSearch("");
                    setCreateModalOpen(true);
                  }}
                >
                  + Create new client
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {createModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-6 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-modal-title"
          >
            <h3 id="client-modal-title" className="text-lg font-semibold text-[rgb(var(--rb-text-primary))]">
              Create client
            </h3>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className={labelClass}>Name *</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Client name"
                  className={innerInputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Company (optional)</label>
                <input
                  type="text"
                  value={createCompany}
                  onChange={(e) => setCreateCompany(e.target.value)}
                  placeholder="Company"
                  className={innerInputClass}
                />
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setCreateName("");
                    setCreateCompany("");
                    setCreateError(null);
                  }}
                  className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-primary))] transition-colors hover:bg-[rgb(var(--rb-surface))]/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
