import React, { useState, useRef } from "react";
import { VaultProvider, useVault } from "./context/VaultContext";
import { TopBar } from "./components/layout/TopBar";
import { AccountList } from "./components/accounts/AccountList";
import { AccountDetailView, AccountDetailRef } from "./components/accounts/AccountDetail";
import { LockScreen } from "./components/layout/LockScreen";
import { AddAccountModal } from "./components/modals/AddAccountModal";
import { ImportModal } from "./components/modals/ImportModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { Toast } from "./components/common/Toast";
import { ComponentPreview } from "./components/dev/ComponentPreview";
import { TooltipProvider } from "./components/ui/tooltip";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./components/ui/dialog";
import { isBrowserPreview } from "./services/tauri";

function AppContent() {
  const { selectedAccountDetail, setSelectedAccountId, toast, isUnlockModalOpen, vaultStatus } = useVault();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [isSavingAndSwitching, setIsSavingAndSwitching] = useState(false);
  const detailRef = useRef<AccountDetailRef>(null);

  React.useEffect(() => {
    try {
      const step = new URLSearchParams(window.location.search).get("demo_step");
      if (isBrowserPreview && step === "modal") {
        setHasUnsavedChanges(true);
        setPendingSelectId("acc-2");
      }
    } catch {
      // ignore
    }
  }, []);

  const isLocked = !vaultStatus || !vaultStatus.unlocked || isUnlockModalOpen;

  React.useEffect(() => {
    if (isLocked) {
      setHasUnsavedChanges(false);
      setPendingSelectId(null);
    }
  }, [isLocked]);

  const handleBeforeSelect = (targetId: string) => {
    if (hasUnsavedChanges) {
      setPendingSelectId(targetId);
      return false; // block direct switch, show confirmation
    }
    return true; // allowed
  };

  const handleDiscardAndSwitch = () => {
    if (pendingSelectId) {
      setHasUnsavedChanges(false);
      setSelectedAccountId(pendingSelectId);
      setPendingSelectId(null);
    }
  };

  const handleSaveAndSwitch = async () => {
    if (!detailRef.current || !pendingSelectId) return;
    setIsSavingAndSwitching(true);
    try {
      const success = await detailRef.current.saveChanges();
      if (success) {
        setHasUnsavedChanges(false);
        setSelectedAccountId(pendingSelectId);
        setPendingSelectId(null);
      }
    } finally {
      setIsSavingAndSwitching(false);
    }
  };

  const isPreview = (() => {
    try {
      return isBrowserPreview && new URLSearchParams(window.location.search).get("preview") === "components";
    } catch {
      return false;
    }
  })();

  if (isPreview) {
    return <ComponentPreview />;
  }

  // If locked, render the standalone LockScreen directly - no sensitive data in DOM
  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-app-bg text-app-text font-sans antialiased select-none">
      {/* 1. Top Toolbar (Height 48px) */}
      <TopBar />

      {/* 2. Main Two-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Compact Account List (272px standard, tightens to 240px below 1200px) */}
        <AccountList onBeforeSelectAccount={handleBeforeSelect} />

        {/* Right Column: Complete Account Details Form */}
        <div className="flex-1 h-full min-w-0 flex flex-col overflow-hidden">
          <AccountDetailView
            ref={detailRef}
            account={selectedAccountDetail}
            onDirtyChange={setHasUnsavedChanges}
          />
        </div>
      </div>

      {/* Global Modals (Add, Import, Settings) */}
      <AddAccountModal />
      <ImportModal />
      <SettingsModal />

      {/* Unsaved changes confirmation dialog */}
      <Dialog open={Boolean(pendingSelectId)} onOpenChange={(open) => { if (!open && !isSavingAndSwitching) setPendingSelectId(null); }}>
        <DialogContent className="max-w-[400px]" onEscapeKeyDown={(e) => { if (isSavingAndSwitching) e.preventDefault(); }} onPointerDownOutside={(e) => { if (isSavingAndSwitching) e.preventDefault(); }}>
          <DialogHeader>
            <DialogTitle>保存修改？</DialogTitle>
            <DialogDescription>当前账号的修改尚未保存。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" disabled={isSavingAndSwitching} onClick={() => setPendingSelectId(null)}>取消</Button>
            <Button variant="outline" size="sm" disabled={isSavingAndSwitching} onClick={handleDiscardAndSwitch}>放弃修改</Button>
            <Button size="sm" disabled={isSavingAndSwitching} onClick={handleSaveAndSwitch}>{isSavingAndSwitching ? "保存中…" : "保存并切换"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Toast */}
      <Toast toast={toast} />
    </div>
  );
}

export default function App() {
  return (
    <VaultProvider>
      <TooltipProvider delayDuration={450} skipDelayDuration={100}>
        <AppContent />
      </TooltipProvider>
    </VaultProvider>
  );
}
