import { createContext, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"

type WorkspaceMode = "business" | "platform"

interface WorkspaceContextValue {
  mode: WorkspaceMode
  setMode: (mode: WorkspaceMode) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

const STORAGE_KEY = "appoint-saas-workspace-mode"

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<WorkspaceMode>("business")

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as WorkspaceMode | null
    if (stored === "business" || stored === "platform") {
      setModeState(stored)
    }
  }, [])

  function setMode(next: WorkspaceMode) {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return (
    <WorkspaceContext.Provider value={{ mode, setMode }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider")
  return ctx
}

