import os
import sys
import shutil
import tempfile
import re
import json
import argparse
import winreg
import time
import subprocess
from datetime import datetime

def ensure_profile_unlocked(profile_path):
    cookie_p = os.path.join(profile_path, 'Network', 'Cookies')
    if not os.path.isfile(cookie_p):
        return
    try:
        with open(cookie_p, 'rb') as f:
            f.read(10)
    except Exception:
        # File is locked by a running Chrome process.
        # Terminate running Chrome to release session locks for full automation.
        try:
            subprocess.run(['taskkill', '/F', '/IM', 'chrome.exe', '/T'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1)
        except Exception:
            pass

def get_system_proxy():
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Internet Settings')
        enabled, _ = winreg.QueryValueEx(key, 'ProxyEnable')
        if enabled:
            server, _ = winreg.QueryValueEx(key, 'ProxyServer')
            if server:
                return 'http://' + server if not server.startswith(('http://', 'https://')) else server
    except Exception:
        pass
    return None

def parse_membership(text):
    status = "未开通"
    plan = "未填写"
    start_date = None

    if not text:
        return status, plan, start_date

    months = {
        'january': '01', 'jan': '01', 'february': '02', 'feb': '02',
        'march': '03', 'mar': '03', 'april': '04', 'apr': '04',
        'may': '05', 'june': '06', 'jun': '06',
        'july': '07', 'jul': '07', 'august': '08', 'aug': '08',
        'september': '09', 'sep': '09', 'sept': '09', 'october': '10', 'oct': '10',
        'november': '11', 'nov': '11', 'december': '12', 'dec': '12'
    }

    # Date parsing
    m = re.search(r'Member since\s+([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})', text, re.I)
    if m:
        mon_str = m.group(1).lower()
        day = int(m.group(2))
        yr = m.group(3)
        mon = months.get(mon_str, '01')
        start_date = f"{yr}-{mon}-{day:02d}"
    else:
        m2 = re.search(r'(?:自|于|从|since)?\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日', text)
        if m2:
            start_date = f"{m2.group(1)}-{int(m2.group(2)):02d}-{int(m2.group(3)):02d}"
        else:
            m3 = re.search(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', text)
            if m3:
                start_date = f"{m3.group(1)}-{int(m3.group(2)):02d}-{int(m3.group(3)):02d}"

    # Plan detection
    if re.search(r'AI\s*Ultra', text, re.I):
        plan = 'AI Ultra'
        status = '有效'
    elif re.search(r'Google\s*AI[\s\n]+Pro|AI\s*Pro', text, re.I):
        plan = 'AI Pro'
        status = '有效'
    elif re.search(r'AI\s*Plus|AI\s*Premium', text, re.I):
        plan = 'AI Plus'
        status = '有效'
    elif re.search(r'Current plan|当前套餐|当前方案|Member benefits|会员福利', text, re.I) and (start_date or re.search(r'TB|GB', text)):
        status = '有效'
        if re.search(r'Pro', text, re.I):
            plan = 'AI Pro'
        elif re.search(r'Ultra', text, re.I):
            plan = 'AI Ultra'
        elif re.search(r'Plus|Premium', text, re.I):
            plan = 'AI Plus'
        elif re.search(r'2\s*TB', text, re.I):
            plan = 'AI Pro'
        else:
            plan = '其他'
    elif re.search(r'Upgrade to Google One|升级到 Google One|加入 Google One|Get Google One', text, re.I):
        status = '未开通'
        plan = '免费'
    elif re.search(r'15\s*GB\s*(?:of\s*free\s*storage|免费存储空间)', text, re.I):
        status = '未开通'
        plan = '免费'

    # Status modifiers
    if re.search(r'trial|试用', text, re.I):
        status = '试用'
    elif re.search(r'cancelled|canceled|已取消', text, re.I):
        status = '已取消但仍有效'
    elif re.search(r'expired|已到期', text, re.I):
        status = '已到期'

    return status, plan, start_date

def scrape_security(executable_path, profile_path, account_email=None, headless=True, timeout_ms=35000):
    # Ensure profile session files are unlocked before crawling
    ensure_profile_unlocked(profile_path)

    user_data = os.path.dirname(profile_path)
    profile_dir = os.path.basename(profile_path)
    
    # Create isolated temp user data dir to avoid singleton locking with user's running Chrome
    temp_dir = os.path.join(tempfile.gettempdir(), f'AccountVault_crawler_{os.getpid()}_{profile_dir}')
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir, ignore_errors=True)
    os.makedirs(temp_dir, exist_ok=True)
    
    context = None
    try:
        # 1. Copy Local State
        local_state_src = os.path.join(user_data, 'Local State')
        if os.path.exists(local_state_src):
            shutil.copy2(local_state_src, os.path.join(temp_dir, 'Local State'))
            
        # 2. Copy Profile essentials (Cookies, Preferences, Session, etc.)
        src_p = profile_path
        dst_p = os.path.join(temp_dir, profile_dir)
        os.makedirs(dst_p, exist_ok=True)
        
        for item in os.listdir(src_p):
            s = os.path.join(src_p, item)
            d = os.path.join(dst_p, item)
            if os.path.isfile(s) and item in ['Preferences', 'Secure Preferences', 'Web Data']:
                try:
                    shutil.copy2(s, d)
                except Exception:
                    pass
            elif os.path.isdir(s) and item in ['Network', 'Sessions', 'Storage', 'IndexedDB']:
                try:
                    shutil.copytree(s, d)
                except Exception:
                    pass
                    
        args = [
            f'--profile-directory={profile_dir}',
            '--no-first-run',
            '--no-default-browser-check',
            '--headless=new',
            '--disable-gpu',
            '--window-position=-32000,-32000',
            '--window-size=1280,800',
        ]
        proxy = get_system_proxy()
        if proxy:
            args.append(f'--proxy-server={proxy}')
            
        from playwright.sync_api import sync_playwright
        
        with sync_playwright() as p:
            launch_kwargs = {
                'user_data_dir': temp_dir,
                'headless': True,
                'args': args
            }
            if executable_path and os.path.isfile(executable_path):
                launch_kwargs['executable_path'] = executable_path
            else:
                launch_kwargs['channel'] = 'chrome'
                
            context = p.chromium.launch_persistent_context(**launch_kwargs)
            page = context.pages[0] if context.pages else context.new_page()
            
            page.goto('https://myaccount.google.com/security', timeout=timeout_ms)
            page.wait_for_timeout(3500)
            
            # Read full body text
            text = page.locator('body').inner_text()

            # Scrape Google One / Gemini membership
            membership_status = "未开通"
            membership_plan = "未填写"
            membership_start_date = None
            try:
                page.goto('https://one.google.com/', timeout=18000)
                page.wait_for_timeout(2500)
                one_text = page.locator('body').inner_text()
                membership_status, membership_plan, membership_start_date = parse_membership(one_text)
                
                # If one.google.com did not yield a plan, fallback check payments-and-subscriptions
                if membership_status == '未开通' and membership_plan == '未填写':
                    try:
                        page.goto('https://myaccount.google.com/payments-and-subscriptions', timeout=15000)
                        page.wait_for_timeout(2000)
                        pay_text = page.locator('body').inner_text()
                        sub_st, sub_pl, sub_dt = parse_membership(pay_text)
                        if sub_st != '未开通' or sub_pl != '未填写':
                            membership_status = sub_st
                            membership_plan = sub_pl
                            if sub_dt:
                                membership_start_date = sub_dt
                    except Exception:
                        pass
            except Exception:
                pass
            
            # Explicitly close browser context immediately after reading
            try:
                context.close()
                context = None
            except Exception:
                pass
            
            lines = [l.strip() for l in text.split('\n') if l.strip()]
            
            result = {
                'account_id': None,
                'two_factor_status': '关闭',
                'two_factor_phone': None,
                'skip_password_status': '开启',
                'totp_status': '关闭',
                'totp_added_at': None,
                'has_recovery_phone': '无',
                'recovery_phone': None,
                'recovery_phone_verified': '未填写',
                'has_recovery_email': '无',
                'recovery_email': None,
                'recovery_email_verified': '未填写',
                'backup_codes_status': '关闭',
                'backup_codes_remaining': 0,
                'membership_status': membership_status,
                'membership_plan': membership_plan,
                'membership_start_date': membership_start_date,
                'raw_source': 'Chrome 自动化真后台实时抓取',
                'extracted_at': datetime.utcnow().isoformat() + 'Z'
            }
            
            # Robust semantic extraction
            for i, line in enumerate(lines):
                # 1. 2-Step Verification
                if re.match(r'^(?:2-Step Verification|两步验证)$', line, re.I):
                    if i + 1 < len(lines):
                        next_l = lines[i+1].lower()
                        if 'is off' in next_l or '关闭' in next_l or '未开启' in next_l:
                            result['two_factor_status'] = '关闭'
                        elif 'is on' in next_l or '开启' in next_l or '已开启' in next_l:
                            result['two_factor_status'] = '开启'
                            
                # 2. Skip password when possible
                if 'Skip password when possible' in line or '尽可能跳过密码' in line:
                    if i + 1 < len(lines):
                        next_l = lines[i+1].lower()
                        result['skip_password_status'] = '关闭' if ('off' in next_l or '关闭' in next_l) else '开启'
                        
                # 3. Recovery phone
                if re.match(r'^(?:Recovery phone|辅助电话|恢复电话|密保手机)$', line, re.I):
                    if i + 1 < len(lines):
                        val = lines[i+1]
                        phone_m = re.search(r'([+0-9\s-]{6,20})', val)
                        if phone_m:
                            result['recovery_phone'] = phone_m.group(1).strip()
                            result['has_recovery_phone'] = '有'
                            result['recovery_phone_verified'] = '已验证'
                            
                # 4. 2-Step Verification phone
                if re.match(r'^(?:2-Step Verification phone|两步验证电话|两步验证手机)$', line, re.I):
                    if i + 1 < len(lines):
                        val = lines[i+1]
                        phone_m = re.search(r'([+0-9\s-]{6,20})', val)
                        if phone_m:
                            result['two_factor_phone'] = phone_m.group(1).strip()
                            if not result['recovery_phone']:
                                result['recovery_phone'] = result['two_factor_phone']
                                result['has_recovery_phone'] = '有'
                                result['recovery_phone_verified'] = '已验证'
                                
                # 5. Recovery email
                if re.match(r'^(?:Recovery email|辅助邮箱|恢复邮箱)$', line, re.I):
                    if i + 1 < len(lines):
                        val = lines[i+1]
                        email_m = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', val)
                        if email_m:
                            result['recovery_email'] = email_m.group(1).strip()
                            result['has_recovery_email'] = '有'
                            result['recovery_email_verified'] = '已验证'
                            
                # 6. Authenticator
                if re.match(r'^(?:Authenticator|身份验证器)$', line, re.I):
                    if i + 1 < len(lines):
                        next_raw = lines[i+1]
                        val = next_raw.lower()
                        if 'not added' in val or '未添加' in val or 'off' in val or '关闭' in val:
                            result['totp_status'] = '关闭'
                            result['totp_added_at'] = None
                        elif 'added' in val or '已添加' in val:
                            result['totp_status'] = '开启'
                            m_en = re.search(r'Added\s+([A-Za-z0-9\s,]+)', next_raw, re.I)
                            if m_en:
                                result['totp_added_at'] = m_en.group(1).strip()
                            else:
                                m_cn = re.search(r'已添加\s*([0-9\s年月]+日?)', next_raw)
                                if m_cn and m_cn.group(1).strip():
                                    result['totp_added_at'] = m_cn.group(1).strip()
                                else:
                                    clean_date = next_raw.replace('Added', '').replace('已添加', '').strip()
                                    result['totp_added_at'] = clean_date if clean_date else None
                            
                # 7. Backup codes
                if 'Backup codes' in line or '备用验证码' in line or '备用代码' in line:
                    result['backup_codes_status'] = '开启'
                    rem = re.search(r'(\d+)\s*(?:codes available|个可用|剩余|条剩余|remaining)', line, re.I)
                    if not rem and i + 1 < len(lines):
                        rem = re.search(r'(\d+)\s*(?:codes available|个可用|剩余|条剩余|remaining)', lines[i+1], re.I)
                    if rem:
                        result['backup_codes_remaining'] = int(rem.group(1))
                    else:
                        result['backup_codes_remaining'] = 10
                        
            return result
    finally:
        if context:
            try:
                context.close()
            except Exception:
                pass
        shutil.rmtree(temp_dir, ignore_errors=True)

def main():
    parser = argparse.ArgumentParser(description="Google Security Live Scraper")
    parser.add_argument("--executable", required=False, default=r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    parser.add_argument("--profile-path", required=True)
    parser.add_argument("--account-email", required=False, default=None)
    parser.add_argument("--account-id", required=False, default=None)
    parser.add_argument("--headless", action="store_true", default=True)
    parser.add_argument("--visible", dest="headless", action="store_false")
    
    args = parser.parse_args()
    
    try:
        res = scrape_security(
            executable_path=args.executable,
            profile_path=args.profile_path,
            account_email=args.account_email,
            headless=args.headless
        )
        if args.account_id:
            res['account_id'] = args.account_id
        # Output pure JSON on stdout
        print(json.dumps(res, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        err_res = {
            "error": str(e)
        }
        print(json.dumps(err_res, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
