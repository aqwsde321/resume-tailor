"use client";

import { useEffect, useRef } from "react";

export function usePdfWorkspaceDock(enabled: boolean) {
  const workspaceRef = useRef<HTMLElement | null>(null);
  const autoDockedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      autoDockedRef.current = false;
      return;
    }

    const syncDockState = () => {
      const workspace = workspaceRef.current;
      if (!workspace || window.innerWidth <= 1100) {
        autoDockedRef.current = false;
        return;
      }

      if (workspace.getBoundingClientRect().top > 320) {
        autoDockedRef.current = false;
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (window.innerWidth <= 1100 || event.deltaY <= 0 || autoDockedRef.current) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".pdf-editor-pane, .pdf-preview-pane, .pdf-workspace-footer")
      ) {
        return;
      }

      const workspace = workspaceRef.current;
      if (!workspace) {
        return;
      }

      const rect = workspace.getBoundingClientRect();
      const snapBand = 260;

      if (rect.top <= snapBand && rect.top > 18) {
        autoDockedRef.current = true;
        event.preventDefault();
        window.scrollTo({
          top: window.scrollY + rect.top - 18,
          behavior: "smooth"
        });
      }
    };

    window.addEventListener("scroll", syncDockState, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("scroll", syncDockState);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [enabled]);

  return workspaceRef;
}
