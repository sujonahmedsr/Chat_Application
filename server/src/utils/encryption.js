const crypto = require('crypto');
const { JWT_SECRET } = require('../config/config');

// Server encryption key derived from JWT_SECRET or fixed master key
const MASTER_KEY = crypto.createHash('sha256').update(JWT_SECRET || 'shofi_chat_server_master_key_2026').digest();
const SERVER_PREFIX = 'srv:v1:';

/**
 * Server-level AES-256-GCM encryption
 * If message is already client-side E2EE ('enc:v1:'), it is stored as-is without double-encrypting.
 */
function encryptServerMessage(plainText) {
  if (!plainText || typeof plainText !== 'string' || !plainText.trim()) {
    return plainText || '';
  }

  // Already E2EE encrypted by client or server
  if (plainText.startsWith('enc:v1:') || plainText.startsWith(SERVER_PREFIX)) {
    return plainText;
  }

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${SERVER_PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[Server Encryption] Failed to encrypt:', err);
    return plainText;
  }
}

/**
 * Server-level AES-256-GCM decryption
 * If message is client-side E2EE ('enc:v1:'), it is left as-is so only client can decrypt it.
 */
function decryptServerMessage(cipherText) {
  if (!cipherText || typeof cipherText !== 'string') {
    return cipherText || '';
  }

  // If client-side E2EE, do not decrypt on server (preserve E2EE privacy)
  if (cipherText.startsWith('enc:v1:')) {
    return cipherText;
  }

  if (!cipherText.startsWith(SERVER_PREFIX)) {
    return cipherText;
  }

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 5) return cipherText; // srv:v1:iv:tag:cipher

    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encrypted = parts[4];

    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.error('[Server Decryption] Failed to decrypt:', err);
    return cipherText;
  }
}

module.exports = {
  encryptServerMessage,
  decryptServerMessage,
};
