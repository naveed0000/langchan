import { randomUUID } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function generateExecutionId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `GEN-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function generateId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}
