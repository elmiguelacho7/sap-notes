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
  /** Project Copilot: open dock with optional prefilled message (sent when chat mounts) */
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  copilotPendingMessage: string;
  setCopilotPendingMessage: (msg: string) => void;
  openProjectCopilotWithMessage: (message: string) => void;
};

const ProjectWorkspaceContext = createContext<ProjectWorkspaceContextValue | null>(null);

export function ProjectWorkspaceProvider({ children }: { children: ReactNode }) {
  const [headerActions, setHeaderActionsState] = useState<ReactNode>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotPendingMessage, setCopilotPendingMessage] = useState("");

  const setHeaderActions = useCallback((node: ReactNode) => {
    setHeaderActionsState(() => node);
  }, []);

  const openProjectCopilotWithMessage = useCallback((message: string) => {
    setCopilotPendingMessage(message.trim());
    setCopilotOpen(true);
  }, []);

  return (
    <ProjectWorkspaceContext.Provider
      value={{
        headerActions,
        setHeaderActions,
        copilotOpen,
        setCopilotOpen,
        copilotPendingMessage,
        setCopilotPendingMessage,
        openProjectCopilotWithMessage,
      }}
    >
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
