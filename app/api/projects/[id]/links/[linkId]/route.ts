import { NextResponse } from "next/server";
import {
  updateProjectLink,
  deleteProjectLink,
  ProjectNotFoundError,
} from "@/lib/services/projectService";

type RouteParams = { params: Promise<{ id: string; linkId: string }> };

type PatchBody = {
  name?: unknown;
  url?: unknown;
  link_type?: unknown;
};

export async function PATCH(
  req: Request,
  { params }: RouteParams
) {
  try {
    const { id: projectId, linkId } = await params;

    if (!projectId || !linkId) {
      return NextResponse.json(
        { error: "Project ID and link ID are required" },
        { status: 400 }
      );
    }

    let body: PatchBody;
    try {
      body = (await req.json()) as PatchBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const url = typeof body.url === "string" ? body.url.trim() : undefined;
    const link_type =
      body.link_type === null || body.link_type === ""
        ? null
        : typeof body.link_type === "string"
          ? body.link_type.trim() || null
          : undefined;

    if (url !== undefined && url !== "" && !url.toLowerCase().startsWith("http")) {
      return NextResponse.json(
        { error: "url must start with http or https" },
        { status: 400 }
      );
    }

    const link = await updateProjectLink(projectId, linkId, {
      ...(name !== undefined && { name }),
      ...(url !== undefined && { url }),
      ...(link_type !== undefined && { link_type }),
    });

    return NextResponse.json(link);
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    console.error("projects/[id]/links/[linkId] PATCH error", err);
    return NextResponse.json(
      { error: "Failed to update link" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const { id: projectId, linkId } = await params;

    if (!projectId || !linkId) {
      return NextResponse.json(
        { error: "Project ID and link ID are required" },
        { status: 400 }
      );
    }

    await deleteProjectLink(projectId, linkId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ProjectNotFoundError) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    console.error("projects/[id]/links/[linkId] DELETE error", err);
    return NextResponse.json(
      { error: "Failed to delete link" },
      { status: 500 }
    );
  }
}
