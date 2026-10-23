import React, { useRef, useState, useEffect, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedFieldProps<T extends string> {
  value: T;
  onChange: (val: T) => void;
  options: SegmentOption<T>[];
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-label"?: string;
}

function getSegmentVariant(val: string): "unfilled" | "off" | "on" | "default" {
  if (val === "未填写" || val === "未记录" || val === "未设置") return "unfilled";
  if (val === "关闭" || val === "无") return "off";
  if (val === "开启" || val === "有") return "on";
  return "default";
}

export function SegmentedField<T extends string>({
  value,
  onChange,
  options,
  className = "",
  disabled = false,
  readOnly = false,
  "aria-label": ariaLabel,
}: SegmentedFieldProps<T>) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pointerPressRef = useRef<{ index: number | null; cancelled: boolean }>({ index: null, cancelled: false });
  const [isMounted, setIsMounted] = useState(false);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pressedIndex, setPressedIndex] = useState<number | null>(null);

  const selectedIndex = options.findIndex((opt) => opt.value === value);

  // Skip sliding animation on initial mount so indicator appears instantly
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setIsMounted(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (disabled || readOnly) {
      setHoveredIndex(null);
      setPressedIndex(null);
      pointerPressRef.current = { index: null, cancelled: true };
    }
  }, [disabled, readOnly]);

  const handleClick = (val: T) => {
    if (disabled || readOnly || val === value) return; // Do not trigger change or dirty state on identical click
    onChange(val);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled || readOnly || options.length === 0) return;

    let targetIndex: number | null = null;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      targetIndex = (index + 1) % options.length;
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      targetIndex = (index - 1 + options.length) % options.length;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      targetIndex = (index + 1) % options.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      targetIndex = (index - 1 + options.length) % options.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      targetIndex = options.length - 1;
    } else if (e.key === " " || e.key === "Enter") {
      if (e.repeat) e.preventDefault();
      else setPressedIndex(index);
      // Native button activation handles Enter/Space without a second commit.
      return;
    }

    if (targetIndex !== null) {
      setPressedIndex(null);
      const nextOpt = options[targetIndex];
      buttonRefs.current[targetIndex]?.focus();
      if (nextOpt.value !== value) {
        onChange(nextOpt.value);
      }
    }
  };

  const isSelectedHovered = !disabled && selectedIndex !== -1 && hoveredIndex === selectedIndex;
  const isSelectedPressed = !disabled && selectedIndex !== -1 && pressedIndex === selectedIndex;

  const currentVariant = getSegmentVariant(value);
  const selectedBgVar = currentVariant === "default" ? "var(--seg-selected-bg)" : `var(--seg-${currentVariant}-bg)`;
  const selectedBorderVar = currentVariant === "default" ? "var(--seg-selected-border)" : `var(--seg-${currentVariant}-border)`;
  const selectedHoverVar = currentVariant === "default" ? "var(--seg-selected-hover)" : `var(--seg-${currentVariant}-hover)`;
  const selectedActiveVar = currentVariant === "default" ? "var(--seg-selected-active)" : `var(--seg-${currentVariant}-active)`;
  const selectedTextVar = currentVariant === "default" ? "var(--seg-selected-text)" : `var(--seg-${currentVariant}-text)`;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel || "状态"}
      aria-disabled={disabled || readOnly || undefined}
      className={cn(
        "inline-block h-9 w-[228px] max-w-full shrink-0 p-[3px] rounded-lg bg-[var(--seg-base)] border border-[var(--seg-base-border)] select-none box-border",
        disabled && !readOnly && "opacity-50",
        className
      )}
    >
      {/* One inner track gives buttons and the indicator identical geometry. */}
      <div
        className="relative isolate grid h-full w-full min-w-0"
        style={{ gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))` }}
      >
      {selectedIndex !== -1 && (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 rounded-[5px] pointer-events-none box-border border",
            isMounted &&
              "transition-[transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none"
          )}
          style={{
            width: `${100 / options.length}%`,
            transform: `translateX(${selectedIndex * 100}%)`,
            backgroundColor: isSelectedPressed
              ? selectedActiveVar
              : isSelectedHovered
              ? selectedHoverVar
              : selectedBgVar,
            borderColor: selectedBorderVar,
          }}
        />
      )}

      {/* Option Buttons */}
      {options.map((opt, i) => {
        const isSelected = opt.value === value;
        const isHovered = !disabled && !readOnly && hoveredIndex === i;
        const isPressed = !disabled && !readOnly && pressedIndex === i;

        // Determine unselected background feedback
        let unselectedBg = "transparent";
        if (!isSelected) {
          if (isPressed) {
            unselectedBg = "var(--seg-unselected-active)";
          } else if (isHovered) {
            unselectedBg = "var(--seg-unselected-hover)";
          }
        }

        // Tab index: only the selected option (or first option if none selected) has tabIndex=0
        const tabIndex = isSelected ? 0 : selectedIndex === -1 && i === 0 ? 0 : -1;

        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={disabled || readOnly ? -1 : tabIndex}
            disabled={disabled || readOnly}
            onClick={(e) => {
              if (disabled || readOnly) return;
              if (e.detail > 0 && pointerPressRef.current.cancelled) return;
              handleClick(opt.value);
            }}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") setPressedIndex(null);
            }}
            onBlur={() => setPressedIndex(null)}
            onPointerEnter={(e) => {
              if (!disabled && !readOnly && e.pointerType !== "touch") setHoveredIndex(i);
            }}
            onPointerLeave={() => {
              if (pointerPressRef.current.index === i) pointerPressRef.current.cancelled = true;
              setHoveredIndex((current) => current === i ? null : current);
              setPressedIndex((current) => current === i ? null : current);
            }}
            onPointerDown={(e) => {
              if (!disabled && !readOnly && e.button === 0) {
                pointerPressRef.current = { index: i, cancelled: false };
                setPressedIndex(i);
              }
            }}
            onPointerUp={(e) => {
              const bounds = e.currentTarget.getBoundingClientRect();
              if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) {
                pointerPressRef.current.cancelled = true;
              }
              pointerPressRef.current.index = null;
              setPressedIndex(null);
            }}
            onPointerCancel={() => {
              pointerPressRef.current = { index: null, cancelled: true };
              setPressedIndex(null);
            }}
            style={{
              backgroundColor: unselectedBg,
              color: isSelected ? selectedTextVar : undefined,
            }}
            className={cn(
              "relative z-10 h-full min-w-0 px-2 flex items-center justify-center text-center text-[13px] leading-5 font-normal rounded-[5px] transition-colors duration-100 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--seg-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--seg-base)]",
              isSelected
                ? "font-medium"
                : "text-[var(--seg-unselected-text)]",
              readOnly
                ? "cursor-default"
                : disabled
                ? "cursor-not-allowed"
                : "cursor-pointer"
            )}
          >
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
