import React from "react";
import { Upload, Settings, Lock, Moon, Sun } from "lucide-react";
import { useVault } from "@/context/VaultContext";
import { isBrowserPreview } from "@/services/tauri";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function TopBar() {
  const {
    setIsImportModalOpen,
    setIsSettingsModalOpen,
    lock,
    darkMode,
    toggleDarkMode,
  } = useVault();

  return (
    <header className="h-12 border-b border-border-subtle bg-sidebar px-4 flex items-center justify-between gap-3 shrink-0 select-none z-10">
      <div className="flex items-center gap-2.5 min-w-0">
        <img src="/branding/antigravity-v3-small.svg" alt="" aria-hidden="true" className="w-6 h-6 shrink-0" />
        <div className="flex items-baseline gap-2">
          <span className="text-[16px] leading-[24px] font-medium tracking-[-0.02em] text-foreground whitespace-nowrap">
            Antigravity Account Manager
          </span>
          {isBrowserPreview && <span className="text-[11px] leading-4 text-muted-foreground border border-border-subtle rounded px-1.5">演示</span>}
        </div>
      </div>

      <nav aria-label="应用操作" className="flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsImportModalOpen(true)}
          className="h-8 px-2.5 text-muted-foreground hover:text-foreground gap-1.5"
          aria-label="导入账号数据"
        >
          <Upload className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          <span>导入</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSettingsModalOpen(true)}
          className="h-8 px-2.5 text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Settings className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          <span>设置</span>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              aria-label={darkMode ? "切换至浅色模式" : "切换至深色模式"}
              className="text-muted-foreground hover:text-foreground"
            >
              {darkMode ? <Sun className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" /> : <Moon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{darkMode ? "浅色模式" : "深色模式"}</TooltipContent>
        </Tooltip>

        <Button
          variant="ghost"
          size="sm"
          onClick={lock}
          className="h-8 px-2.5 text-muted-foreground hover:text-foreground gap-1.5"
        >
          <Lock className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          <span>锁定</span>
        </Button>
      </nav>
    </header>
  );
}
