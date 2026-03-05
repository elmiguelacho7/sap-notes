"use client";

import { useEffect, useRef, useCallback } from "react";

export type GanttGroup = { id: string; content: string; order?: number };

export type GanttItem = {
  id: string;
  group?: string;
  content: string;
  start: string | Date;
  end?: string | Date;
  title?: string;
  className?: string;
  type?: "phase" | "activity" | "task";
  refId?: string;
};

function toVisDate(d: string | Date): Date {
  if (d instanceof Date) return d;
  const s = String(d).trim();
  if (!s) return new Date();
  return new Date(s.includes("T") ? s : s + "T00:00:00");
}

export default function ProjectGantt({
  groups,
  items,
  onItemClick,
}: {
  groups: GanttGroup[];
  items: GanttItem[];
  onItemClick?: (item: GanttItem) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<any>(null);
  const itemsRef = useRef<GanttItem[]>([]);

  const buildAndMount = useCallback(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    const containerEl = containerRef.current;
    if (timelineRef.current) {
      timelineRef.current.destroy();
      timelineRef.current = null;
    }

    import("vis-timeline/standalone").then((vis) => {
      const { DataSet, Timeline } = vis;

      if (!containerRef.current) return;

      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }

      containerRef.current.innerHTML = "";

      const groupsDs = new DataSet(
        groups.map((g) => ({
          id: g.id,
          content: g.content,
          order: g.order ?? 0,
        }))
      );

      const visItems = items.map((it) => {
        const start = toVisDate(it.start);
        const end = it.end != null ? toVisDate(it.end) : undefined;
        const visItem: Record<string, unknown> = {
          id: it.id,
          content: it.content,
          start,
          group: it.group,
          title: it.title ?? it.content,
          className: it.className ?? "",
        };
        if (end != null && end.getTime() !== start.getTime()) {
          visItem.end = end;
        }
        return visItem;
      });

      const itemsDs = new DataSet(visItems);
      itemsRef.current = items;

      const zoomMin = 1000 * 60 * 60 * 24 * 3;
      const zoomMax = 1000 * 60 * 60 * 24 * 365 * 2;

      const options = {
        stack: true,
        orientation: "top" as const,
        margin: { item: 14, axis: 8 },
        zoomMin,
        zoomMax,
        horizontalScroll: true,
        zoomKey: "ctrlKey" as const,
        zoomable: true,
        showCurrentTime: true,
        selectable: true,
        multiselect: false,
        moveable: false,
        tooltip: { followMouse: true },
        groupOrder: (a: { order?: number }, b: { order?: number }) =>
          (a.order ?? 0) - (b.order ?? 0),
      };

      const timeline = new Timeline(containerEl, itemsDs as any, groupsDs as any, options);

      if (onItemClick) {
        timeline.on("select", (props: { items: string[] }) => {
          const id = props.items?.[0];
          if (!id) return;
          const item = itemsRef.current.find((i) => i.id === id);
          if (item) onItemClick(item);
        });
      }

      const dates = items
        .flatMap((i) => [i.start, i.end].filter(Boolean))
        .map((d) => toVisDate(d as string | Date).getTime());
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        timeline.setWindow(minDate, maxDate, { animation: true });
      } else {
        timeline.fit();
      }

      timelineRef.current = timeline;
    });
  }, [groups, items, onItemClick]);

  useEffect(() => {
    buildAndMount();
    return () => {
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }
      itemsRef.current = [];
    };
  }, [buildAndMount]);

  return (
    <div className="h-full w-full min-h-0 overflow-hidden rounded-2xl">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
