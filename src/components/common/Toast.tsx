import React from "react";
import { CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";

interface ToastProps {
  toast: { message: string; type?: "info" | "success" | "warning" | "error" } | null;
}

export function Toast({ toast }: ToastProps) {
  if (!toast) return null;

  const icons = {
    info: <Info className="w-4 h-4 text-blue-500" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-500" />,
    error: <XCircle className="w-4 h-4 text-rose-500" />,
  };

  const type = toast.type || "info";

  return (
    <div role={type === "error" ? "alert" : "status"} className="fixed bottom-16 right-6 z-[80] pointer-events-none max-w-[min(420px,calc(100vw-32px))]">
      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-border-subtle bg-popover text-popover-foreground shadow-sm text-[13px] font-normal"
      >
        {icons[type]}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
