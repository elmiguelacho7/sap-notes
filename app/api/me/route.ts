import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserIdFromRequest } from "@/lib/auth/serverAuth";
import { hasGlobalPermission } from "@/lib/auth/permissions";
import { checkQuota } from "@/lib/auth/quota";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * GET /api/me
 * Returns the current user's app_role and permission flags for UI consistency with backend enforcement.
 * Authorization: Bearer token or cookies.
 * Returns 200 with { appRole: string | null, permissions?: { manageGlobalNotes: boolean } }.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        {
          appRole: null,
          permissions: {
            manageGlobalNotes: false,
            createProject: false,
            manageClients: false,
            useGlobalAI: false,
            manageKnowledgeSources: false,
          },
          projectsQuota: null,
          clientsQuota: null,
        },
        { status: 200 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("app_role")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          appRole: null,
          permissions: {
            manageGlobalNotes: false,
            createProject: false,
            manageClients: false,
            useGlobalAI: false,
            manageKnowledgeSources: false,
          },
          projectsQuota: null,
          clientsQuota: null,
        },
        { status: 200 }
      );
    }

    const appRole = (data as { app_role: string | null }).app_role ?? null;
    const manageGlobalNotes = await hasGlobalPermission(userId, "manage_global_notes");
    const createProject = await hasGlobalPermission(userId, "create_project");
    const manageClients = await hasGlobalPermission(userId, "manage_clients");
    const useGlobalAI = await hasGlobalPermission(userId, "use_global_ai");
    const manageKnowledgeSources = await hasGlobalPermission(userId, "manage_knowledge_sources");

    let projectsQuota: { atLimit: boolean; current: number; limit: number | null } | null = null;
    if (createProject) {
      const q = await checkQuota(userId, "max_projects_created");
      projectsQuota = { atLimit: !q.allowed, current: q.current, limit: q.limit };
    }

    let clientsQuota: { atLimit: boolean; current: number; limit: number | null } | null = null;
    if (manageClients) {
      const q = await checkQuota(userId, "max_clients_created");
      clientsQuota = { atLimit: !q.allowed, current: q.current, limit: q.limit };
    }

    return NextResponse.json({
      appRole,
      permissions: { manageGlobalNotes, createProject, manageClients, useGlobalAI, manageKnowledgeSources },
      projectsQuota,
      clientsQuota,
    });
  } catch (err) {
    console.error("api/me GET error", err);
    return NextResponse.json(
      {
        appRole: null,
        permissions: {
          manageGlobalNotes: false,
          createProject: false,
          manageClients: false,
          useGlobalAI: false,
          manageKnowledgeSources: false,
        },
        projectsQuota: null,
        clientsQuota: null,
      },
      { status: 200 }
    );
  }
}
