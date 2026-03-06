"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ProjectWorkspaceContextValue = {
  headerActions: ReactNode;
  setHeaderActions: (node: ReactNode) => void;
};

const ProjectWorkspaceContext = createContext<ProjectWorkspaceContextValue | null>(null);

export function ProjectWorkspaceProvider({ children }: { children: ReactNode }) {
  const [headerActions, setHeaderActionsState] = useState<ReactNode>(null);
  const setHeaderActions = useCallback((node: ReactNode) => {
    setHeaderActionsState(() => node);
  }, []);

  return (
    <ProjectWorkspaceContext.Provider value={{ headerActions, setHeaderActions }}>
      {children}
    </ProjectWorkspaceContext.Provider>
  );
}

export function useProjectWorkspace(): ProjectWorkspaceContextValue {
  const ctx = useContext(ProjectWorkspaceContext);
  if (!ctx) {
    throw new Error("useProjectWorkspace must be used within ProjectWorkspaceProvider");
  }
  return ctx;
}

export function useProjectWorkspaceOptional(): ProjectWorkspaceContextValue | null {
  return useContext(ProjectWorkspaceContext);
}
