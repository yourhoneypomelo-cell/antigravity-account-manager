import * as React from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  id?: string;
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      id,
      value = "",
      onChange,
      placeholder = "YYYY-MM-DD",
      disabled = false,
      className,
      "aria-label": ariaLabel,
    },
    ref
  ) => {
    const hiddenDateInputRef = React.useRef<HTMLInputElement>(null);
    const currentValue = value || "";

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/[./]/g, "-");
      onChange(val);
    };

    const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    };

    const handleCalendarClick = () => {
      if (disabled) return;
      try {
        if (
          hiddenDateInputRef.current &&
          typeof hiddenDateInputRef.current.showPicker === "function"
        ) {
          hiddenDateInputRef.current.showPicker();
        } else {
          hiddenDateInputRef.current?.click();
        }
      } catch {
        hiddenDateInputRef.current?.click();
      }
    };

    return (
      <div className={cn("relative flex items-center w-full", className)}>
        <input
          ref={ref}
          id={id}
          type="text"
          value={currentValue}
          onChange={handleTextChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "vault-field pr-9 font-mono-numbers text-[13px] tracking-tight",
            disabled && "cursor-not-allowed opacity-50"
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={handleCalendarClick}
          aria-label="选择日期"
          title="选择日期"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Calendar className="w-4 h-4" />
        </button>
        <input
          ref={hiddenDateInputRef}
          type="date"
          value={/^\d{4}-\d{2}-\d{2}$/.test(currentValue) ? currentValue : ""}
          onChange={handleNativeDateChange}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only pointer-events-none"
        />
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";
