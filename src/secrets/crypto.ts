import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { isRecord } from "../utils/type-guards.js";

export const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_BYTE_LENGTH = 12;

export interface SecretsEnvelope {
  version: number;
  algorithm: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

export function deriveKey(masterKey: string): Buffer {
  return createHash("sha256").update(masterKey, "utf8").digest();
}

export function encodeEnvelope(envelope: SecretsEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function parseEnvelope(source: string): SecretsEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new Error("secrets envelope is not valid JSON");
  }
  if (!isRecord(parsed)) {
    throw new Error("secrets envelope must be a JSON object");
  }

  const version = parsed.version;
  const algorithm = parsed.algorithm;
  const iv = parsed.iv;
  const authTag = parsed.authTag;
  const ciphertext = parsed.ciphertext;

  if (version !== 1) {
    throw new Error(`unsupported secrets envelope version: ${String(version)}`);
  }
  if (algorithm !== ENCRYPTION_ALGORITHM) {
    throw new Error(`unsupported secrets algorithm: ${String(algorithm)}`);
  }
  if (typeof iv !== "string" || typeof authTag !== "string" || typeof ciphertext !== "string") {
    throw new TypeError("secrets envelope contains invalid binary fields");
  }

  return {
    version,
    algorithm,
    iv,
    authTag,
    ciphertext,
  };
}

export function encryptText(plaintext: string, key: Buffer): SecretsEnvelope {
  const iv = randomBytes(IV_BYTE_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: ENCRYPTION_ALGORITHM,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptText(envelope: SecretsEnvelope, key: Buffer): string {
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(envelope.iv, "base64"), {
    authTagLength: 16,
  });
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}
