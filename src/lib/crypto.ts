/**
 * Utilitaires de chiffrement pour stocker les credentials de manière sécurisée
 * Utilise Web Crypto API avec AES-GCM et PBKDF2
 */

const SALT_KEY = 'garmin_salt';
const CREDENTIALS_KEY = 'garmin_credentials_encrypted';
const EXPIRY_KEY = 'garmin_credentials_expiry';

// Durée de validité des credentials (1 heure en ms)
const CREDENTIALS_TTL = 60 * 60 * 1000;

// Génère un sel aléatoire (stocké en localStorage, pas secret)
function getSalt(): Uint8Array {
  const existingSalt = localStorage.getItem(SALT_KEY);
  if (existingSalt) {
    return new Uint8Array(JSON.parse(existingSalt));
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, JSON.stringify(Array.from(salt)));
  return salt;
}

// Dérive une clé AES à partir du PIN
async function deriveKey(pin: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = getSalt();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Chiffre les credentials avec le PIN
export async function encryptCredentials(
  email: string,
  password: string,
  pin: string
): Promise<void> {
  const key = await deriveKey(pin);
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify({ email, password }));

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data as BufferSource
  );

  const payload = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };

  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(payload));
  // Sauvegarder la date d'expiration
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + CREDENTIALS_TTL));
}

// Déchiffre les credentials avec le PIN
export async function decryptCredentials(
  pin: string
): Promise<{ email: string; password: string } | null> {
  const stored = localStorage.getItem(CREDENTIALS_KEY);
  if (!stored) return null;

  try {
    const { iv, data } = JSON.parse(stored);
    const key = await deriveKey(pin);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) as BufferSource },
      key,
      new Uint8Array(data) as BufferSource
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch {
    // PIN incorrect ou données corrompues
    return null;
  }
}

// Vérifie si des credentials chiffrés existent et sont valides
export function hasEncryptedCredentials(): boolean {
  const credentials = localStorage.getItem(CREDENTIALS_KEY);
  if (!credentials) return false;

  // Vérifier l'expiration
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (expiry && Date.now() > Number(expiry)) {
    // Credentials expirés, les supprimer
    clearEncryptedCredentials();
    return false;
  }

  return true;
}

// Supprime les credentials chiffrés
export function clearEncryptedCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
  localStorage.removeItem(SALT_KEY);
  localStorage.removeItem(EXPIRY_KEY);
}
