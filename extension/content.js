// AccountVault Security Content Script
(() => {
  const parseAndSync = () => {
    try {
      const text = (document.body ? document.body.innerText : '').replace(/\r\n/g, '\n');
      if (!text || text.length < 50) return;

      let recPhone = null;
      let twoFaPhone = null;
      const recPhoneMatch = text.match(/(?:Recovery phone|辅助电话|恢复电话|密保手机)[\s:\-\n]+([+0-9\s-]{6,20})/i);
      if (recPhoneMatch) recPhone = recPhoneMatch[1].trim();
      const twoFaPhoneMatch = text.match(/(?:2-Step Verification phones|两步验证电话|两步验证手机)[\s:\-\n]+([+0-9\s-]{6,20})/i);
      if (twoFaPhoneMatch) twoFaPhone = twoFaPhoneMatch[1].trim();
      if (!recPhone && twoFaPhone) recPhone = twoFaPhone;

      let recEmail = null;
      const recEmailMatch = text.match(/(?:Recovery email|辅助邮箱|恢复邮箱)[\s:\-\n]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (recEmailMatch) {
        recEmail = recEmailMatch[1].trim();
      } else {
        const allEmails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        const valid = allEmails.filter(e => !e.endsWith('@google.com') && !e.includes('myaccount'));
        if (valid.length > 0) recEmail = valid[0].trim();
      }

      let twoFactor = "关闭";
      const twoFaMatch = text.match(/(?:2-Step Verification|两步验证)[\s:\-\n]+(On[^\n]*|Off|开启|关闭|已开启|未开启)/i);
      if (twoFaMatch) {
        const val = twoFaMatch[1].toLowerCase();
        twoFactor = (val.includes('off') || val.includes('关闭') || val.includes('未开启')) ? "关闭" : "开启";
      }

      let skipPwd = "开启";
      const skipPwdMatch = text.match(/(?:Skip password when possible|尽可能跳过密码)[\s:\-\n]+(On|Off|开启|关闭|已开启|未开启)/i);
      if (skipPwdMatch) {
        const val = skipPwdMatch[1].toLowerCase();
        skipPwd = (val === 'off' || val === '关闭' || val === '未开启') ? "关闭" : "开启";
      }

      let totp = "关闭";
      const totpMatch = text.match(/(?:Authenticator|身份验证器)[\s:\-\n]+(Added[^\n]+|已添加[^\n]+|Not added|未添加|Off|关闭)/i);
      if (totpMatch) {
        const val = totpMatch[1].toLowerCase();
        totp = (val.includes('not') || val.includes('未') || val.includes('off') || val.includes('关闭')) ? "关闭" : "开启";
      }

      let backupStatus = "关闭";
      let backupRemain = 0;
      const backupMatch = text.match(/(?:Backup codes|备用验证码|备用代码)[\s:\-\n]+(\d+)\s*(?:codes available|个可用|剩余|条剩余|remaining)/i);
      if (backupMatch) {
        backupStatus = "开启";
        backupRemain = parseInt(backupMatch[1], 10);
      } else if (text.includes("Backup codes") || text.includes("备用验证码")) {
        backupStatus = "开启";
        const countMatch = text.match(/(\d+)\s*(?:codes available|个可用|剩余|条剩余|remaining)/i);
        backupRemain = countMatch ? parseInt(countMatch[1], 10) : 10;
      }

      const res = {
        two_factor_status: twoFactor,
        two_factor_phone: twoFaPhone,
        skip_password_status: skipPwd,
        totp_status: totp,
        has_recovery_phone: recPhone ? "有" : "无",
        recovery_phone: recPhone,
        recovery_phone_verified: recPhone ? "已验证" : "未填写",
        has_recovery_email: recEmail ? "有" : "无",
        recovery_email: recEmail,
        recovery_email_verified: recEmail ? "已验证" : "未填写",
        backup_codes_status: backupStatus,
        backup_codes_remaining: backupRemain,
        raw_source: "Chrome 扩展自动回传",
        extracted_at: new Date().toISOString()
      };

      fetch("http://127.0.0.1:18299/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(res),
        mode: "cors"
      }).then(() => {
        const badge = document.createElement("div");
        badge.style.cssText = "position:fixed;top:16px;right:20px;background:#10b981;color:#fff;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:9999999;font-family:sans-serif;";
        badge.innerText = "✓ AccountVault: 安全配置已自动同步";
        document.body.appendChild(badge);
        setTimeout(() => badge.remove(), 2500);
      }).catch(() => {});
    } catch (e) {
      console.warn("[AccountVault] Auto parse error:", e);
    }
  };

  // Run automatically when page is ready
  setTimeout(parseAndSync, 1500);
  setTimeout(parseAndSync, 3500);
})();
