"use client";

import { ProjectTasksSummary } from "./ProjectTasksSummary";
import { ProjectTicketsSummary } from "./ProjectTicketsSummary";
import { ProjectKnowledgeSummary } from "./ProjectKnowledgeSummary";
import { ProjectActivityFeed } from "./ProjectActivityFeed";
import type { ActivityItem } from "./ProjectActivityFeed";

export type ProjectOverviewGridProps = {
  projectId: string;
  /** Tasks */
  tasksOverdue: number;
  tasksInProgress: number;
  tasksLoading?: boolean;
  /** Tickets */
  ticketsOpen: number;
  ticketsUrgent: number;
  ticketsLoading?: boolean;
  /** Knowledge */
  knowledgeSpaces: number;
  knowledgePages: number;
  knowledgeLoading?: boolean;
  /** Activity feed (last 10) */
  activityItems: ActivityItem[];
  activityLoading?: boolean;
};

export function ProjectOverviewGrid({
  projectId,
  tasksOverdue,
  tasksInProgress,
  tasksLoading = false,
  ticketsOpen,
  ticketsUrgent,
  ticketsLoading = false,
  knowledgeSpaces,
  knowledgePages,
  knowledgeLoading = false,
  activityItems,
  activityLoading = false,
}: ProjectOverviewGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <ProjectTasksSummary
        projectId={projectId}
        overdue={tasksOverdue}
        inProgress={tasksInProgress}
        loading={tasksLoading}
      />
      <ProjectTicketsSummary
        projectId={projectId}
        open={ticketsOpen}
        urgent={ticketsUrgent}
        loading={ticketsLoading}
      />
      <ProjectKnowledgeSummary
        projectId={projectId}
        spaces={knowledgeSpaces}
        pages={knowledgePages}
        loading={knowledgeLoading}
      />
      <ProjectActivityFeed
        items={activityItems}
        loading={activityLoading}
      />
    </div>
  );
}
