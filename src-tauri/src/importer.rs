use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupCodesParseResult {
    pub detected_email: Option<String>,
    pub generation_date: Option<String>,
    pub codes: Vec<String>,
    pub total_detected: usize,
    pub duplicates_count: usize,
    pub warning_messages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuredImportRow {
    pub email: String,
    pub display_name: Option<String>,
    pub purpose: Option<String>,
    pub tags: Option<String>,
    pub password: Option<String>,
    pub two_factor_status: Option<String>,
    pub recovery_email: Option<String>,
    pub recovery_phone: Option<String>,
    pub gemini_plan: Option<String>,
    pub status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructuredImportResult {
    pub success_count: usize,
    pub skipped_count: usize,
    pub error_count: usize,
    pub messages: Vec<String>,
}

pub fn parse_google_backup_codes_text(raw_text: &str) -> BackupCodesParseResult {
    // 1. Strip BOM if present
    let text = raw_text.trim_start_matches('\u{feff}');

    let mut detected_email = None;
    let mut generation_date = None;
    let mut warning_messages = Vec::new();

    // Regex for email in text (e.g. (demo.user@gmail.com) or just email)
    let email_re = Regex::new(r"[\(\s]?([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)[\)\s]?").unwrap();
    if let Some(caps) = email_re.captures(text) {
        if let Some(m) = caps.get(1) {
            detected_email = Some(m.as_str().to_lowercase());
        }
    }

    // Regex for generation date (e.g. 这些验证码的生成时间：2026年10月20日 或 2026-10-20)
    let date_re = Regex::new(r"(?:生成时间|Generated|Date)[：:\s]*([0-9]{4}[年\-\/.][0-9]{1,2}[月\-\/.][0-9]{1,2}[日]?)").unwrap();
    if let Some(caps) = date_re.captures(text) {
        if let Some(m) = caps.get(1) {
            generation_date = Some(m.as_str().to_string());
        }
    }

    // Regex for Google backup code formats:
    // Format A: Optional sequence number like "1." or "10." followed by "1234 5678" or "12345678"
    // Examples: "1. 9738 3157", "10. 3522 2725", "9738 3157", "97383157"
    let code_pattern = Regex::new(r"(?:^|[\t\s,;])(?:(?:\d{1,2}\.|\(\d{1,2}\))\s*)?(\d{4}\s\d{4}|\d{8})(?:$|[\t\s,;])").unwrap();

    let mut seen = HashSet::new();
    let mut candidate_codes = Vec::new();
    let mut duplicates_count = 0;

    // Scan line by line to preserve sequence and avoid false positives
    for line in text.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() {
            continue;
        }

        // Skip lines that are instructions or headers
        if line_trimmed.starts_with("保存您的备用验证码") 
            || line_trimmed.starts_with("请将这些") 
            || line_trimmed.starts_with("* 每个备用") 
            || line_trimmed.starts_with("* 需要获取") {
            continue;
        }

        for caps in code_pattern.captures_iter(line) {
            if let Some(matched) = caps.get(1) {
                let code_raw = matched.as_str().trim();
                // Normalize code to "XXXX XXXX"
                let normalized = if code_raw.len() == 8 && !code_raw.contains(' ') {
                    format!("{} {}", &code_raw[0..4], &code_raw[4..8])
                } else {
                    code_raw.to_string()
                };

                if seen.contains(&normalized) {
                    duplicates_count += 1;
                } else {
                    seen.insert(normalized.clone());
                    candidate_codes.push(normalized);
                }
            }
        }
    }

    // Fallback: If no codes found with pattern, do broader 8-digit scan
    if candidate_codes.is_empty() {
        let broad_re = Regex::new(r"\b(\d{4}\s\d{4}|\d{8})\b").unwrap();
        for caps in broad_re.captures_iter(text) {
            if let Some(matched) = caps.get(1) {
                let code_raw = matched.as_str().trim();
                let normalized = if code_raw.len() == 8 && !code_raw.contains(' ') {
                    format!("{} {}", &code_raw[0..4], &code_raw[4..8])
                } else {
                    code_raw.to_string()
                };
                if !seen.contains(&normalized) {
                    seen.insert(normalized.clone());
                    candidate_codes.push(normalized);
                }
            }
        }
    }

    let total = candidate_codes.len();
    if total != 10 && total != 8 && total > 0 {
        warning_messages.push(format!("通常一组 Google 备用码为 10 条，当前共识别出 {} 条候选码，请核对。", total));
    }

    BackupCodesParseResult {
        detected_email,
        generation_date,
        codes: candidate_codes,
        total_detected: total,
        duplicates_count,
        warning_messages,
    }
}

pub fn parse_csv_accounts(csv_content: &str) -> Result<Vec<StructuredImportRow>, String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(true)
        .flexible(true)
        .from_reader(csv_content.as_bytes());

    let mut rows = Vec::new();
    let headers = reader.headers().map_err(|e| format!("CSV header error: {}", e))?.clone();

    // Find indices for common columns
    let find_idx = |names: &[&str]| -> Option<usize> {
        for (i, h) in headers.iter().enumerate() {
            let h_lower = h.trim().to_lowercase();
            for n in names {
                if h_lower == n.to_lowercase() {
                    return Some(i);
                }
            }
        }
        None
    };

    let email_idx = find_idx(&["email", "邮箱", "google邮箱", "账号", "account"])
        .ok_or_else(|| "CSV 必须包含邮箱列（例如 email、邮箱）".to_string())?;
    let name_idx = find_idx(&["name", "display_name", "备注名", "名称"]);
    let purpose_idx = find_idx(&["purpose", "用途"]);
    let tags_idx = find_idx(&["tags", "标签", "分组"]);
    let password_idx = find_idx(&["password", "密码"]);
    let two_fa_idx = find_idx(&["two_factor", "2fa", "两步验证", "两步验证状态"]);
    let rec_email_idx = find_idx(&["recovery_email", "辅助邮箱"]);
    let rec_phone_idx = find_idx(&["recovery_phone", "辅助电话", "辅助手机"]);
    let gemini_idx = find_idx(&["gemini", "gemini_plan", "订阅", "订阅套餐"]);
    let status_idx = find_idx(&["status", "账号状态", "状态"]);
    let notes_idx = find_idx(&["notes", "note", "备注", "说明"]);

    for result in reader.records() {
        let record = result.map_err(|e| format!("CSV record error: {}", e))?;
        let email = record.get(email_idx).unwrap_or("").trim().to_string();
        if email.is_empty() {
            continue;
        }

        let get_field = |idx_opt: Option<usize>| -> Option<String> {
            idx_opt.and_then(|idx| record.get(idx).map(|s| s.trim().to_string())).filter(|s| !s.is_empty())
        };

        rows.push(StructuredImportRow {
            email,
            display_name: get_field(name_idx),
            purpose: get_field(purpose_idx),
            tags: get_field(tags_idx),
            password: get_field(password_idx),
            two_factor_status: get_field(two_fa_idx),
            recovery_email: get_field(rec_email_idx),
            recovery_phone: get_field(rec_phone_idx),
            gemini_plan: get_field(gemini_idx),
            status: get_field(status_idx),
            notes: get_field(notes_idx),
        });
    }

    Ok(rows)
}
