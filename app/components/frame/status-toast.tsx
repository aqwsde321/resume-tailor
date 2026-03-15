"use client";

interface StatusToastProps {
  tone: "error" | "success";
  value: string;
}

export function StatusToast({ tone, value }: StatusToastProps) {
  return (
    <div className="toast-stack" aria-live={tone === "error" ? "assertive" : "polite"}>
      <p className={`status toast ${tone}`} role={tone === "error" ? "alert" : "status"}>
        {value}
      </p>
    </div>
  );
}
