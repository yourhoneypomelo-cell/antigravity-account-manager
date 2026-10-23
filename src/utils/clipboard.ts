let lastCopiedValue: string | null = null;
let clearTimer: any = null;

export async function copyWithAutoClear(
  text: string,
  label: string = "内容",
  clearSeconds: number = 30,
  onNotify?: (message: string, duration?: number) => void
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    lastCopiedValue = text;

    if (onNotify) {
      onNotify(`已复制 ${label} 到剪贴板（${clearSeconds} 秒后自动清除保护隐私）`, 3000);
    }

    if (clearTimer) {
      clearTimeout(clearTimer);
    }

    if (clearSeconds > 0) {
      clearTimer = setTimeout(async () => {
        try {
          const currentText = await navigator.clipboard.readText();
          if (currentText === lastCopiedValue) {
            await navigator.clipboard.writeText("");
            lastCopiedValue = null;
            if (onNotify) {
              onNotify(`已安全清除剪贴板中的敏感 ${label}`, 3000);
            }
          }
        } catch {
          // Clipboard read might be blocked if window lost focus, fallback write empty
          if (lastCopiedValue === text) {
            await navigator.clipboard.writeText("").catch(() => {});
            lastCopiedValue = null;
          }
        }
      }, clearSeconds * 1000);
    }

    return true;
  } catch (err) {
    console.error("Clipboard copy failed:", err);
    if (onNotify) {
      onNotify(`复制失败，请检查剪贴板权限`, 3000);
    }
    return false;
  }
}
