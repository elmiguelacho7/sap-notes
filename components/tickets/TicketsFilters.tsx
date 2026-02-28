"use client";

import type { TicketsFilterState, ClientOption, ProjectOption, ProfileOption } from "./ticketTypes";
import {
  TICKET_STATUS_OPTIONS,
  TICKET_PRIORITY_OPTIONS,
} from "./ticketTypes";

type TicketsFiltersProps = {
  filters: TicketsFilterState;
  onFiltersChange: (f: TicketsFilterState) => void;
  clients: ClientOption[];
  projects: ProjectOption[];
  profiles: ProfileOption[];
};

export default function TicketsFilters({
  filters,
  onFiltersChange,
  clients,
  projects,
  profiles,
}: TicketsFiltersProps) {
  const update = (key: keyof TicketsFilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Filtros</p>
        <p className="text-xs text-slate-500">
          Filtra por estado, prioridad, cliente, proyecto o asignado.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Estado
          </label>
          <select
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {TICKET_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Prioridad
          </label>
          <select
            value={filters.priority}
            onChange={(e) => update("priority", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {TICKET_PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Cliente
          </label>
          <select
            value={filters.clientId}
            onChange={(e) => update("clientId", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Todos</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Proyecto
          </label>
          <select
            value={filters.projectId}
            onChange={(e) => update("projectId", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Todos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Asignado a
          </label>
          <select
            value={filters.assigneeId}
            onChange={(e) => update("assigneeId", e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Todos</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Buscar (título / código error)
          </label>
          <input
            type="text"
            value={filters.searchText}
            onChange={(e) => update("searchText", e.target.value)}
            placeholder="Texto..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
