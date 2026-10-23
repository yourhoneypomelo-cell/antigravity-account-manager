use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::rand_core::RngCore,
    Argon2, Params, Version,
};
use rand::rngs::OsRng;
use zeroize::{Zeroize, Zeroizing};

pub const SCHEMA_VERSION: i32 = 1;
pub const BACKUP_HEADER_MAGIC: &[u8; 8] = b"ACVAULT1";

pub fn generate_salt() -> String {
    let mut salt_bytes = [0u8; 16];
    OsRng.fill_bytes(&mut salt_bytes);
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, salt_bytes)
}

pub fn derive_key(password: &str, salt_b64: &str) -> Result<Zeroizing<Vec<u8>>, String> {
    let salt_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, salt_b64)
        .map_err(|e| format!("Invalid salt: {}", e))?;

    // Argon2id parameters: memory = 64MB, time = 3, parallelism = 2
    let params = Params::new(64 * 1024, 3, 2, Some(32))
        .map_err(|e| format!("Argon2 params error: {}", e))?;

    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);

    let mut output_key = [0u8; 32];
    argon2
        .hash_password_into(password.as_bytes(), &salt_bytes, &mut output_key)
        .map_err(|e| format!("Derivation error: {}", e))?;

    let zeroizing = Zeroizing::new(output_key.to_vec());
    output_key.zeroize();
    Ok(zeroizing)
}

pub fn key_to_hex(key: &[u8]) -> String {
    let mut hex = String::with_capacity(key.len() * 2);
    for b in key {
        hex.push_str(&format!("{:02x}", b));
    }
    hex
}

pub fn encrypt_backup_payload(payload: &[u8], password: &str) -> Result<Vec<u8>, String> {
    let salt = generate_salt();
    let key = derive_key(password, &salt)?;

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Cipher init error: {}", e))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, payload)
        .map_err(|e| format!("Encryption error: {}", e))?;

    let mut output = Vec::with_capacity(BACKUP_HEADER_MAGIC.len() + 2 + 16 + 12 + ciphertext.len());
    output.extend_from_slice(BACKUP_HEADER_MAGIC);
    
    let salt_bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &salt)
        .map_err(|e| format!("Salt error: {}", e))?;
    output.extend_from_slice(&(salt_bytes.len() as u16).to_be_bytes());
    output.extend_from_slice(&salt_bytes);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);

    Ok(output)
}

pub fn decrypt_backup_payload(data: &[u8], password: &str) -> Result<Vec<u8>, String> {
    if data.len() < BACKUP_HEADER_MAGIC.len() + 2 + 16 + 12 {
        return Err("Backup file too small or corrupted".to_string());
    }

    if &data[..8] != BACKUP_HEADER_MAGIC {
        return Err("Invalid backup file format (magic mismatch)".to_string());
    }

    let mut offset = 8;
    let salt_len = u16::from_be_bytes([data[offset], data[offset + 1]]) as usize;
    offset += 2;

    if data.len() < offset + salt_len + 12 {
        return Err("Invalid backup header length".to_string());
    }

    let salt_bytes = &data[offset..offset + salt_len];
    offset += salt_len;
    let salt_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, salt_bytes);

    let nonce_bytes = &data[offset..offset + 12];
    offset += 12;

    let ciphertext = &data[offset..];

    let key = derive_key(password, &salt_b64)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Cipher init error: {}", e))?;

    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed. Incorrect master password or damaged file.".to_string())?;

    Ok(plaintext)
}
