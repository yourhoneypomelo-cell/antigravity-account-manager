import React, { useMemo, useRef } from "react";
import { Search, Plus, X, Users, SearchX } from "lucide-react";
import { useVault } from "@/context/VaultContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AccountListProps {
  onBeforeSelectAccount?: (targetId: string) => boolean;
}

export function AccountList({ onBeforeSelectAccount }: AccountListProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const {
    accounts,
    selectedAccountId,
    setSelectedAccountId,
    searchQuery,
    setSearchQuery,
    setIsAddModalOpen,
  } = useVault();

  // Filter accounts solely by email or display_name (remark)
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.toLowerCase().trim();
    return accounts.filter((acc) => {
      const matchEmail = acc.email.toLowerCase().includes(q);
      const matchName = acc.display_name?.toLowerCase().includes(q) || false;
      return matchEmail || matchName;
    });
  }, [accounts, searchQuery]);

  const handleSelect = (id: string) => {
    // Repeated click on already selected account: no reload, no flicker, no resetting
    if (id === selectedAccountId) return;
    if (onBeforeSelectAccount && !onBeforeSelectAccount(id)) {
      return;
    }
    setSelectedAccountId(id);
  };

  const clearSearch = () => {
    setSearchQuery("");
    searchRef.current?.focus();
  };

  return (
    <aside aria-label="账号导航" className="w-[272px] min-w-[240px] max-w-[272px] max-xl:w-[240px] flex flex-col border-r border-border-subtle bg-sidebar shrink-0 h-full select-none">
      <div className="h-12 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] leading-[20px] font-medium text-foreground">账号</span>
          <span className="text-[12px] leading-[18px] text-muted-foreground tabular-nums">{accounts.length}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          className="h-8 px-2 text-muted-foreground hover:text-foreground gap-1"
          aria-label="新增账号"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
          <span>新增</span>
        </Button>
      </div>

      <div className="px-3 pb-3 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
          <Input
            ref={searchRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && searchQuery) clearSearch();
            }}
            placeholder="搜索账号或备注"
            aria-label="搜索账号或备注"
            autoComplete="off"
            spellCheck={false}
            className="pl-8 pr-9 h-[34px] text-[13px] [&::-webkit-search-cancel-button]:appearance-none"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearSearch}
              className="absolute right-px top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="清空搜索"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <nav
        aria-label="账号列表"
        className="flex-1 min-h-0 overflow-y-auto px-3 py-1"
      >
        {filteredAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <div className="text-muted-foreground mb-3">
              {searchQuery ? <SearchX className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" /> : <Users className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />}
            </div>
            <p className="text-[12px] leading-[18px] text-muted-foreground font-normal">
              {searchQuery ? "未找到匹配账号" : "暂无账号记录"}
            </p>
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="mt-1.5"
              >
                清除搜索词
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle/40">
          {filteredAccounts.map((acc) => {
            const isSelected = acc.id === selectedAccountId;
            return (
              <li key={acc.id} className="py-0.5 first:pt-0 last:pb-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-current={isSelected ? "true" : undefined}
                      onClick={() => handleSelect(acc.id)}
                      className={`group w-full h-10 px-3 rounded-md flex items-center text-left cursor-pointer outline-none transition-all duration-150 ease-out focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-sidebar-accent ${
                        isSelected
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs font-medium"
                          : "hover:bg-sidebar-hover hover:shadow-xs hover:translate-x-0.5 text-foreground active:scale-[0.99]"
                      }`}
                    >
                      <span className="block max-w-full text-[13px] leading-5 font-normal truncate">{acc.email}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" className="max-w-[360px] break-all">
                    {acc.email}{acc.display_name ? ` · ${acc.display_name}` : ""}
                  </TooltipContent>
                </Tooltip>
              </li>
            );
          })}
          </ul>
        )}
      </nav>

      <div className="h-9 px-3 border-t border-border-subtle flex items-center justify-between text-[12px] leading-[18px] text-muted-foreground shrink-0">
        <span>{searchQuery.trim() ? `${filteredAccounts.length} 个搜索结果` : `共 ${accounts.length} 个账号`}</span>
      </div>
    </aside>
  );
}
