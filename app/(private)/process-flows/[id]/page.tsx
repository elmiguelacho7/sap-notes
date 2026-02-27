// app/(private)/process-flows/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { ProcessFlowViewer } from "../../../components/process/ProcessFlowViewer";

export default function ProcessFlowPage() {
  const params = useParams();
  const flowId = (params?.id as string) || "demo";

  const demoDiagram = {
    nodes: [
      {
        id: "1",
        position: { x: 0, y: 0 },
        data: { label: "Sales Order\n(Create Sales Orders)" },
        type: "default",
      },
      {
        id: "2",
        position: { x: 250, y: 0 },
        data: { label: "Delivery\n(Create Outbound Deliveries)" },
        type: "default",
      },
      {
        id: "3",
        position: { x: 500, y: 0 },
        data: { label: "Post Goods Issue" },
        type: "default",
      },
      {
        id: "4",
        position: { x: 750, y: 0 },
        data: { label: "Billing\n(Create Billing Documents)" },
        type: "default",
      },
    ],
    edges: [
      { id: "e1-2", source: "1", target: "2", label: "Delivery creation" },
      { id: "e2-3", source: "2", target: "3", label: "Goods issue" },
      { id: "e3-4", source: "3", target: "4", label: "Invoice" },
    ],
  };

  const demoApps = [
    {
      code: "Create Sales Orders",
      type: "Fiori",
      description: "Create sales orders as part of scope item 1MX.",
    },
    {
      code: "Create Outbound Deliveries",
      type: "Fiori",
      description: "Create deliveries from sales orders.",
    },
  ];

  const demoCustomizing = [
    {
      img_path:
        "SPRO → Sales and Distribution → Sales → Sales Documents → Sales Document Header",
      table: "TVAK",
      note: "Check document type configuration and number ranges.",
    },
    {
      img_path:
        "SPRO → Enterprise Structure → Assignment → Sales and Distribution → Assign plant to sales org",
      note: "Confirm plant assignment for new company codes.",
    },
  ];

  return (
    <div className="px-6 py-6">
      <ProcessFlowViewer
        title={`Process Flow: ${flowId}`}
        description="Flujo estándar Order-to-Cash basado en Best Practices SAP."
        diagramJson={demoDiagram}
        standardApps={demoApps}
        customizationPoints={demoCustomizing}
      />
    </div>
  );
}