/**
 * Crypto utility for encrypting/decrypting sensitive data like MFA secrets
 * 
 * Uses AES-256-GCM (Galois/Counter Mode) which provides:
 * - Authentication (integrity verification)
 * - Confidentiality (encryption)
 * - Resistance to nonce reuse attacks
 * 
 * NEVER commit the MFA_ENCRYPTION_KEY to git.
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * Store in: .env file, Vercel env vars, AWS Secrets Manager, etc.
 */

const crypto = require('crypto');

// Validate key exists and is correct length
const getKey = () => {
  const keyHex = process.env.MFA_ENCRYPTION_KEY;
  
  if (!keyHex) {
    throw new Error('MFA_ENCRYPTION_KEY not set in environment variables');
  }
  
  if (keyHex.length !== 64) {
    throw new Error('MFA_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  }
  
  return Buffer.from(keyHex, 'hex');
};

/**
 * Encrypt plaintext using AES-256-GCM
 * 
 * @param {string} text - Plaintext to encrypt
 * @returns {string} Base64-encoded ciphertext (iv:authTag:encrypted)
 */
const encrypt = (text) => {
  if (!text) return null;
  
  const key = getKey();
  const iv = crypto.randomBytes(12); // 12 bytes for GCM (96 bits is optimal)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv (12 bytes) + authTag (16 bytes) + encrypted
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  return combined.toString('base64');
};

/**
 * Decrypt ciphertext encrypted with AES-256-GCM
 * 
 * @param {string} payload - Base64-encoded ciphertext from encrypt()
 * @returns {string} Decrypted plaintext
 * @throws {Error} If decryption fails or auth tag verification fails
 */
const decrypt = (payload) => {
  if (!payload) return null;
  
  const key = getKey();
  const data = Buffer.from(payload, 'base64');
  
  // Extract components
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28); // GCM auth tag is 16 bytes
  const encrypted = data.subarray(28);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error('Decryption failed - data may be corrupted or tampered');
  }
};

/**
 * Hash a value using SHA-256 (for backup codes, etc.)
 * 
 * @param {string} value - Value to hash
 * @returns {string} Hex-encoded hash
 */
const hashValue = (value) => {
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest('hex');
};

/**
 * Generate a random token
 * 
 * @param {number} bytes - Number of random bytes
 * @returns {string} Hex-encoded random string
 */
const generateRandomToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

module.exports = {
  encrypt,
  decrypt,
  hashValue,
  generateRandomToken
};
