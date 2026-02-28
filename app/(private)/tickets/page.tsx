"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError, hasLoggableSupabaseError } from "@/lib/supabaseError";
import TicketsFilters from "@/components/tickets/TicketsFilters";
import TicketsTable from "@/components/tickets/TicketsTable";
import type {
  Ticket,
  TicketWithRelations,
  TicketsFilterState,
  ClientOption,
  ProjectOption,
  ProfileOption,
} from "@/components/tickets/ticketTypes";

const DEFAULT_FILTERS: TicketsFilterState = {
  status: "",
  priority: "",
  clientId: "",
  projectId: "",
  assigneeId: "",
  searchText: "",
};

export default function TicketsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<TicketsFilterState>(DEFAULT_FILTERS);
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  const loadFilterOptions = useCallback(async () => {
    const [clientsRes, projectsRes, profilesRes] = await Promise.all([
      supabase.from("clients").select("id, name").order("name", { ascending: true }),
      supabase.from("projects").select("id, name").order("name", { ascending: true }),
      supabase.from("profiles").select("id, full_name").order("full_name", { ascending: true }),
    ]);

    if (clientsRes.error && hasLoggableSupabaseError(clientsRes.error)) {
      handleSupabaseError("tickets clients", clientsRes.error);
    }
    if (projectsRes.error && hasLoggableSupabaseError(projectsRes.error)) {
      handleSupabaseError("tickets projects", projectsRes.error);
    }
    if (profilesRes.error && hasLoggableSupabaseError(profilesRes.error)) {
      handleSupabaseError("tickets profiles", profilesRes.error);
    }

    setClients((clientsRes.data ?? []) as ClientOption[]);
    setProjects((projectsRes.data ?? []) as ProjectOption[]);
    setProfiles((profilesRes.data ?? []) as ProfileOption[]);
  }, []);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    let query = supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.priority) query = query.eq("priority", filters.priority);
    if (filters.clientId) query = query.eq("client_id", filters.clientId);
    if (filters.projectId) query = query.eq("project_id", filters.projectId);
    if (filters.assigneeId) query = query.eq("assigned_to", filters.assigneeId);

    const searchTrim = filters.searchText.trim();
    if (searchTrim) {
      query = query.or(
        `title.ilike.%${searchTrim}%,error_code.ilike.%${searchTrim}%`
      );
    }

    const { data: ticketsData, error } = await query;

    if (error) {
      handleSupabaseError("tickets", error);
      setErrorMsg("Part of the project data could not be loaded. Please try again later.");
      setTickets([]);
    } else {
      const list = (ticketsData ?? []) as Ticket[];
      const withRelations: TicketWithRelations[] = list.map((t) => ({
        ...t,
        client_name: null,
        project_name: null,
        assignee_name: null,
      }));
      setTickets(withRelations);
    }

    setLoading(false);
  }, [filters]);

  useEffect(() => {
    void loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const resolveNames = useCallback(
    (list: TicketWithRelations[]): TicketWithRelations[] => {
      return list.map((t) => ({
        ...t,
        client_name: t.client_id
          ? clients.find((c) => c.id === t.client_id)?.name ?? null
          : null,
        project_name: t.project_id
          ? projects.find((p) => p.id === t.project_id)?.name ?? null
          : null,
        assignee_name: t.assigned_to
          ? profiles.find((p) => p.id === t.assigned_to)?.full_name ?? null
          : null,
      }));
    },
    [clients, projects, profiles]
  );

  const ticketsWithNames = resolveNames(tickets);

  return (
    <div className="max-w-6xl mx-auto px-6 py-7 space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tickets</h1>
          <p className="text-sm text-slate-600 max-w-xl">
            Centralized tracking of incidents and requests.
          </p>
        </div>
        <button
          onClick={() => router.push("/tickets/new")}
          className="self-start bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Nuevo ticket
        </button>
      </div>

      {errorMsg && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <TicketsFilters
        filters={filters}
        onFiltersChange={setFilters}
        clients={clients}
        projects={projects}
        profiles={profiles}
      />

      <TicketsTable
        tickets={ticketsWithNames}
        loading={loading}
        onRowClick={(id) => router.push(`/tickets/${id}`)}
      />
    </div>
  );
}
