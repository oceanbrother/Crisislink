/**
 * ECDHE Chat Cryptography — CrisisLink
 *
 * Key-exchange protocol (per chat session):
 *   1. Each party generates a fresh ephemeral EC P-256 key pair.
 *   2. Public keys are exchanged via the server (server never sees private keys).
 *   3. Both parties independently compute:
 *        sharedBits = ECDH(myEphemeralPrivate, theirEphemeralPublic)
 *   4. The raw shared bits are fed through HKDF-SHA256 to derive a 256-bit AES-GCM key:
 *        aesKey = HKDF(
 *          ikm   = sharedBits,
 *          salt  = UTF-8(listingId),
 *          info  = UTF-8(donorOrgCode + "|" + claimerOrgCode + "|" + listingId)
 *        )
 *      The org codes in the `info` field bind the key to this specific
 *      donor–organisation pair, so the same ECDH output with different
 *      org codes produces a different AES key.
 *   5. Messages are encrypted with AES-256-GCM (random 96-bit IV per message).
 *   6. When the session ends (food collected), the ephemeral private key is
 *      removed from memory — no key material persists (forward secrecy).
 *
 * All operations use the browser's built-in Web Crypto API (crypto.subtle).
 */

// ── Key generation ────────────────────────────────────────────────────────────

/**
 * Generate a fresh ephemeral EC P-256 key pair for this chat session.
 * Returns a CryptoKeyPair { privateKey, publicKey }.
 */
export async function generateEphemeralKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,                            // exportable (we need to send the public key)
    ['deriveBits']
  )
}

// ── Key serialisation ─────────────────────────────────────────────────────────

/**
 * Export the public key of a key pair as a JWK object (safe to send to server).
 */
export async function exportPublicKeyJwk(keyPair) {
  return crypto.subtle.exportKey('jwk', keyPair.publicKey)
}

/**
 * Import a JWK public key object back into a CryptoKey for ECDH operations.
 */
export async function importPublicKeyJwk(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []  // public key has no key-usages in the derivation step
  )
}

// ── Shared key derivation ─────────────────────────────────────────────────────

/**
 * Derive the session AES-256-GCM key from:
 *   - myPrivateKey       : the caller's ephemeral EC private key
 *   - theirPublicKey     : the other party's ephemeral EC public key
 *   - donorOrgCode       : org code of the donor who posted the listing
 *   - claimerOrgCode     : org code of the community organisation that claimed it
 *   - listingId          : UUID of the food listing (used as HKDF salt)
 *
 * The derived key is non-extractable — it can only be used for encrypt/decrypt.
 */
export async function deriveSharedKey(
  myPrivateKey,
  theirPublicKey,
  donorOrgCode,
  claimerOrgCode,
  listingId
) {
  // Step 1 — raw ECDH shared secret (256 bits)
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    256
  )

  // Step 2 — import raw bytes as HKDF source key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedBits,
    'HKDF',
    false,
    ['deriveKey']
  )

  // Step 3 — HKDF-SHA256 with org codes as context (the "based on org codes" requirement)
  const enc = new TextEncoder()
  const salt = enc.encode(listingId)
  const info = enc.encode(`${donorOrgCode}|${claimerOrgCode}|${listingId}`)

  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,          // non-extractable — key bytes never leave the browser
    ['encrypt', 'decrypt']
  )
}

// ── Message encryption / decryption ──────────────────────────────────────────

/**
 * Encrypt a UTF-8 plaintext string with AES-256-GCM.
 * Returns { ciphertext: string (base64), iv: string (base64) }.
 * A fresh random 96-bit IV is generated for every message.
 */
export async function encryptMessage(aesKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  )
  return {
    ciphertext: _bufToBase64(cipherBuf),
    iv:         _bufToBase64(iv.buffer),
  }
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext back to a UTF-8 string.
 * Throws if the key or ciphertext is wrong (GCM authentication tag fails).
 */
export async function decryptMessage(aesKey, ciphertextB64, ivB64) {
  const cipherBuf = _base64ToBuf(ciphertextB64)
  const iv        = _base64ToBuf(ivB64)
  const plainBuf  = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    cipherBuf
  )
  return new TextDecoder().decode(plainBuf)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _bufToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  // Chunk to avoid call-stack overflow on large messages
  let binary = ''
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function _base64ToBuf(base64) {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
