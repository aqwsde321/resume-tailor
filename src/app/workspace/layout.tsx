import type { ReactNode } from "react";
import { WorkspaceProvider } from "@/features/workspace/context";
import { WorkspaceShell } from "@/features/workspace/ui/workspace-shell";
import "@/features/workspace/workspace.css";
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceProvider><WorkspaceShell>{children}</WorkspaceShell></WorkspaceProvider>;
}
