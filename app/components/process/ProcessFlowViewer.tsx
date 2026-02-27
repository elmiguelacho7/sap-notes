// app/components/process/ProcessFlowViewer.tsx
"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from "reactflow";

type StandardApp = {
  code: string;
  type: string;
  description?: string;
  url?: string;
};

type CustomizationPoint = {
  img_path: string;
  table?: string;
  note?: string;
};

type DiagramJson = {
  nodes: Node[];
  edges: Edge[];
};

type Props = {
  title: string;
  description?: string;
  diagramJson: DiagramJson;
  standardApps?: StandardApp[];
  customizationPoints?: CustomizationPoint[];
};

export function ProcessFlowViewer({
  title,
  description,
  diagramJson,
  standardApps = [],
  customizationPoints = [],
}: Props) {
  const nodes = useMemo(() => diagramJson.nodes ?? [], [diagramJson]);
  const edges = useMemo(() => diagramJson.edges ?? [], [diagramJson]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Diagrama */}
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="h-[450px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              minZoom={0.3}
              maxZoom={1.6}
            >
              <Background gap={16} />
              <MiniMap pannable zoomable />
              <Controls />
            </ReactFlow>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="flex flex-col gap-6">
          {/* Apps */}
          <div className="rounded-xl border bg-white shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Apps / Transacciones estándar
            </h3>

            {standardApps.length > 0 ? (
              <div className="space-y-3">
                {standardApps.map((app, i) => (
                  <div key={i} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">
                        {app.code}
                      </p>
                      <span className="text-[11px] uppercase text-slate-500">
                        {app.type}
                      </span>
                    </div>
                    {app.description && (
                      <p className="mt-1 text-xs text-slate-500">
                        {app.description}
                      </p>
                    )}
                    {app.url && (
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-xs font-medium text-blue-700 hover:underline"
                      >
                        Ver documentación
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No hay apps registradas todavía.
              </p>
            )}
          </div>

          {/* Customizing */}
          <div className="rounded-xl border bg-white shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Puntos de Customizing
            </h3>

            {customizationPoints.length > 0 ? (
              <div className="space-y-3">
                {customizationPoints.map((cp, i) => (
                  <div key={i} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-mono text-slate-600">
                      {cp.img_path}
                    </p>
                    {cp.table && (
                      <p className="mt-1 text-xs text-slate-700">
                        <span className="font-semibold">Tabla:</span>{" "}
                        {cp.table}
                      </p>
                    )}
                    {cp.note && (
                      <p className="mt-1 text-xs text-slate-500">{cp.note}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No hay puntos de customizing definidos todavía.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}