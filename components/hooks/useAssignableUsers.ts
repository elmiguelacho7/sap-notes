"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AssigneeProfile } from "@/components/AssigneeCell";

export type AssignableUserOption = {
  id: string;
  label: string;
};

export type UseAssignableUsersParams = {
  contextType: "global" | "project";
  projectId?: string | null;
};

export type UseAssignableUsersResult = {
  users: AssignableUserOption[];
  profilesMap: Map<string, AssigneeProfile>;
  loading: boolean;
  error: string | null;
};

/**
 * Unified source of assignable users ("Responsable") for global and project contexts.
 *
 * - Project context: returns project members (project_members → profiles)
 * - Global context: returns active profiles
 */
export function useAssignableUsers({
  contextType,
  projectId,
}: UseAssignableUsersParams): UseAssignableUsersResult {
  const [users, setUsers] = useState<AssignableUserOption[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, AssigneeProfile>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (contextType === "project") {
        if (!projectId) {
          setUsers([]);
          setProfilesMap(new Map());
          return;
        }
        const { data: members, error: membersError } = await supabase
          .from("project_members")
          .select("profile_id, user_id")
          .eq("project_id", projectId);
        if (membersError) {
          setError("No se pudieron cargar los miembros del proyecto.");
          setUsers([]);
          setProfilesMap(new Map());
          return;
        }
        const profileIds = (members ?? [])
          .map((r: { profile_id?: string | null; user_id?: string | null }) => r.profile_id ?? r.user_id)
          .filter((id): id is string => id != null && id !== "");
        if (profileIds.length === 0) {
          setUsers([]);
          setProfilesMap(new Map());
          return;
        }
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds);
        if (profilesError) {
          setError("No se pudieron cargar los perfiles del proyecto.");
          setUsers([]);
          setProfilesMap(new Map());
          return;
        }
        const map = new Map<string, AssigneeProfile>();
        const opts: AssignableUserOption[] = (profiles ?? []).map((p) => {
          const profile = p as AssigneeProfile;
          map.set(profile.id, profile);
          return {
            id: profile.id,
            label: profile.full_name || profile.email || profile.id,
          };
        });
        setProfilesMap(map);
        setUsers(opts);
        return;
      }

      // Global context: all active profiles (can be refined later with roles/permissions).
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true);
      if (profilesError) {
        setError("No se pudieron cargar los usuarios.");
        setUsers([]);
        setProfilesMap(new Map());
        return;
      }
      const map = new Map<string, AssigneeProfile>();
      const opts: AssignableUserOption[] = (profiles ?? []).map((p) => {
        const profile = p as AssigneeProfile;
        map.set(profile.id, profile);
        return {
          id: profile.id,
          label: profile.full_name || profile.email || profile.id,
        };
      });
      setProfilesMap(map);
      setUsers(opts);
    } finally {
      setLoading(false);
    }
  }, [contextType, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { users, profilesMap, loading, error };
}

