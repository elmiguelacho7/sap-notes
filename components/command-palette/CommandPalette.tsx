"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  Ticket,
  ListTodo,
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  BookOpen,
  Link as LinkIcon,
  Brain,
  Users,
  FolderKanban,
  AlertCircle,
} from "lucide-react";
import { getRecentItems, addToRecent, type RecentItem } from "./recentStore";

type CommandGroup = "create" | "navigation" | "recent";

type Command = {
  id: string;
  label: string;
  group: CommandGroup;
  href: string;
  keywords: string[];
  icon?: React.ReactNode;
};

function buildCommands(projectId: string | null, recent: RecentItem[]): Command[] {
  const create: Command[] = [
    {
      id: "new-ticket",
      label: "New ticket",
      group: "create" as const,
      href: projectId ? `/projects/${projectId}/tickets/new` : "/tickets/new",
      keywords: ["ticket", "new", "crear", "nuevo"],
      icon: <Ticket className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
    },
    {
      id: "new-activity",
      label: "New activity",
      group: "create" as const,
      href: projectId ? `/projects/${projectId}/planning` : "",
      keywords: ["activity", "actividad", "new", "planning"],
      icon: <ListTodo className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
    },
    {
      id: "new-note",
      label: "New note",
      group: "create" as const,
      href: "/notes/new",
      keywords: ["note", "nota", "new", "crear"],
      icon: <FileText className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
    },
  ].filter((c) => c.href);

  const nav: Command[] = [
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      group: "navigation" as const,
      href: "/dashboard",
      keywords: ["dashboard", "home", "inicio"],
      icon: <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
    },
    {
      id: "nav-projects",
      label: "Go to Projects",
      group: "navigation" as const,
      href: "/projects",
      keywords: ["projects", "proyectos", "list"],
      icon: <FolderKanban className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
    },
    ...(projectId
      ? [
          {
            id: "nav-planning",
            label: "Go to Planning",
            group: "navigation" as const,
            href: `/projects/${projectId}/planning`,
            keywords: ["planning", "planificación", "calendar"],
            icon: <CalendarDays className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
          },
          {
            id: "nav-activities",
            label: "Go to Activities",
            group: "navigation" as const,
            href: `/projects/${projectId}/planning/activities`,
            keywords: ["activities", "actividades"],
            icon: <ListTodo className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
          },
          {
            id: "nav-tasks",
            label: "Go to Tasks",
            group: "navigation" as const,
            href: `/projects/${projectId}/tasks`,
            keywords: ["tasks", "tareas"],
            icon: <CheckSquare className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
          },
          {
            id: "nav-notes",
            label: "Go to Notes",
            group: "navigation" as const,
            href: `/projects/${projectId}/notes`,
            keywords: ["notes", "notas"],
            icon: <FileText className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
          },
          {
            id: "nav-brain",
            label: "Go to Brain",
            group: "navigation" as const,
            href: `/projects/${projectId}/brain`,
            keywords: ["brain", "sapito"],
            icon: <Brain className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
          },
          {
            id: "nav-links",
            label: "Go to Links",
            group: "navigation" as const,
            href: `/projects/${projectId}/links`,
            keywords: ["links", "enlaces"],
            icon: <LinkIcon className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
          },
          {
            id: "nav-knowledge",
            label: "Go to Knowledge",
            group: "navigation" as const,
            href: `/projects/${projectId}/knowledge`,
            keywords: ["knowledge", "conocimiento"],
            icon: <BookOpen className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
          },
          {
            id: "nav-tickets",
            label: "Go to Tickets",
            group: "navigation" as const,
            href: `/projects/${projectId}/tickets`,
            keywords: ["tickets", "incidencias"],
            icon: <AlertCircle className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
          },
          {
            id: "nav-members",
            label: "Go to Team",
            group: "navigation" as const,
            href: `/projects/${projectId}/members`,
            keywords: ["team", "equipo", "members"],
            icon: <Users className="h-4 w-4 shrink-0 text-slate-400 mr-2" />,
          },
        ]
      : []),
  ];

  const recentCommands: Command[] = recent.map((r) => ({
    id: `recent-${r.type}-${r.id}`,
    label: r.title || (r.type === "note" ? "Note" : "Ticket"),
    group: "recent" as const,
    href: r.href,
    keywords: [r.title, r.type],
    icon:
      r.type === "note" ? (
        <FileText className="h-4 w-4 shrink-0 text-slate-500" />
      ) : (
        <Ticket className="h-4 w-4 shrink-0 text-slate-500" />
      ),
  }));

  return [...create, ...nav, ...recentCommands];
}

function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter((c) => {
    if (c.label.toLowerCase().includes(q)) return true;
    return c.keywords.some((k) => k.toLowerCase().includes(q));
  });
}

const GROUP_LABELS: Record<CommandGroup, string> = {
  create: "Create",
  navigation: "Navigation",
  recent: "Recent",
};

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const projectId = useMemo(() => {
    if (!pathname || !pathname.startsWith("/projects/")) return null;
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] === "projects" && segments[1] && segments[1] !== "new")
      return segments[1];
    return null;
  }, [pathname]);

  const recentItems = useMemo(() => getRecentItems(), [open]);
  const allCommands = useMemo(
    () => buildCommands(projectId, recentItems),
    [projectId, recentItems]
  );
  const filtered = useMemo(
    () => filterCommands(allCommands, query),
    [allCommands, query]
  );

  const flatIndexToCommand = useMemo(() => {
    const map: Map<number, Command> = new Map();
    let i = 0;
    for (const c of filtered) map.set(i++, c);
    return map;
  }, [filtered]);

  const highlightedCommand = flatIndexToCommand.get(highlightIndex) ?? null;

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setHighlightIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) =>
          filtered.length ? (i - 1 + filtered.length) % filtered.length : 0
        );
        return;
      }
      if (e.key === "Enter" && highlightedCommand) {
        e.preventDefault();
        executeCommand(highlightedCommand);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, filtered.length, highlightedCommand, closePalette]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  useEffect(() => {
    if (highlightedCommand && listRef.current) {
      const el = listRef.current.querySelector(
        `[data-command-id="${highlightedCommand.id}"]`
      );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [highlightedCommand]);

  function executeCommand(cmd: Command) {
    const recent = recentItems.find(
      (r) => r.href === cmd.href || cmd.id.startsWith(`recent-${r.type}-${r.id}`)
    );
    if (recent) {
      addToRecent(recent);
    } else if (cmd.group === "recent") {
      const r = recentItems.find(
        (r) => `recent-${r.type}-${r.id}` === cmd.id
      );
      if (r) addToRecent(r);
    } else {
      const noteMatch = cmd.href.match(/^\/notes\/([^/]+)$/);
      const ticketMatch = cmd.href.match(/^\/tickets\/([^/]+)$/);
      if (noteMatch)
        addToRecent({
          type: "note",
          id: noteMatch[1],
          title: cmd.label,
          href: cmd.href,
        });
      if (ticketMatch)
        addToRecent({
          type: "ticket",
          id: ticketMatch[1],
          title: cmd.label,
          href: cmd.href,
        });
    }
    router.push(cmd.href);
    closePalette();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/50"
      onClick={closePalette}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-[640px] rounded-2xl border border-slate-700/60 bg-slate-900 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") closePalette();
        }}
      >
        <div className="border-b border-slate-700/50 px-4 py-3">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search or run a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-0"
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            aria-activedescendant={
              highlightedCommand
                ? `command-${highlightedCommand.id}`
                : undefined
            }
          />
        </div>
        <div
          id="command-palette-list"
          ref={listRef}
          className="max-h-[min(60vh,400px)] overflow-y-auto py-2"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No commands match &quot;{query}&quot;
            </div>
          ) : (
            <>
              {(["create", "navigation", "recent"] as const).map((group) => {
                const inGroup = filtered.filter((c) => c.group === group);
                if (inGroup.length === 0) return null;
                return (
                  <div key={group} className="mb-2">
                    <div className="px-4 py-1.5 text-xs uppercase text-slate-400 tracking-wide">
                      {GROUP_LABELS[group]}
                    </div>
                    {inGroup.map((cmd) => {
                      const isHighlighted = highlightedCommand?.id === cmd.id;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          data-command-id={cmd.id}
                          id={`command-${cmd.id}`}
                          role="option"
                          aria-selected={isHighlighted}
                          onClick={() => executeCommand(cmd)}
                          onMouseEnter={() => {
                            const idx = filtered.indexOf(cmd);
                            if (idx >= 0) setHighlightIndex(idx);
                          }}
                          className={`w-full flex items-center px-4 py-2.5 text-left text-sm rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-inset ${
                            isHighlighted
                              ? "bg-indigo-500/20 border border-indigo-500/30 text-slate-100"
                              : "text-slate-300 hover:bg-slate-800/50"
                          }`}
                        >
                          {cmd.icon}
                          <span className="truncate">{cmd.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
