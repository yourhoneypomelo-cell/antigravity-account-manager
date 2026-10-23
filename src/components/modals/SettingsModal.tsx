import React, { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useVault } from "../../context/VaultContext";
import { api } from "../../services/tauri";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

export function SettingsModal() {
  const { isSettingsModalOpen, setIsSettingsModalOpen, vaultStatus, refreshAccounts, showToast } = useVault();
  const [activeTab, setActiveTab] = useState<"security" | "backup" | "db">("security");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(15);
  const [isSavingAutoLock, setIsSavingAutoLock] = useState<boolean>(false);

  useEffect(() => {
    if (!isSettingsModalOpen) return;
    api.getAppSettings().then((s) => {
      setAutoLockMinutes(s.auto_lock_minutes ?? 15);
    }).catch(() => {
      if (vaultStatus?.auto_lock_minutes !== undefined) {
        setAutoLockMinutes(vaultStatus.auto_lock_minutes);
      }
    });
  }, [isSettingsModalOpen, vaultStatus?.auto_lock_minutes]);

  const handleUpdateAutoLock = async (minutes: number) => {
    setAutoLockMinutes(minutes);
    setIsSavingAutoLock(true);
    try {
      const current = await api.getAppSettings().catch(() => ({
        auto_lock_minutes: 15,
        clipboard_clear_seconds: 30,
        mask_timeout_seconds: 15,
        dark_mode: false,
      }));
      await api.saveAppSettings({ ...current, auto_lock_minutes: minutes });
      await refreshAccounts();
      showToast(minutes > 0 ? `已设置无操作 ${minutes} 分钟后自动锁定` : "已关闭定时自动锁定", "success");
    } catch {
      showToast("保存自动锁定设置失败", "error");
    } finally {
      setIsSavingAutoLock(false);
    }
  };
  const operation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const restoreInput = useRef<HTMLInputElement>(null);
  const busy = isChangingPassword || isExporting || isRestoring;

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (operation.current) return;
    if (newPassword.length < 6) { setError("新主密码至少需要 6 个字符。"); return; }
    if (newPassword !== confirmPassword) { setError("两次输入的新密码不一致。"); return; }
    operation.current = true; setIsChangingPassword(true); setError(null);
    try {
      await api.changeMasterPassword(oldPassword, newPassword);
      if (!mounted.current) return;
      showToast("主密码已修改", "success");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (failure) { if (!mounted.current) return; setError(typeof failure === "string" ? failure : "修改失败，请检查当前密码。"); }
    finally { operation.current = false; if (mounted.current) setIsChangingPassword(false); }
  };

  const handleExportBackup = async () => {
    if (operation.current || !backupPassword) return;
    operation.current = true; setIsExporting(true); setError(null);
    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const fullPath = `D:\\account_vault_backup_${dateStr}.acvault`;
      await api.exportEncryptedBackup(fullPath, backupPassword);
      if (!mounted.current) return;
      showToast(`备份已导出至 ${fullPath}`, "success");
      setBackupPassword("");
    } catch (failure) { if (!mounted.current) return; setError(typeof failure === "string" ? failure : "导出失败，请重试。"); }
    finally { operation.current = false; if (mounted.current) setIsExporting(false); }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile || !restorePassword || operation.current) return;
    operation.current = true; setIsRestoring(true); setError(null);
    let restored = false;
    try {
      await api.restoreEncryptedBackup((restoreFile as File & { path?: string }).path || restoreFile.name, restorePassword);
      if (!mounted.current) return;
      restored = true;
      await refreshAccounts();
      if (!mounted.current) return;
      showToast("备份已恢复", "success");
      setRestoreFile(null); setRestorePassword("");
      setIsSettingsModalOpen(false);
    } catch (failure) {
      if (!mounted.current) return;
      if (restored) { showToast("备份已恢复，请重新打开账号库以刷新。", "warning"); setRestoreFile(null); setRestorePassword(""); setIsSettingsModalOpen(false); }
      else setError(typeof failure === "string" ? failure : "恢复失败，请检查文件和备份密码。");
    }
    finally { operation.current = false; if (mounted.current) setIsRestoring(false); }
  };

  return (
    <Dialog open={isSettingsModalOpen} onOpenChange={(open) => { if (!operation.current) setIsSettingsModalOpen(open); }}>
      <DialogContent className="max-w-[460px]" hideCloseButton={busy}>
        <DialogHeader><DialogTitle>设置</DialogTitle><DialogDescription className="sr-only">管理主密码、加密备份和存储信息。</DialogDescription></DialogHeader>
        <div className="flex flex-wrap gap-1 border-b border-border-subtle pb-2" aria-label="设置分类">
          {([{ value: "security", label: "安全与主密码" }, { value: "backup", label: "备份与恢复" }, { value: "db", label: "存储信息" }] as const).map((tab) => <Button key={tab.value} type="button" size="sm" variant={activeTab === tab.value ? "secondary" : "ghost"} aria-pressed={activeTab === tab.value} disabled={busy} onClick={() => { setActiveTab(tab.value); setError(null); }}>{tab.label}</Button>)}
        </div>
        {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
        {activeTab === "security" && (
          <div className="space-y-6">
            <form onSubmit={handleChangePassword} className="space-y-4" aria-busy={busy}>
              <div className="space-y-1.5"><Label htmlFor="settings-old-password">当前主密码</Label><Input id="settings-old-password" type="password" required autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} disabled={busy} /></div>
              <div className="space-y-1.5"><Label htmlFor="settings-new-password">新主密码</Label><Input id="settings-new-password" type="password" required minLength={6} autoComplete="new-password" placeholder="至少 6 个字符" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={busy} /></div>
              <div className="space-y-1.5"><Label htmlFor="settings-confirm-password">确认新密码</Label><Input id="settings-confirm-password" type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={busy} /></div>
              <div className="flex justify-end pt-1"><Button type="submit" disabled={busy} className="min-w-24">{isChangingPassword ? "修改中…" : "修改密码"}</Button></div>
            </form>

            <div className="space-y-3 border-t border-border-subtle pt-4">
              <div className="space-y-1">
                <Label htmlFor="settings-auto-lock" className="text-sm font-medium">定时自动锁定</Label>
                <p className="text-[12px] text-muted-foreground">空闲无操作达到设定时长后，自动进入独立锁屏页面保护数据。</p>
              </div>
              <div className="flex gap-2 items-center">
                <select
                  id="settings-auto-lock"
                  value={autoLockMinutes}
                  onChange={(e) => handleUpdateAutoLock(Number(e.target.value))}
                  disabled={busy || isSavingAutoLock}
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  <option value={5}>5 分钟无操作锁定</option>
                  <option value={15}>15 分钟无操作锁定（默认）</option>
                  <option value={30}>30 分钟无操作锁定</option>
                  <option value={60}>60 分钟无操作锁定</option>
                  <option value={0}>从不自动锁定</option>
                </select>
              </div>
            </div>
          </div>
        )}
        {activeTab === "backup" && <div className="space-y-6" aria-busy={busy}>
          <section className="space-y-3">
            <h3 className="text-sm font-medium">导出加密备份</h3>
            <div className="space-y-1.5"><Label htmlFor="settings-backup-password">备份密码</Label><Input id="settings-backup-password" type="password" autoComplete="new-password" value={backupPassword} onChange={(e) => setBackupPassword(e.target.value)} disabled={busy} /></div>
            <p className="text-[13px] text-muted-foreground">文件保存至 D 盘，恢复时需要此密码。</p>
            <Button type="button" variant="outline" onClick={handleExportBackup} disabled={busy || !backupPassword}><Download className="mr-2 h-4 w-4" />{isExporting ? "导出中…" : "导出备份"}</Button>
          </section>
          <section className="space-y-3 border-t border-border-subtle pt-5">
            <h3 className="text-sm font-medium">恢复备份</h3>
            <p className="text-[13px] text-muted-foreground">选择 .acvault 文件并输入备份密码。</p>
            <Button type="button" variant="outline" disabled={busy} onClick={() => restoreInput.current?.click()}><Upload className="mr-2 h-4 w-4" />选择备份文件</Button>
            <input ref={restoreInput} type="file" accept=".acvault" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) { setRestoreFile(file); setRestorePassword(""); setError(null); } }} disabled={busy} className="hidden" aria-label="选择加密备份文件" />
            {restoreFile && <div className="space-y-3"><p className="break-all text-[13px] text-muted-foreground">{restoreFile.name}</p><div className="space-y-1.5"><Label htmlFor="settings-restore-password">备份密码</Label><Input id="settings-restore-password" type="password" autoComplete="off" value={restorePassword} onChange={(event) => setRestorePassword(event.target.value)} disabled={busy} /></div><Button type="button" onClick={handleRestoreBackup} disabled={busy || !restorePassword}>{isRestoring ? "恢复中…" : "恢复备份"}</Button></div>}
          </section>
        </div>}
        {activeTab === "db" && <div className="space-y-4">
          <div className="space-y-2"><h3 className="text-sm font-medium">数据库位置</h3><p className="break-all rounded-md bg-secondary/50 p-3 font-mono text-[13px] text-muted-foreground select-text">{vaultStatus?.db_path || "暂时无法获取"}</p></div>
          <p className="text-[13px] text-muted-foreground">账号资料保存在本机。请定期导出加密备份。</p>
        </div>}
      </DialogContent>
    </Dialog>
  );
}
