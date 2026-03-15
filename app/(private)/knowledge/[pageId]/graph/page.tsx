"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from "reactflow";
import { supabase } from "@/lib/supabaseClient";
import { getPageGraph } from "@/lib/knowledgeGraphService";
import type { PageGraph } from "@/lib/knowledgeGraphService";

const CENTER_X = 400;
const CENTER_Y = 300;
const RADIUS = 220;

function layoutNodes(graph: PageGraph, centerPageId: string): Node[] {
  const center = graph.nodes.find((n) => n.id === centerPageId);
  const others = graph.nodes.filter((n) => n.id !== centerPageId);
  const nodes: Node[] = [];

  if (center) {
    nodes.push({
      id: center.id,
      position: { x: CENTER_X, y: CENTER_Y },
      data: { label: center.title || center.id },
      type: "default",
    });
  }

  if (others.length === 0) return nodes;

  for (let i = 0; i < others.length; i++) {
    const n = others[i];
    const angle = (2 * Math.PI * i) / others.length;
    const x = CENTER_X + RADIUS * Math.cos(angle);
    const y = CENTER_Y + RADIUS * Math.sin(angle);
    nodes.push({
      id: n.id,
      position: { x, y },
      data: { label: n.title || n.id },
      type: "default",
    });
  }

  return nodes;
}

function toReactFlowEdges(graph: PageGraph): Edge[] {
  return graph.edges.map((e, i) => ({
    id: `e-${e.from_page_id}-${e.to_page_id}-${i}`,
    source: e.from_page_id,
    target: e.to_page_id,
  }));
}

export default function KnowledgeGraphPage() {
  const params = useParams<{ pageId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageId = params?.pageId as string | undefined;
  const projectIdFromQuery = searchParams?.get("projectId") ?? null;
  const pageEditorHref = `/knowledge/${pageId}${projectIdFromQuery ? `?projectId=${projectIdFromQuery}` : ""}`;

  const [graph, setGraph] = useState<PageGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pageId) return;
    setLoading(true);
    setError(null);
    getPageGraph(supabase, pageId)
      .then(setGraph)
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load graph");
        setGraph({ nodes: [], edges: [] });
      })
      .finally(() => setLoading(false));
  }, [pageId]);

  const nodes = useMemo(
    () => (pageId ? layoutNodes(graph, pageId) : []),
    [graph, pageId]
  );
  const edges = useMemo(() => toReactFlowEdges(graph), [graph]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      router.push(`/knowledge/${node.id}${projectIdFromQuery ? `?projectId=${projectIdFromQuery}` : ""}`);
    },
    [router, projectIdFromQuery]
  );

  if (!pageId) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-sm text-slate-600">Invalid page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-sm text-slate-500">Loading graph…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
        <Link
          href={pageEditorHref}
          className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to page
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <Link
          href={pageEditorHref}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to page
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">Knowledge graph</h1>
      </div>

      <div className="flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {nodes.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            No linked pages. Add links from the page to see the graph.
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodeClick={onNodeClick}
            fitView
            minZoom={0.3}
            maxZoom={1.6}
          >
            <Background gap={16} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
