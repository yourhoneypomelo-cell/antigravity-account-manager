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

MONTHS_MAP = {
    # English
    'january': '01', 'jan': '01', 'february': '02', 'feb': '02', 'march': '03', 'mar': '03',
    'april': '04', 'apr': '04', 'may': '05', 'june': '06', 'jun': '06', 'july': '07', 'jul': '07',
    'august': '08', 'aug': '08', 'september': '09', 'sep': '09', 'sept': '09', 'october': '10', 'oct': '10',
    'november': '11', 'nov': '11', 'december': '12', 'dec': '12',
    # Spanish
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
    'julio': '07', 'agosto': '08', 'septiembre': '09', 'setiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
    # Portuguese
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03', 'maio': '05', 'junho': '06',
    'julho': '07', 'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12',
    # French
    'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03', 'avril': '04', 'mai': '05',
    'juin': '06', 'juillet': '07', 'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12', 'decembre': '12',
    # German
    'januar': '01', 'februar': '02', 'märz': '03', 'maerz': '03', 'mai': '05', 'juni': '06',
    'juli': '07', 'august': '08', 'oktober': '10', 'dezember': '12',
    # Italian
    'gennaio': '01', 'febbraio': '02', 'aprile': '04', 'maggio': '05', 'giugno': '06', 'luglio': '07',
    'settembre': '09', 'ottobre': '10', 'novembre': '11', 'dicembre': '12',
    # Russian
    'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04', 'мая': '05', 'июня': '06',
    'июля': '07', 'августа': '08', 'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12',
    'январь': '01', 'февраль': '02', 'март': '03', 'апрель': '04', 'май': '05', 'июнь': '06',
    'июль': '07', 'август': '08', 'сентябрь': '09', 'октябрь': '10', 'ноябрь': '11', 'декабрь': '12',
}

RE_2FA_TITLE = re.compile(
    r'(?:2-Step Verification|Two-step verification|两步验证|兩步驟驗證|'
    r'Xác minh 2 bước|Verificación en dos pasos|Verificación en 2 pasos|'
    r'Verificação em duas etapas|Verificação em 2 etapas|Двухэтапная аутентификация|'
    r'2\s*段階認証プロセス|2段階認証|2단계 인증|Validation en deux étapes|'
    r'Bestätigung in zwei Schritten|Verifikasi 2 Langkah|'
    r'2 Adımlı Doğrulama|Verifica in due passaggi|التحقق بخطوتين|2-चरणों में पुष्टि)',
    re.I
)

RE_SKIP_PWD_TITLE = re.compile(
    r'(?:Skip password when possible|尽可能跳过密码|盡可能略過密碼|'
    r'Bỏ qua mật khẩu khi có thể|Omitir contraseña cuando sea posible|'
    r'Pular senha sempre que possível|Пропускать ввод пароля|'
    r'可能な場合はパスワードを省略|가능하면 비밀번호 건너뛰기|Ignorer le mot de passe si possible|'
    r'Passwörter nach Möglichkeit überspringen|Lewati sandi jika memungkinkan)',
    re.I
)

RE_TOTP_TITLE = re.compile(
    r'(?:Authenticator|身份验证器|驗證器|Ứng dụng Authenticator|'
    r'App del autenticador|Aplicación Authenticator|App Authenticator|Aplicativo Authenticator|'
    r'Приложение Authenticator|認証システム|인증 앱|Application Authenticator|'
    r'Authenticator-App|Aplikasi Authenticator)',
    re.I
)

RE_REC_EMAIL_TITLE = re.compile(
    r'(?:Recovery email|辅助邮箱|恢复邮箱|備援電子郵件|'
    r'Email khôi phục|Correo electrónico de recuperación|Correo de recuperación|'
    r'E-mail de recuperação|Резервный адрес электронной почты|Резервный адрес эл\. почты|Резервный email|'
    r'再設定用のメールアドレス|再設定用メール|복구 이메일|'
    r'Adresse e-mail de récupération|E-mail de récupération|'
    r'E-Mail-Adresse zur Kontowiederherstellung|Wiederherstellungs-E-Mail|'
    r'Email pemulihan|Kurtarma e-postası|Indirizzo email di recupero)',
    re.I
)

RE_REC_PHONE_TITLE = re.compile(
    r'(?:Recovery phone|辅助电话|辅助电话号码|恢复电话|密保手机|備援電話|'
    r'Số điện thoại khôi phục|Teléfono de recuperación|Teléfono de rescate|'
    r'Telefone de recuperação|Резервный номер телефона|Резервный телефон|'
    r'再設定用の電話番号|再設定用電話|복구 전화번호|'
    r'Numéro de téléphone de récupération|Téléphone de récupération|'
    r'Telefonnummer zur Kontowiederherstellung|Wiederherstellungstelefon|'
    r'Nomor telepon pemulihan|Kurtarma telefon numarası|Numero di telefono di recupero)',
    re.I
)

RE_2FA_PHONE_TITLE = re.compile(
    r'(?:2-Step Verification phone|两步验证电话|两步验证手机|兩步驟驗證電話|'
    r'Số điện thoại dùng cho quy trình xác minh 2 bước|Teléfono para la verificación en dos pasos|'
    r'Telefone para a verificação em duas etapas|Телефон для двухэтапной аутентификации|'
    r'2 段階認証プロセスの電話番号|2단계 인증 전화번호|'
    r'Téléphone pour la validation en deux étapes|Telefonnummer für die Bestätigung in zwei Schritten|'
    r'Telepon untuk Verifikasi 2 Langkah|2 Adımlı Doğrulama telefonu)',
    re.I
)

RE_BACKUP_TITLE = re.compile(
    r'(?:Backup codes|Backup code|备用验证码|备用代码|备用码|備用碼|'
    r'Mã dự phòng|Códigos de seguridad|Códigos de respaldo|Códigos de reserva|'
    r'Códigos de backup|Резервные коды|Коды безопасности|バックアップ\s*コード|'
    r'백업 코드|Codes de secours|Codes de sauvegarde|Backup-Codes|'
    r'Kode cadangan|Yedek kodlar|Codici di backup)',
    re.I
)

RE_ADD_MORE_SECTION = re.compile(
    r'(?:您还可以添加其他登录选项|您可以新增其他登入選項|其他登录选项|'
    r'You can add more sign-in options|Add more second steps|Other ways to sign in|'
    r'Bạn có thể thêm các tuỳ chọn đăng nhập khác|'
    r'Puedes añadir otras opciones para iniciar sesión|Puedes agregar más opciones para iniciar sesión|'
    r'Você pode adicionar outras opções de login|Outras maneiras de fazer login|'
    r'Другие способы входа|Вы можете добавить другие способы входа|'
    r'その他のログイン方法を追加できます|他のログイン オプションを追加できます|'
    r'다른 로그인 옵션을 추가할 수 있습니다|기타 로그인 방법|'
    r'Vous pouvez ajouter d\'autres options de connexion|'
    r'Sie können weitere Anmeldeoptionen hinzufügen)',
    re.I
)

RE_STATUS_ON = re.compile(
    r'(?:\bon\b|enabled|turned on|active|added|verified|'
    r'开启|已开启|启用|已启用|已添加|已验证|有效|启用时间|添加时间|'
    r'activad[oa]|activar|agregad[oa]|verificad[oa]|'
    r'ativad[oa]|adicionad[oa]|'
    r'включен[оа]|вкл|добавлен[оа]|подтвержден[оа]|'
    r'有効|オン|設定済み|追加日|追加済み|確認済み|'
    r'사용 중|설정됨|사용|추가됨|인증됨|'
    r'activé[e]?|ajouté[e]?|validé[e]?|'
    r'aktiviert|\bein\b|hinzugefügt|bestätigt|'
    r'bật|đang bật|bật từ|đã thêm|đã xác minh|'
    r'aktif|diaktifkan|ditambahkan|terverifikasi|'
    r'açık|etkin|eklendi|doğrulandı|'
    r'attiv[ao]|aggiunt[ao]|verificat[ao])',
    re.I
)

RE_STATUS_OFF = re.compile(
    r'(?:\boff\b|disabled|turned off|inactive|not added|not set|'
    r'关闭|未开启|未启用|停用|未添加|未设置|无|'
    r'desactivad[oa]|no se ha agregado|no se ha configurado|'
    r'desativad[oa]|não adicionad[oa]|não configurad[oa]|'
    r'отключен[оа]|выкл|не добавлен[оа]|не настроен[оа]|'
    r'無効|オフ|設定されていません|未設定|追加されていません|'
    r'사용 안함|사용 안 함|사용 중지|꺼짐|추가되지 않음|설정되지 않음|'
    r'désactivé[e]?|non configuré[e]?|non ajouté[e]?|'
    r'deaktiviert|\baus\b|nicht hinzugefügt|nicht eingerichtet|'
    r'tắt|chưa bật|chưa thêm|chưa thiết lập|'
    r'nonaktif|dinonaktifkan|belum ditambahkan|'
    r'kapalı|devre dışı|eklenmedi|'
    r'disattiv[ao]|non configurat[ao])',
    re.I
)

RE_BACKUP_COUNT = re.compile(
    r'(\d+)\s*(?:codes available|codes restants|codes disponibles|'
    r'códigos disponibles|códigos restantes|códigos disponíveis|códigos de segurança restantes|'
    r'доступных кодов|доступно|'
    r'利用可能なコード|個の利用可能なコード|利用可能なバックアップコード|'
    r'개 사용 가능|개 남음|'
    r'mã có thể dùng|mã khả dụng|'
    r'kode tersedia|kullanılabilir kod|codici disponibili|'
    r'个可用|剩余|条剩余|个剩余|个可用的验证码|remaining)',
    re.I
)

def extract_multilingual_date(text):
    if not text:
        return None
    # 1. Asian (YYYY年M月D日 or YYYY년 M월 D일)
    m = re.search(r'(\d{4})\s*(?:年|년)\s*(\d{1,2})\s*(?:月|월)\s*(\d{1,2})\s*(?:日|일)', text)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    # 2. Vietnamese (D tháng M, YYYY)
    m = re.search(r'(\d{1,2})\s*tháng\s*(\d{1,2}),?\s*(\d{4})', text, re.I)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"

    # 3. Day Month Year (e.g. 2 September 2026, 2 de septiembre de 2026, 2. September 2026, 2 сентября 2026)
    m = re.search(r'(\d{1,2})[.\s]+(?:de\s+)?([A-Za-z\u00C0-\u017F\u0400-\u04FF]+)[,\s]+(?:de\s+|d\'\s*)?(\d{4})', text)
    if m:
        d = int(m.group(1))
        mon_str = m.group(2).lower()
        y = m.group(3)
        if mon_str in MONTHS_MAP:
            return f"{y}-{MONTHS_MAP[mon_str]}-{d:02d}"

    # 4. Month Day Year (e.g. September 2, 2026)
    m = re.search(r'([A-Za-z\u00C0-\u017F\u0400-\u04FF]+)\s+(\d{1,2}),?\s+(\d{4})', text)
    if m:
        mon_str = m.group(1).lower()
        d = int(m.group(2))
        y = m.group(3)
        if mon_str in MONTHS_MAP:
            return f"{y}-{MONTHS_MAP[mon_str]}-{d:02d}"

    # 5. ISO / YYYY-MM-DD
    m = re.search(r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', text)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"

    return None

def parse_membership(text):
    status = "未开通"
    plan = "未填写"
    start_date = extract_multilingual_date(text)

    if not text:
        return status, plan, start_date

    # Normalize whitespace for multi-line and flex matching
    compact = re.sub(r'\s+', ' ', text)

    # Plan detection
    if re.search(r'AI\s*Ultra', compact, re.I):
        plan = 'AI Ultra'
        status = '有效'
    elif re.search(r'Google\s*AI\s*Pro|AI\s*Pro', compact, re.I):
        plan = 'AI Pro'
        status = '有效'
    elif re.search(r'AI\s*Plus|AI\s*Premium', compact, re.I):
        plan = 'AI Plus'
        status = '有效'
    elif re.search(r'Current plan|当前套餐|当前方案|当前计划|Member benefits|会员福利|Gói hiện tại|Plan actual|Plano atual|Текущий план|Текущий тариф|現在のプラン|현재 요금제|Forfait actuel|Aktueller Tarif|Paket saat ini|Geçerli plan|Piano attuale|Bieżący abonament|Huidig abonnement', compact, re.I) and (start_date or re.search(r'TB|GB', compact)):
        status = '有效'
        if re.search(r'Ultra', compact, re.I):
            plan = 'AI Ultra'
        elif re.search(r'Pro', compact, re.I) or re.search(r'2\s*TB|5\s*TB', compact, re.I):
            plan = 'AI Pro'
        elif re.search(r'Plus|Premium', compact, re.I):
            plan = 'AI Plus'
        else:
            plan = 'AI Pro'
    elif re.search(r'Google One\s*(?:会员|Member|membro|miembro|участник|メンバー|회원|membre|Mitglied)', compact, re.I):
        status = '有效'
        if re.search(r'Ultra', compact, re.I):
            plan = 'AI Ultra'
        else:
            plan = 'AI Pro'
    elif re.search(r'Upgrade to Google One|升级到 Google One|加入 Google One|Get Google One', compact, re.I) and not re.search(r'当前方案|当前套餐|成为会员|AI\s*Pro', compact):
        status = '未开通'
        plan = '免费'
    elif re.search(r'15\s*GB\s*(?:of\s*free\s*storage|免费存储空间)', compact, re.I) and not re.search(r'当前方案|当前套餐|成为会员|AI\s*Pro', compact):
        status = '未开通'
        plan = '免费'

    # Status modifiers
    if re.search(r'trial|试用|prueba|teste|пробный|無料試用|무료 체험|essai|Testversion', compact, re.I):
        status = '试用'
    elif re.search(r'cancelled|canceled|已取消|cancelada|cancelado|отменено|解約済み|취소됨|annulé|geküdigt', compact, re.I):
        status = '已取消但仍有效'
    elif re.search(r'expired|已到期|vencida|vencido|истек|期限切れ|만료됨|expiré|abgelaufen', compact, re.I):
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
                'args': args,
                'locale': 'zh-CN',
                'extra_http_headers': {
                    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            }
            if executable_path and os.path.isfile(executable_path):
                launch_kwargs['executable_path'] = executable_path
            else:
                launch_kwargs['channel'] = 'chrome'
                
            context = p.chromium.launch_persistent_context(**launch_kwargs)
            page = context.pages[0] if context.pages else context.new_page()
            
            page.goto('https://myaccount.google.com/security?hl=zh-CN', timeout=timeout_ms)
            page.wait_for_timeout(3500)
            
            # Read full body text
            text = page.locator('body').inner_text()

            # Inspect DOM links and positions for language-independent structural hints
            dom_hints = {}
            try:
                dom_hints = page.evaluate('''() => {
                    const hints = {};
                    const links = Array.from(document.querySelectorAll('a[href]'));
                    
                    const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, [role="heading"]'));
                    let addMorePos = 999999;
                    const addMoreRegex = /Bạn có thể thêm|您还可以添加|You can add more|Add more second steps|Other ways to sign in|Puedes añadir otras opciones|Você pode adicionar|Другие способы входа|その他のログイン方法|다른 로그인 옵션|Vous pouvez ajouter|Sie können weitere/i;
                    for (const h of headers) {
                        if (addMoreRegex.test(h.innerText || '')) {
                            addMorePos = h.getBoundingClientRect().top + window.scrollY;
                            break;
                        }
                    }

                    for (const a of links) {
                        const href = a.getAttribute('href') || '';
                        let p = a;
                        for (let k = 0; k < 4; k++) {
                            if (!p.parentElement) break;
                            p = p.parentElement;
                            if (p.tagName === 'LI' || p.getAttribute('role') === 'listitem' || p.getAttribute('jsname')) break;
                        }
                        const t = (p ? p.innerText : a.innerText).trim();
                        const aPos = a.getBoundingClientRect().top + window.scrollY;
                        
                        if (href.includes('/signinoptions/two-step-verification')) {
                            hints.two_step_verification = t;
                        } else if (href.includes('/signinoptions/rescue-email') || href.includes('/recovery/email')) {
                            hints.rescue_email = t;
                        } else if (href.includes('/signinoptions/rescue-phone') || href.includes('/recovery/phone')) {
                            hints.rescue_phone = t;
                        } else if (href.includes('authenticator')) {
                            hints.authenticator = t;
                        } else if (href.includes('backup-codes')) {
                            hints.backup_codes = t;
                            hints.backup_codes_in_add_more = (aPos >= addMorePos - 10);
                        } else if (href.includes('password-optional') || href.includes('passwordoptional')) {
                            hints.password_optional = t;
                        }
                    }
                    return hints;
                }''')
            except Exception:
                dom_hints = {}

            # Scrape Google One / Gemini membership
            # Baseline detection directly from security page (sidebar shows 'Google AI Pro 方案' and avatar has 'Google One 会员')
            sec_m_status, sec_m_plan, sec_m_date = parse_membership(text)
            membership_status = sec_m_status
            membership_plan = sec_m_plan
            membership_start_date = sec_m_date

            try:
                page.goto('https://one.google.com/?hl=zh-CN', timeout=22000)
                page.wait_for_timeout(2500)
                one_text = page.locator('body').inner_text()
                sub_st, sub_pl, sub_dt = parse_membership(one_text)
                if sub_st != '未开通' or sub_pl != '未填写':
                    membership_status = sub_st
                    membership_plan = sub_pl
                    if sub_dt:
                        membership_start_date = sub_dt
                elif membership_status == '未开通' and membership_plan == '未填写':
                    # Fallback check payments-and-subscriptions
                    try:
                        page.goto('https://myaccount.google.com/payments-and-subscriptions?hl=zh-CN', timeout=15000)
                        page.wait_for_timeout(2000)
                        pay_text = page.locator('body').inner_text()
                        p_st, p_pl, p_dt = parse_membership(pay_text)
                        if p_st != '未开通' or p_pl != '未填写':
                            membership_status = p_st
                            membership_plan = p_pl
                            if p_dt:
                                membership_start_date = p_dt
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
            
            in_add_more_section = bool(dom_hints.get('backup_codes_in_add_more'))

            # Robust semantic extraction
            for i, line in enumerate(lines):
                # Detect secondary / "add more options" section
                if RE_ADD_MORE_SECTION.search(line):
                    in_add_more_section = True

                # 1. 2-Step Verification
                if RE_2FA_TITLE.search(line):
                    lookahead = ' '.join(lines[i+1:min(i+4, len(lines))])
                    comb = (line + ' ' + lookahead).lower()
                    if RE_STATUS_OFF.search(comb):
                        result['two_factor_status'] = '关闭'
                    elif RE_STATUS_ON.search(comb):
                        result['two_factor_status'] = '开启'
                            
                # 2. Skip password when possible
                if RE_SKIP_PWD_TITLE.search(line):
                    lookahead = ' '.join(lines[i+1:min(i+4, len(lines))])
                    comb = (line + ' ' + lookahead).lower()
                    result['skip_password_status'] = '关闭' if RE_STATUS_OFF.search(comb) else '开启'
                        
                # 3. Recovery phone
                if RE_REC_PHONE_TITLE.search(line):
                    for next_val in lines[i+1:min(i+4, len(lines))]:
                        if re.search(r'添加手机号码|添加电话号码|Add a phone|Add phone|Thêm số điện thoại|Añadir un teléfono|Adicionar telefone|Добавить номер|電話番号を追加|전화번호 추가|Ajouter un téléphone', next_val, re.I):
                            result['has_recovery_phone'] = '无'
                            result['recovery_phone'] = None
                            result['recovery_phone_verified'] = '未填写'
                            break
                        else:
                            phone_m = re.search(r'([+0-9\s-]{6,20})', next_val)
                            if phone_m and len(phone_m.group(1).replace(' ', '').replace('-', '')) >= 7:
                                result['recovery_phone'] = phone_m.group(1).strip()
                                result['has_recovery_phone'] = '有'
                                result['recovery_phone_verified'] = '已验证'
                                break
                            
                # 4. 2-Step Verification phone
                if RE_2FA_PHONE_TITLE.search(line):
                    for next_val in lines[i+1:min(i+4, len(lines))]:
                        phone_m = re.search(r'([+0-9\s-]{6,20})', next_val)
                        if phone_m and len(phone_m.group(1).replace(' ', '').replace('-', '')) >= 7:
                            result['two_factor_phone'] = phone_m.group(1).strip()
                            if not result['recovery_phone'] and result['has_recovery_phone'] == '有':
                                result['recovery_phone'] = result['two_factor_phone']
                                result['recovery_phone_verified'] = '已验证'
                            break
                                
                # 5. Recovery email
                if RE_REC_EMAIL_TITLE.search(line):
                    for next_val in lines[i+1:min(i+4, len(lines))]:
                        email_m = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', next_val)
                        if email_m:
                            result['recovery_email'] = email_m.group(1).strip()
                            result['has_recovery_email'] = '有'
                            result['recovery_email_verified'] = '已验证'
                            break
                            
                # 6. Authenticator
                if RE_TOTP_TITLE.search(line):
                    lookahead = ' '.join(lines[i+1:min(i+4, len(lines))])
                    comb = (line + ' ' + lookahead).lower()
                    if RE_STATUS_OFF.search(comb):
                        result['totp_status'] = '关闭'
                        result['totp_added_at'] = None
                    elif RE_STATUS_ON.search(comb):
                        result['totp_status'] = '开启'
                        for next_raw in lines[i+1:min(i+4, len(lines))]:
                            m_date = re.search(r'(?:添加时间[：:]|已添加[：:]?|Added\s*|Đã thêm\s*|Agregado el\s*|Añadido el\s*|Ajouté le\s*|Adicionado em\s*|Hinzugefügt am\s*|Добавлено[：:]?\s*|追加日[：:]?\s*|추가됨[：:]?\s*)([^\n]+)', next_raw, re.I)
                            if m_date:
                                result['totp_added_at'] = m_date.group(1).strip()
                                break
                            else:
                                m_cn = re.search(r'(\d{1,4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日|\d{1,2}\s*月\s*\d{1,2}\s*日|[A-Za-z]+\s+\d{1,2}|\d{1,2}\s*thg\s*\d{1,2})', next_raw)
                                if m_cn:
                                    result['totp_added_at'] = m_cn.group(1).strip()
                                    break
                            
                # 7. Backup codes
                if RE_BACKUP_TITLE.search(line):
                    if in_add_more_section or dom_hints.get('backup_codes_in_add_more'):
                        result['backup_codes_status'] = '关闭'
                        result['backup_codes_remaining'] = 0
                    else:
                        rem = RE_BACKUP_COUNT.search(line)
                        if not rem:
                            for next_l in lines[i+1:min(i+4, len(lines))]:
                                rem = RE_BACKUP_COUNT.search(next_l)
                                if rem:
                                    break
                        if rem:
                            result['backup_codes_status'] = '开启'
                            result['backup_codes_remaining'] = int(rem.group(1))
                        else:
                            lookahead = ' '.join(lines[i+1:min(i+4, len(lines))]).lower()
                            if RE_STATUS_OFF.search(lookahead):
                                result['backup_codes_status'] = '关闭'
                                result['backup_codes_remaining'] = 0
                            else:
                                result['backup_codes_status'] = '开启'
                                result['backup_codes_remaining'] = 10

            # Reconcile with DOM structural hints if text parser missed anything
            if dom_hints.get('backup_codes_in_add_more'):
                result['backup_codes_status'] = '关闭'
                result['backup_codes_remaining'] = 0

            if not result['recovery_email'] and dom_hints.get('rescue_email'):
                email_m = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', dom_hints['rescue_email'])
                if email_m:
                    result['recovery_email'] = email_m.group(0).strip()
                    result['has_recovery_email'] = '有'
                    result['recovery_email_verified'] = '已验证'

            if not result['recovery_phone'] and dom_hints.get('rescue_phone'):
                phone_m = re.search(r'([+0-9\s-]{6,20})', dom_hints['rescue_phone'])
                if phone_m and len(phone_m.group(1).replace(' ', '').replace('-', '')) >= 7:
                    result['recovery_phone'] = phone_m.group(1).strip()
                    result['has_recovery_phone'] = '有'
                    result['recovery_phone_verified'] = '已验证'

            # Fallback scan for recovery email if missed
            if not result['recovery_email']:
                emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
                valid = [e for e in emails if not e.endswith('@google.com') and 'myaccount' not in e and (not account_email or e.lower() != account_email.lower())]
                if valid:
                    result['recovery_email'] = valid[0]
                    result['has_recovery_email'] = '有'
                    result['recovery_email_verified'] = '已验证'
                        
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
