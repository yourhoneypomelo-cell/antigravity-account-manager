import React, { useEffect, useRef, useState } from "react";
import { Upload, Eye, EyeOff } from "lucide-react";
import { useVault } from "../../context/VaultContext";
import { api } from "../../services/tauri";
import { BackupCodesParseResult, StructuredImportRow } from "../../types";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

const textAreaClass = "w-full resize-y rounded-md border border-border bg-input p-3 font-mono text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

export function ImportModal() {
  const { isImportModalOpen, setIsImportModalOpen, accounts, refreshAccounts, setSelectedAccountId, showToast } = useVault();
  const [activeTab, setActiveTab] = useState<"backup_codes" | "csv">("backup_codes");
  const [backupText, setBackupText] = useState("");
  const [parsedBackup, setParsedBackup] = useState<BackupCodesParseResult | null>(null);
  const [targetAccountId, setTargetAccountId] = useState("");
  const [isNewBatch, setIsNewBatch] = useState(true);
  const [previewMasked, setPreviewMasked] = useState(true);
  const [csvContent, setCsvContent] = useState("");
  const [parsedRows, setParsedRows] = useState<StructuredImportRow[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const txtInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const busy = isParsing || isImporting;

  const parseBackup = async (source: string | Promise<string>) => {
    if (operation.current) return;
    operation.current = true; setIsParsing(true); setError(null); setParsedBackup(null); setPreviewMasked(true);
    try {
      const text = await source;
      if (!mounted.current) return;
      setBackupText(text);
      if (!text.trim()) { setError("请先选择文件或粘贴备用码。"); return; }
      const result = await api.parseBackupCodesText(text);
      if (!mounted.current) return;
      setParsedBackup(result);
      const matched = result.detected_email ? accounts.find((account) => account.email.toLowerCase() === result.detected_email!.toLowerCase()) : null;
      setTargetAccountId(matched?.id || (result.detected_email ? "NEW" : accounts[0]?.id || ""));
    } catch (failure) { if (!mounted.current) return; setError(typeof failure === "string" ? failure : "解析失败，请检查备用码文本。"); }
    finally { operation.current = false; if (mounted.current) setIsParsing(false); }
  };

  const parseCsv = async (source: string | Promise<string>) => {
    if (operation.current) return;
    operation.current = true; setIsParsing(true); setError(null); setParsedRows(null);
    try {
      const text = await source;
      if (!mounted.current) return;
      setCsvContent(text);
      if (!text.trim()) { setError("请先选择文件或粘贴 CSV 内容。"); return; }
      const rows = await api.parseCsvContent(text);
      if (mounted.current) setParsedRows(rows);
    } catch (failure) { if (!mounted.current) return; setError(typeof failure === "string" ? failure : "解析失败，请检查 CSV 内容。"); }
    finally { operation.current = false; if (mounted.current) setIsParsing(false); }
  };

  const readFile = (event: React.ChangeEvent<HTMLInputElement>, kind: "backup_codes" | "csv") => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || operation.current) return;
    if (kind === "backup_codes") void parseBackup(file.text()); else void parseCsv(file.text());
  };

  const confirmBackupImport = async () => {
    if (operation.current || !parsedBackup?.codes.length) return;
    if (!targetAccountId || (targetAccountId === "NEW" && !parsedBackup.detected_email)) { setError("请选择要写入的账号。"); return; }
    operation.current = true; setIsImporting(true); setError(null);
    let imported = false;
    try {
      let finalAccountId = targetAccountId;
      if (finalAccountId === "NEW") {
        finalAccountId = await api.createAccount(parsedBackup.detected_email!, "备用码文件导入账号");
        if (!mounted.current) return;
        setTargetAccountId(finalAccountId);
      }
      await api.addBackupCodeBatch(finalAccountId, parsedBackup.codes, parsedBackup.generation_date, "Google 备用码文本导入", isNewBatch);
      if (!mounted.current) return;
      imported = true;
      await refreshAccounts();
      if (!mounted.current) return;
      setSelectedAccountId(finalAccountId);
      setIsImportModalOpen(false);
      showToast(`已导入 ${parsedBackup.codes.length} 条备用码`, "success");
      setBackupText(""); setParsedBackup(null); setPreviewMasked(true);
    } catch (failure) {
      if (!mounted.current) return;
      if (imported) { showToast("备用码已导入，请重新打开账号以刷新。", "warning"); setIsImportModalOpen(false); setBackupText(""); setParsedBackup(null); }
      else setError(typeof failure === "string" ? failure : "导入失败，输入内容已保留。");
    } finally { operation.current = false; if (mounted.current) setIsImporting(false); }
  };

  const confirmCsvImport = async () => {
    if (operation.current || !parsedRows?.length) return;
    operation.current = true; setIsImporting(true); setError(null);
    let imported = false;
    try {
      const result = await api.importStructuredAccounts(parsedRows);
      if (!mounted.current) return;
      imported = true;
      await refreshAccounts();
      if (!mounted.current) return;
      setIsImportModalOpen(false);
      showToast(`已导入 ${result.success_count} 个，跳过 ${result.skipped_count} 个，失败 ${result.error_count} 个`, result.error_count > 0 ? "warning" : "success");
      setCsvContent(""); setParsedRows(null);
    } catch (failure) {
      if (!mounted.current) return;
      if (imported) { showToast("导入已完成，请重新打开账号列表以刷新。", "warning"); setIsImportModalOpen(false); setCsvContent(""); setParsedRows(null); }
      else setError(typeof failure === "string" ? failure : "导入失败，输入内容已保留。");
    } finally { operation.current = false; if (mounted.current) setIsImporting(false); }
  };

  return (
    <Dialog open={isImportModalOpen} onOpenChange={(open) => { if (!operation.current) { setPreviewMasked(true); setIsImportModalOpen(open); } }}>
      <DialogContent className="max-w-[560px]" hideCloseButton={busy}>
        <DialogHeader><DialogTitle>导入</DialogTitle><DialogDescription className="sr-only">导入备用码文本或 CSV 账号资料。写入前先检查预览。</DialogDescription></DialogHeader>
        <div className="flex gap-1 border-b border-border-subtle pb-2" aria-label="导入类型">
          <Button type="button" size="sm" variant={activeTab === "backup_codes" ? "secondary" : "ghost"} aria-pressed={activeTab === "backup_codes"} disabled={busy} onClick={() => { setActiveTab("backup_codes"); setError(null); }}>备用码</Button>
          <Button type="button" size="sm" variant={activeTab === "csv" ? "secondary" : "ghost"} aria-pressed={activeTab === "csv"} disabled={busy} onClick={() => { setActiveTab("csv"); setError(null); }}>CSV 账号</Button>
        </div>
        {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
        {activeTab === "backup_codes" && <div className="space-y-4" aria-busy={busy}>
          <div className="flex items-center justify-between gap-3"><Label htmlFor="import-backup-text">备用码文本</Label><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => txtInput.current?.click()}><Upload className="mr-1.5 h-4 w-4" />选择 TXT</Button><input ref={txtInput} type="file" accept=".txt" onChange={(e) => readFile(e, "backup_codes")} className="hidden" aria-label="选择备用码文件" disabled={busy} /></div>
          <textarea id="import-backup-text" value={backupText} onChange={(e) => { setBackupText(e.target.value); setParsedBackup(null); }} rows={4} placeholder="粘贴备用码或文件全文" className={textAreaClass} disabled={busy} />
          <div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => void parseBackup(backupText)} disabled={busy || !backupText.trim()}>{isParsing ? "解析中…" : "预览"}</Button></div>
          {parsedBackup && <div className="space-y-4 border-t border-border-subtle pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[13px]">识别到 {parsedBackup.total_detected} 条备用码</span><Button type="button" variant="ghost" size="sm" onClick={() => setPreviewMasked((value) => !value)}>{previewMasked ? <Eye className="mr-1.5 h-4 w-4" /> : <EyeOff className="mr-1.5 h-4 w-4" />}{previewMasked ? "显示" : "隐藏"}</Button></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><span className="text-[13px] text-muted-foreground">文件账号</span><p className="break-all text-[13px] select-text">{parsedBackup.detected_email || "未识别"}</p></div>
              <div className="space-y-1.5"><Label htmlFor="import-target-account">写入账号</Label><select id="import-target-account" value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)} disabled={busy} className="h-[38px] w-full rounded-md border border-border bg-input px-2 text-[13px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"><option value="" disabled>选择账号</option>{parsedBackup.detected_email && <option value="NEW">新建 {parsedBackup.detected_email}</option>}{targetAccountId && targetAccountId !== "NEW" && !accounts.some((account) => account.id === targetAccountId) && <option value={targetAccountId}>{parsedBackup.detected_email || "新建账号"}</option>}{accounts.map((account) => <option key={account.id} value={account.id}>{account.email}{account.display_name ? `（${account.display_name}）` : ""}</option>)}</select></div>
            </div>
            {parsedBackup.warning_messages.map((warning, index) => <p key={index} role="alert" className="text-[13px] text-amber-700 dark:text-amber-300">{warning}</p>)}
            <div className="grid grid-cols-2 gap-x-4 rounded-md bg-secondary/40 p-3 font-mono text-[13px] sm:grid-cols-5">{parsedBackup.codes.map((code, index) => <div key={index} className="py-1.5 text-center select-text">{previewMasked ? "•••• ••••" : code}</div>)}</div>
            <fieldset disabled={busy} className="space-y-2 text-[13px] text-muted-foreground"><legend className="mb-2">批次</legend><label className="flex items-start gap-2"><input type="radio" name="import-batch-mode" checked={isNewBatch} onChange={() => setIsNewBatch(true)} className="mt-1" /><span>设为新批次，旧批次归档</span></label><label className="flex items-start gap-2"><input type="radio" name="import-batch-mode" checked={!isNewBatch} onChange={() => setIsNewBatch(false)} className="mt-1" /><span>补充现有批次 / 归档历史记录</span></label></fieldset>
            <div className="flex justify-end"><Button type="button" onClick={confirmBackupImport} disabled={busy || !parsedBackup.codes.length || !targetAccountId} className="min-w-24">{isImporting ? "导入中…" : "导入备用码"}</Button></div>
          </div>}
        </div>}
        {activeTab === "csv" && <div className="space-y-4" aria-busy={busy}>
          <details className="text-[13px] text-muted-foreground"><summary className="cursor-pointer">支持的 CSV 字段</summary><p className="mt-2 break-words font-mono text-xs leading-relaxed select-text">email, display_name, purpose, tags, password, two_factor, recovery_email, recovery_phone, gemini_plan, status, notes</p></details>
          <div className="flex items-center justify-between gap-3"><Label htmlFor="import-csv-text">CSV 内容</Label><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => csvInput.current?.click()}><Upload className="mr-1.5 h-4 w-4" />选择 CSV</Button><input ref={csvInput} type="file" accept=".csv" onChange={(e) => readFile(e, "csv")} className="hidden" aria-label="选择 CSV 文件" disabled={busy} /></div>
          <textarea id="import-csv-text" value={csvContent} onChange={(e) => { setCsvContent(e.target.value); setParsedRows(null); }} rows={4} placeholder={'email,display_name\nname@example.com,工作账号'} className={textAreaClass} disabled={busy} />
          <div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => void parseCsv(csvContent)} disabled={busy || !csvContent.trim()}>{isParsing ? "解析中…" : "预览"}</Button></div>
          {parsedRows && <div className="space-y-3 border-t border-border-subtle pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[13px]">识别到 {parsedRows.length} 个账号</span><Button type="button" onClick={confirmCsvImport} disabled={busy || !parsedRows.length} className="min-w-24">{isImporting ? "导入中…" : "导入账号"}</Button></div>
            <div className="max-h-56 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-background text-muted-foreground"><tr>{["邮箱", "备注名", "用途", "标签", "密码"].map((heading) => <th key={heading} className="border-b border-border-subtle px-2 py-2 font-normal">{heading}</th>)}</tr></thead><tbody>{parsedRows.map((row, index) => <tr key={index} className="border-b border-border-subtle"><td className="px-2 py-2.5 select-text">{row.email}</td><td className="px-2 py-2.5 text-muted-foreground">{row.display_name || "—"}</td><td className="px-2 py-2.5 text-muted-foreground">{row.purpose || "—"}</td><td className="px-2 py-2.5 text-muted-foreground">{row.tags || "—"}</td><td className="px-2 py-2.5 font-mono">{row.password ? "••••••••" : "未填写"}</td></tr>)}</tbody></table></div>
          </div>}
        </div>}
      </DialogContent>
    </Dialog>
  );
}
