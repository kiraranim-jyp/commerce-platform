import crypto from "node:crypto";

export function hashString(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
