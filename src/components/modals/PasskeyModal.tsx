import React, { useState, useEffect, useRef } from "react";
import { SecurityKeyEntry } from "../../types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

interface PasskeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Partial<SecurityKeyEntry>) => Promise<void>;
  initialData?: SecurityKeyEntry | null;
}
const selectClass = "h-[38px] w-full rounded-md border border-border bg-input px-3 text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

export function PasskeyModal({ isOpen, onClose, onSave, initialData }: PasskeyModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("通行密钥");
  const [provider, setProvider] = useState("Google 密码管理工具");
  const [storageLocation, setStorageLocation] = useState("");
  const [lastUsedDesc, setLastUsedDesc] = useState("未填写");
  const [createdAt, setCreatedAt] = useState("");
  const [creationType, setCreationType] = useState("未填写");
  const [status, setStatus] = useState("正常");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(initialData?.display_name || "");
    setCategory(initialData?.category || "通行密钥");
    setProvider(initialData?.provider || "Google 密码管理工具");
    setStorageLocation(initialData?.storage_location || initialData?.device_name || "");
    setLastUsedDesc(initialData?.last_used_desc || "未填写");
    setCreatedAt(initialData?.created_at || "");
    setCreationType(initialData?.creation_type || "未填写");
    setStatus(initialData?.status || "正常");
    setError(null);
  }, [initialData, isOpen]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || !displayName.trim()) return;
    submitting.current = true; setIsSubmitting(true); setError(null);
    try {
      await onSave({ id: initialData?.id, display_name: displayName.trim(), category, provider, storage_location: storageLocation.trim() || null, device_name: storageLocation.trim() || null, last_used_desc: lastUsedDesc.trim() || "未填写", created_at: createdAt.trim() || null, creation_type: creationType, status });
      if (mounted.current) onClose();
    } catch (failure) { if (!mounted.current) return; setError(typeof failure === "string" ? failure : "保存失败，请重试。"); }
    finally { submitting.current = false; if (mounted.current) setIsSubmitting(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !submitting.current) onClose(); }}>
      <DialogContent className="max-w-[460px]" hideCloseButton={isSubmitting}>
        <DialogHeader><DialogTitle>{initialData ? "编辑密钥记录" : "添加密钥记录"}</DialogTitle><DialogDescription>登记通行密钥或安全密钥的设备信息。</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting}>
          <fieldset disabled={isSubmitting} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="passkey-name">名称</Label><Input id="passkey-name" required autoFocus value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="工作电脑" /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="passkey-category">类别</Label><select id="passkey-category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}><option value="通行密钥">通行密钥</option><option value="安全密钥">安全密钥</option></select></div>
              <div className="space-y-1.5"><Label htmlFor="passkey-provider">保存位置 / 提供方</Label><select id="passkey-provider" value={provider} onChange={(e) => setProvider(e.target.value)} className={selectClass}><option value="Google 密码管理工具">Google 密码管理工具</option><option value="Windows Hello">Windows Hello</option><option value="硬件安全密钥">硬件安全密钥</option><option value="其他">其他</option></select></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="passkey-location">设备型号 / 保管位置</Label><Input id="passkey-location" value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} placeholder="选填" /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="passkey-last-used">最近使用</Label><Input id="passkey-last-used" value={lastUsedDesc} onChange={(e) => setLastUsedDesc(e.target.value)} placeholder="选填" /></div>
              <div className="space-y-1.5"><Label htmlFor="passkey-created">创建时间</Label><Input id="passkey-created" value={createdAt} onChange={(e) => setCreatedAt(e.target.value)} placeholder="年-月-日" /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="passkey-creation-type">创建方式</Label><select id="passkey-creation-type" value={creationType} onChange={(e) => setCreationType(e.target.value)} className={selectClass}><option value="未填写">未填写</option><option value="手动">手动创建</option><option value="Android 自动创建">Android 自动创建</option></select></div>
              <div className="space-y-1.5"><Label htmlFor="passkey-status">设备状态</Label><select id="passkey-status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}><option value="正常">正常</option><option value="待核对">待核对</option><option value="已撤销">已撤销</option><option value="设备遗失">设备遗失</option></select></div>
            </div>
          </fieldset>
          {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>取消</Button><Button type="submit" disabled={isSubmitting || !displayName.trim()} className="min-w-20">{isSubmitting ? "保存中…" : "保存"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
