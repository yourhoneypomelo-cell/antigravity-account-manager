import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { api, isBrowserPreview } from "../services/tauri";
import { AccountSummary, AccountDetail, VaultStatus } from "../types";

interface VaultContextType {
  vaultStatus: VaultStatus | null;
  isLoading: boolean;
  isDetailLoading: boolean;
  accounts: AccountSummary[];
  selectedAccountId: string | null;
  selectedAccountDetail: AccountDetail | null;
  searchQuery: string;
  darkMode: boolean;
  toast: { message: string; type?: "info" | "success" | "warning" | "error" } | null;
  isAddModalOpen: boolean;
  isImportModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isUnlockModalOpen: boolean;

  setSearchQuery: (q: string) => void;
  setSelectedAccountId: (id: string | null) => void;
  setIsAddModalOpen: (open: boolean) => void;
  setIsImportModalOpen: (open: boolean) => void;
  setIsSettingsModalOpen: (open: boolean) => void;
  setIsUnlockModalOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  showToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;

  refreshStatus: () => Promise<void>;
  refreshAccounts: (selectAccountId?: string) => Promise<void>;
  loadAccountDetail: (id: string) => Promise<void>;
  unlock: (password: string) => Promise<{ success: boolean; error?: string }>;
  lock: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<AccountDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (isBrowserPreview && params.get("theme") === "dark") return true;
      if (isBrowserPreview && params.get("theme") === "light") return false;
    } catch {
      // ignore
    }
    return localStorage.getItem("account_vault_theme") === "dark";
  });
  const [toast, setToast] = useState<{ message: string; type?: "info" | "success" | "warning" | "error" } | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState<boolean>(false);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const activeDetailRequestIdRef = useRef(0);
  const activeAccountsRequestIdRef = useRef(0);
  const sessionRevisionRef = useRef(0);
  const unlockedRef = useRef(false);
  const selectedAccountRef = useRef(selectedAccountId);
  const detailRef = useRef(selectedAccountDetail);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const vaultStatusRef = useRef<VaultStatus | null>(vaultStatus);
  vaultStatusRef.current = vaultStatus;
  selectedAccountRef.current = selectedAccountId;
  detailRef.current = selectedAccountDetail;

  const showToast = useCallback((message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem("account_vault_theme", next ? "dark" : "light");
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const applyStatus = useCallback((status: VaultStatus) => {
    unlockedRef.current = status.unlocked;
    setVaultStatus(status);
    setIsUnlockModalOpen(!status.unlocked);
    if (!status.unlocked) {
      ++activeDetailRequestIdRef.current;
      ++activeAccountsRequestIdRef.current;
      setIsDetailLoading(false);
      setSelectedAccountDetail(null);
      setAccounts([]);
      setIsAddModalOpen(false);
      setIsImportModalOpen(false);
      setIsSettingsModalOpen(false);
      if (!status.initialized) setSelectedAccountId(null);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    const revision = sessionRevisionRef.current;
    try {
      const status = await api.getVaultStatus();
      if (revision === sessionRevisionRef.current) applyStatus(status);
    } catch (err) {
      console.error("Failed to get vault status:", err);
    }
  }, [applyStatus]);

  const refreshAccounts = useCallback(async (targetSelectId?: string) => {
    if (!unlockedRef.current) return;
    const revision = sessionRevisionRef.current;
    const requestId = ++activeAccountsRequestIdRef.current;
    try {
      const list = await api.getAccountsSummary();
      if (!unlockedRef.current || revision !== sessionRevisionRef.current || requestId !== activeAccountsRequestIdRef.current) return;
      setAccounts(list);

      // A list refresh never reloads the selected form or resets its draft.
      if (targetSelectId && list.some(a => a.id === targetSelectId)) {
        setSelectedAccountId(targetSelectId);
      } else if (list.length > 0) {
        setSelectedAccountId((curr) => {
          if (curr && list.some((a) => a.id === curr)) {
            return curr;
          }
          return list[0].id;
        });
      } else {
        ++activeDetailRequestIdRef.current;
        setSelectedAccountId(null);
        setSelectedAccountDetail(null);
      }
    } catch (err: any) {
      const errMsg = typeof err === "string" ? err : err?.message || "";
      if (errMsg.toLowerCase().includes("locked")) {
        lock();
        return;
      }
      console.error("Failed to fetch accounts:", err);
    }
  }, []);

  const loadAccountDetail = useCallback(async (id: string) => {
    // A mutation from a previously selected account may finish after a switch.
    // Its refresh must not invalidate or clear the newly selected account.
    if (!unlockedRef.current || selectedAccountRef.current !== id) return;
    const requestId = ++activeDetailRequestIdRef.current;
    const revision = sessionRevisionRef.current;
    const isSameAccount = detailRef.current?.id === id;
    // Keep an existing form mounted during same-account list/key updates.
    // AccountDetail owns its local draft; only a real account switch clears it.
    if (!isSameAccount) setSelectedAccountDetail(null);
    setIsDetailLoading(false);

    const timer = setTimeout(() => {
      if (!isSameAccount && unlockedRef.current && activeDetailRequestIdRef.current === requestId) {
        setIsDetailLoading(true);
      }
    }, 200);

    try {
      const detail = await api.getAccountDetail(id);
      if (unlockedRef.current && revision === sessionRevisionRef.current && activeDetailRequestIdRef.current === requestId && selectedAccountRef.current === id) {
        setIsDetailLoading(false);
        setSelectedAccountDetail(detail);
      }
    } catch (err: any) {
      const errMsg = typeof err === "string" ? err : err?.message || "";
      if (errMsg.toLowerCase().includes("locked")) {
        lock();
        return;
      }
      if (unlockedRef.current && revision === sessionRevisionRef.current && activeDetailRequestIdRef.current === requestId) {
        setIsDetailLoading(false);
        console.error("Failed to fetch account detail:", err);
        showToast("获取账号详情失败", "error");
      }
    } finally {
      clearTimeout(timer);
    }
  }, [showToast]);

  const unlock = useCallback(async (password: string) => {
    const revision = sessionRevisionRef.current;
    try {
      setIsLoading(true);
      let success: boolean;
      if (!vaultStatus?.initialized) {
        success = await api.initVault(password);
      } else {
        success = await api.unlockVault(password);
      }
      if (!success) throw new Error("解锁失败，请检查密码");
      const status = await api.getVaultStatus();
      if (revision !== sessionRevisionRef.current) return { success: false, error: "操作已取消" };
      if (!status.unlocked) throw new Error("账号库仍处于锁定状态");
      lastActivityRef.current = Date.now();
      applyStatus(status);
      await refreshAccounts();
      if (revision !== sessionRevisionRef.current) return { success: false, error: "操作已取消" };
      return { success: true };
    } catch (err: any) {
      const errMsg = typeof err === "string" ? err : err?.message || "解锁失败，请检查密码";
      return { success: false, error: errMsg };
    } finally {
      setIsLoading(false);
    }
  }, [vaultStatus, applyStatus, refreshAccounts]);

  const lock = useCallback(async () => {
    // Invalidate pending reads before waiting for the backend lock operation.
    ++sessionRevisionRef.current;
    unlockedRef.current = false;
    ++activeDetailRequestIdRef.current;
    ++activeAccountsRequestIdRef.current;
    setSelectedAccountDetail(null);
    setAccounts([]);
    setIsDetailLoading(false);
    setIsUnlockModalOpen(true);
    setIsAddModalOpen(false);
    setIsImportModalOpen(false);
    setIsSettingsModalOpen(false);
    setToast(null);
    setVaultStatus(prev => prev ? { ...prev, unlocked: false } : prev);
    try {
      const success = await api.lockVault();
      if (!success) throw new Error("锁定失败");
    } catch (err) {
      console.error("Failed to lock:", err);
      await refreshStatus();
      await refreshAccounts();
      showToast("锁定失败，请重试", "error");
    }
  }, [refreshStatus, refreshAccounts, showToast]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setIsLoading(true);
      try {
        const status = await api.getVaultStatus();
        if (cancelled) return;
        // The preview service consumes ?locked=1 once when it initializes.
        applyStatus(status);
        if (status.unlocked) {
          await refreshAccounts();
        } else {
          setIsUnlockModalOpen(true);
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [applyStatus, refreshAccounts]);

  useEffect(() => () => {
    ++activeDetailRequestIdRef.current;
    ++activeAccountsRequestIdRef.current;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // 1. User activity listener for idle tracking
  useEffect(() => {
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 1000) {
        lastActivityRef.current = now;
      }
    };
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "wheel"];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, []);

  // 2. Active idle timer: triggers lock() as soon as idle time passes
  useEffect(() => {
    const timer = setInterval(() => {
      if (!unlockedRef.current) return;
      const minutes = vaultStatusRef.current?.auto_lock_minutes ?? 15;
      if (minutes > 0) {
        const idleMs = Date.now() - lastActivityRef.current;
        if (idleMs >= minutes * 60 * 1000) {
          lock();
        }
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [lock]);

  // 3. Periodic backend status synchronization (every 5 seconds)
  useEffect(() => {
    const syncTimer = setInterval(async () => {
      if (!unlockedRef.current) return;
      try {
        const status = await api.getVaultStatus();
        if (unlockedRef.current && !status.unlocked) {
          applyStatus(status);
        } else if (unlockedRef.current && status.unlocked && status.auto_lock_minutes !== vaultStatusRef.current?.auto_lock_minutes) {
          setVaultStatus(status);
        }
      } catch (err: any) {
        const msg = typeof err === "string" ? err : err?.message || "";
        if (msg.toLowerCase().includes("locked")) {
          lock();
        }
      }
    }, 5000);
    return () => clearInterval(syncTimer);
  }, [applyStatus, lock]);

  useEffect(() => {
    if (selectedAccountId && vaultStatus?.unlocked) {
      loadAccountDetail(selectedAccountId);
    } else {
      ++activeDetailRequestIdRef.current;
      setSelectedAccountDetail(null);
      setIsDetailLoading(false);
    }
  }, [selectedAccountId, vaultStatus?.unlocked, loadAccountDetail]);

  return (
    <VaultContext.Provider
      value={{
        vaultStatus,
        isLoading,
        isDetailLoading,
        accounts,
        selectedAccountId,
        selectedAccountDetail,
        searchQuery,
        darkMode,
        toast,
        isAddModalOpen,
        isImportModalOpen,
        isSettingsModalOpen,
        isUnlockModalOpen,

        setSearchQuery,
        setSelectedAccountId,
        setIsAddModalOpen,
        setIsImportModalOpen,
        setIsSettingsModalOpen,
        setIsUnlockModalOpen,
        toggleDarkMode,
        showToast,

        refreshStatus,
        refreshAccounts,
        loadAccountDetail,
        unlock,
        lock,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return context;
}
