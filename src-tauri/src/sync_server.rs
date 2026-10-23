use std::net::TcpListener;
use std::io::{Read, Write};
use parking_lot::Mutex;
use crate::commands::ScrapedSecurityData;

pub static LATEST_SYNCED_DATA: Mutex<Option<ScrapedSecurityData>> = Mutex::new(None);

pub fn start_sync_server() {
    std::thread::spawn(|| {
        let listener = match TcpListener::bind("127.0.0.1:18299") {
            Ok(l) => l,
            Err(e) => {
                log::warn!("Could not bind sync server on port 18299: {}", e);
                return;
            }
        };

        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let mut buffer = [0u8; 16384];
                if let Ok(bytes_read) = stream.read(&mut buffer) {
                    if bytes_read == 0 {
                        continue;
                    }
                    let req_str = String::from_utf8_lossy(&buffer[..bytes_read]);

                    // Handle CORS Preflight OPTIONS
                    if req_str.starts_with("OPTIONS") {
                        let resp = "HTTP/1.1 200 OK\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
Access-Control-Allow-Headers: *\r\n\
Access-Control-Allow-Private-Network: true\r\n\
Content-Length: 0\r\n\
Connection: close\r\n\r\n";
                        let _ = stream.write_all(resp.as_bytes());
                        let _ = stream.flush();
                        continue;
                    }

                    // Handle POST /sync
                    if req_str.starts_with("POST") {
                        if let Some(body_start) = req_str.find("\r\n\r\n") {
                            let body = &req_str[body_start + 4..];
                            // Trim trailing null bytes or whitespace
                            let body_clean = body.trim_end_matches('\0').trim();
                            if let Ok(data) = serde_json::from_str::<ScrapedSecurityData>(body_clean) {
                                *LATEST_SYNCED_DATA.lock() = Some(data);
                            }
                        }
                        let resp = "HTTP/1.1 200 OK\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Private-Network: true\r\n\
Content-Type: application/json\r\n\
Content-Length: 15\r\n\
Connection: close\r\n\r\n\
{\"status\":\"ok\"}";
                        let _ = stream.write_all(resp.as_bytes());
                        let _ = stream.flush();
                        continue;
                    }

                    // Handle GET /sync
                    if req_str.starts_with("GET /sync") {
                        let lock = LATEST_SYNCED_DATA.lock();
                        let json_str = match lock.as_ref() {
                            Some(d) => serde_json::to_string(d).unwrap_or_else(|_| "{}".to_string()),
                            None => "null".to_string(),
                        };
                        let resp = format!(
                            "HTTP/1.1 200 OK\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Private-Network: true\r\n\
Content-Type: application/json\r\n\
Content-Length: {}\r\n\
Connection: close\r\n\r\n{}",
                            json_str.len(),
                            json_str
                        );
                        let _ = stream.write_all(resp.as_bytes());
                        let _ = stream.flush();
                        continue;
                    }
                }
            }
        }
    });
}

pub fn get_latest_synced() -> Option<ScrapedSecurityData> {
    LATEST_SYNCED_DATA.lock().clone()
}

pub fn clear_latest_synced() {
    *LATEST_SYNCED_DATA.lock() = None;
}
