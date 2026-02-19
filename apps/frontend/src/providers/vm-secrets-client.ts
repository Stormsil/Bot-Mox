import { apiPost } from '../services/apiClient';
import type { SecretBinding, SecretMeta } from '../types';

const SECRETS_PREFIX = '/api/v1/secrets';
const LOCAL_KEY_STORAGE_KEY = 'botmox.secrets.local_key';
const ALG = 'aes-256-gcm';
const KEY_ID = 'local-browser-key-v1';

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

async function getOrCreateLocalKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(LOCAL_KEY_STORAGE_KEY);
  if (stored) {
    const raw = Uint8Array.from(atob(stored), (char) => char.charCodeAt(0));
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);

  const exported = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(LOCAL_KEY_STORAGE_KEY, toBase64(exported));
  return key;
}

async function encryptValue(
  plaintext: string,
): Promise<{ ciphertext: string; nonce: string; alg: string; key_id: string }> {
  const key = await getOrCreateLocalKey();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, encoded);

  return {
    ciphertext: toBase64(encrypted),
    nonce: toBase64(nonce.buffer as ArrayBuffer),
    alg: ALG,
    key_id: KEY_ID,
  };
}

async function storeSecret(label: string, plaintext: string): Promise<SecretMeta> {
  const { ciphertext, nonce, alg, key_id } = await encryptValue(plaintext);
  const { data } = await apiPost<SecretMeta>(SECRETS_PREFIX, {
    label,
    ciphertext,
    nonce,
    alg,
    key_id,
  });
  return data;
}

async function rotateSecret(secretId: string, plaintext: string): Promise<SecretMeta> {
  const { ciphertext, nonce, alg, key_id } = await encryptValue(plaintext);
  const { data } = await apiPost<SecretMeta>(`${SECRETS_PREFIX}/${secretId}/rotate`, {
    ciphertext,
    nonce,
    alg,
    key_id,
  });
  return data;
}

async function createBinding(params: {
  scope_type: string;
  scope_id: string;
  secret_ref: string;
  field_name: string;
}): Promise<SecretBinding> {
  const { data } = await apiPost<SecretBinding>(`${SECRETS_PREFIX}/bindings`, params);
  return data;
}

export async function setVmSettingsSecret(
  fieldName: string,
  plaintext: string,
  existingSecretRef?: string,
): Promise<SecretBinding> {
  let secret: SecretMeta;
  if (existingSecretRef) {
    secret = await rotateSecret(existingSecretRef, plaintext);
  } else {
    secret = await storeSecret(`vm_settings.${fieldName}`, plaintext);
  }

  return createBinding({
    scope_type: 'vm_settings',
    scope_id: 'vmgenerator',
    secret_ref: secret.id,
    field_name: fieldName,
  });
}
