"use client";

import { useParams } from "next/navigation";
import { TestScriptWorkspace } from "@/components/testing/TestScriptWorkspace";

export default function ProjectTestScriptDetailPage() {
  const params = useParams<{ id: string; scriptId: string }>();
  const projectId = (params?.id ?? "") as string;
  const scriptId = (params?.scriptId ?? "") as string;

  if (!projectId || !scriptId) {
    return null;
  }

  return <TestScriptWorkspace projectId={projectId} scriptId={scriptId} />;
}
