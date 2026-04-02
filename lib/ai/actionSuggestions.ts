/**
 * Phase 6: Actionable copilot — structured suggestions only (no auto-execution).
 */

export type SapitoAction = {
  type: string;
  label: string;
  payload?: Record<string, any>;
};

export type ActionSuggestionContext = {
  mode: "global" | "project";
  responseMode?: string | null;
  groundingType: string;
  sapTaxonomy?: { domains: string[]; themes: string[] } | null;
  sourceLabelsUsed: string[];
  confidenceLevel: "high" | "medium" | "low";
  projectId?: string | null;
};

const EXPLORE_THEMES = new Set(["pricing", "atp", "aatp", "idoc"]);

function hasConnectedSources(sourceLabelsUsed: string[]): boolean {
  return sourceLabelsUsed.some(
    (s) =>
      s === "connected_documents_project" ||
      s === "connected_documents_global" ||
      s === "connected_documents"
  );
}

function projectPath(projectId: string, segment: string): string {
  return `/projects/${projectId}/${segment}`;
}

function pushUnique(actions: SapitoAction[], next: SapitoAction) {
  if (!actions.some((a) => a.type === next.type)) actions.push(next);
}

function firstExploreTopic(themes: string[]): string | null {
  for (const t of themes) {
    if (EXPLORE_THEMES.has(t)) return t;
  }
  return null;
}

function exploreMessage(topic?: string | null): string {
  if (topic && topic.trim()) {
    return `Deep dive on SAP ${topic.replace(/_/g, " ")}: key customizing objects, integration points, and common pitfalls.`;
  }
  return "Give a structured overview of this SAP topic: configuration checkpoints, common issues, and what to verify in the system.";
}

/**
 * Deterministic action chips from Sapito context (intent, grounding, taxonomy, sources).
 */
export function getActionSuggestions(ctx: ActionSuggestionContext): SapitoAction[] {
  const actions: SapitoAction[] = [];
  const pid = ctx.projectId?.trim() || null;
  const isProject = ctx.mode === "project" && !!pid;
  const rm = ctx.responseMode ?? "";
  const themes = ctx.sapTaxonomy?.themes ?? [];
  const domains = ctx.sapTaxonomy?.domains ?? [];

  // 1) Project + project_intelligence_mode
  if (isProject && rm === "project_intelligence_mode") {
    pushUnique(actions, {
      type: "open_project_notes",
      label: "Open project notes",
      payload: { path: projectPath(pid!, "notes") },
    });
    pushUnique(actions, {
      type: "open_project_tickets",
      label: "Open project tickets",
      payload: { path: projectPath(pid!, "tickets") },
    });
    pushUnique(actions, {
      type: "open_project_tasks",
      label: "Open project tasks",
      payload: { path: projectPath(pid!, "tasks") },
    });
    pushUnique(actions, {
      type: "open_project_docs",
      label: "Open project docs",
      payload: { path: projectPath(pid!, "knowledge") },
    });
  }

  // 2) Connected documentation grounding
  if (
    ctx.groundingType === "connected_docs" ||
    (ctx.groundingType === "mixed" && hasConnectedSources(ctx.sourceLabelsUsed))
  ) {
    if (isProject) {
      pushUnique(actions, {
        type: "open_connected_docs",
        label: "Open connected docs",
        payload: { path: projectPath(pid!, "knowledge") },
      });
    } else {
      pushUnique(actions, {
        type: "open_connected_docs",
        label: "Open knowledge & sources",
        payload: { path: "/knowledge/documents" },
      });
    }
    pushUnique(actions, {
      type: "summarize_connected_docs",
      label: "Summarize connected docs",
      payload: {
        message:
          "Summarize the connected documentation most relevant to this topic and list the key sources.",
      },
    });
  }

  // 3) Troubleshooting mode
  if (rm === "troubleshooting_mode") {
    if (isProject) {
      pushUnique(actions, {
        type: "open_project_tickets",
        label: "Open project tickets",
        payload: { path: projectPath(pid!, "tickets") },
      });
    }
    const topic = firstExploreTopic(themes) ?? domains[0] ?? null;
    pushUnique(actions, {
      type: "explore_sap_topic",
      label: "Explore SAP topic",
      payload: { message: exploreMessage(topic), topic: topic ?? undefined },
    });
  }

  // Global process / configuration explanations
  if (ctx.mode === "global" && rm === "process_explanation_mode") {
    pushUnique(actions, {
      type: "review_configuration",
      label: "Review configuration",
      payload: {
        message:
          "What should I review in IMG/SPRO configuration for this topic, step by step?",
      },
    });
    pushUnique(actions, {
      type: "view_best_practices",
      label: "View best practices",
      payload: {
        message: "What are SAP best practices and common pitfalls for this area?",
      },
    });
  }

  // 4) Decision support mode
  if (rm === "decision_support_mode") {
    pushUnique(actions, {
      type: "compare_alternatives",
      label: "Compare alternatives",
      payload: {
        message:
          "Compare the main standard SAP alternatives for this scenario: pros, cons, and when to choose each.",
      },
    });
    if (isProject) {
      pushUnique(actions, {
        type: "open_project_decisions",
        label: "Open project decisions",
        payload: { path: projectPath(pid!, "brain") },
      });
    }
  }

  // 5) Low confidence — capture evidence / open docs
  if (ctx.confidenceLevel === "low") {
    if (isProject) {
      pushUnique(actions, {
        type: "create_note",
        label: "Capture in a note",
        payload: { path: `/notes/new?projectId=${encodeURIComponent(pid!)}` },
      });
      pushUnique(actions, {
        type: "open_project_docs",
        label: "Open project docs",
        payload: { path: projectPath(pid!, "knowledge") },
      });
    } else {
      pushUnique(actions, {
        type: "create_note",
        label: "Capture in a note",
        payload: { path: "/notes/new" },
      });
    }
  }

  // 6) Taxonomy-driven SAP exploration (pricing / ATP / IDoc, etc.)
  const taxTopic = firstExploreTopic(themes);
  if (taxTopic && rm !== "troubleshooting_mode") {
    pushUnique(actions, {
      type: "explore_sap_topic",
      label: `Explore ${taxTopic.replace(/_/g, " ")}`,
      payload: { message: exploreMessage(taxTopic), topic: taxTopic },
    });
  }

  return actions.slice(0, 8);
}
