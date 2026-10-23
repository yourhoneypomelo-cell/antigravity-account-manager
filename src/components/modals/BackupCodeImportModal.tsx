import React, { useEffect, useRef, useState } from "react";
import { Upload, AlertCircle } from "lucide-react";
import { api } from "../../services/tauri";
import { useVault } from "../../context/VaultContext";
import { BackupCodesParseResult } from "../../types";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

interface BackupCodeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountEmail: string;
  onSuccess: () => Promise<void>;
}

export function BackupCodeImportModal({ isOpen, onClose, accountId, accountEmail, onSuccess }: BackupCodeImportModalProps) {
  const { showToast } = useVault();
  const [rawText, setRawText] = useState("");
  const [parseResult, setParseResult] = useState<BackupCodesParseResult | null>(null);
  const [isNewBatch, setIsNewBatch] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const parseVersion = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    parseVersion.current += 1;
    setRawText(""); setParseResult(null); setIsParsing(false); setError(null);
  }, [isOpen, accountId]);

  const handleParse = async (text: string) => {
    const version = ++parseVersion.current;
    setRawText(text); setParseResult(null); setError(null);
    if (!text.trim()) { setIsParsing(false); return; }
    setIsParsing(true);
    try {
      const result = await api.parseBackupCodesText(text);
      if (mounted.current && version === parseVersion.current) setParseResult(result);
    } catch {
      if (mounted.current && version === parseVersion.current) setError("未能解析备用码，请检查文本。");
    } finally {
      if (mounted.current && version === parseVersion.current) setIsParsing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || submitting.current) return;
    const version = ++parseVersion.current;
    setParseResult(null); setIsParsing(true); setError(null);
    try { const text = await file.text(); if (mounted.current && version === parseVersion.current) await handleParse(text); }
    catch { if (mounted.current && version === parseVersion.current) { setError("无法读取文件，请重新选择。"); setIsParsing(false); } }
  };

  const handleConfirm = async () => {
    if (submitting.current || isParsing || !parseResult?.codes.length) return;
    submitting.current = true; setIsSubmitting(true); setError(null);
    let imported = false;
    try {
      await api.addBackupCodeBatch(accountId, parseResult.codes, parseResult.generation_date, "用户导入/粘贴", isNewBatch);
      if (!mounted.current) return;
      imported = true;
      await onSuccess();
      if (!mounted.current) return;
      showToast(`已导入 ${parseResult.codes.length} 条备用码`, "success");
      onClose();
    } catch (failure) {
      if (!mounted.current) return;
      if (imported) {
        showToast("备用码已导入，请重新打开账号以刷新。", "warning");
        onClose();
      } else setError(typeof failure === "string" ? failure : "导入失败，请重试。");
    } finally { submitting.current = false; if (mounted.current) setIsSubmitting(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting.current) onClose(); }}>
      <DialogContent className="max-w-[460px]" hideCloseButton={isSubmitting}>
        <DialogHeader>
          <DialogTitle>导入备用码</DialogTitle>
          <DialogDescription className="break-all">{accountEmail}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4" aria-busy={isSubmitting}>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="backup-code-text">备用码文本</Label>
            <Button variant="ghost" size="sm" type="button" onClick={() => fileInput.current?.click()} disabled={isSubmitting}><Upload className="mr-1.5 h-4 w-4" />选择 TXT</Button>
            <input ref={fileInput} type="file" accept=".txt" onChange={handleFileUpload} className="hidden" aria-label="选择备用码文件" disabled={isSubmitting} />
          </div>
          <textarea id="backup-code-text" rows={4} value={rawText} onChange={(e) => void handleParse(e.target.value)} placeholder="粘贴备用码或文件全文" disabled={isSubmitting} className="w-full resize-y rounded-md border border-border bg-input p-3 font-mono text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          {isParsing && <p role="status" className="text-[13px] text-muted-foreground">解析中…</p>}
          {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
          {parseResult && <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]"><span>识别到 {parseResult.codes.length} 条备用码</span>{parseResult.generation_date && <span className="text-muted-foreground">{parseResult.generation_date}</span>}</div>
            {parseResult.detected_email && parseResult.detected_email.toLowerCase() !== accountEmail.toLowerCase() && <p role="alert" className="flex items-start gap-2 text-[13px] text-amber-700 dark:text-amber-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-all">文件账号 {parseResult.detected_email} 与当前账号不同。</span></p>}
            <div className="grid max-h-36 grid-cols-2 gap-x-4 overflow-y-auto rounded-md bg-secondary/40 p-3 font-mono text-[13px]">
              {parseResult.codes.map((code, index) => <div key={index} className="py-1 select-text"><span className="mr-2 text-muted-foreground">{index + 1}.</span>{code}</div>)}
            </div>
          </div>}
          <label className="flex items-start gap-2 text-[13px] text-muted-foreground"><input type="checkbox" checked={isNewBatch} onChange={(e) => setIsNewBatch(e.target.checked)} disabled={isSubmitting} className="mt-1 accent-[var(--app-accent)]" /><span>设为新批次，旧批次归档</span></label>
        </div>
        <DialogFooter><Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>取消</Button><Button type="button" onClick={handleConfirm} disabled={isSubmitting || isParsing || !parseResult?.codes.length} className="min-w-20">{isSubmitting ? "导入中…" : "导入"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
