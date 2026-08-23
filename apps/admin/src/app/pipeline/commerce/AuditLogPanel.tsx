"use client";

import { useEffect, useState } from "react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

type AuditEventType =
  | "PRODUCT_UPDATED"
  | "PRICE_UPDATED"
  | "ATTRIBUTE_UPDATED"
  | "MARKETPLACE_REGISTERED"
  | "MARKETPLACE_FAILED"
  | "SETTING_UPDATED";

interface AuditLogRecord {
  id: string;
  eventType: AuditEventType;
  actor: string;
  marketplace: string | null;
  field: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string | null;
  createdAt: string;
}

interface AuditLogResponse {
  ok: boolean;
  entries: AuditLogRecord[];
}

const EVENT_TYPE_LABEL: Record<AuditEventType, string> = {
  PRODUCT_UPDATED: "상품정보 수정",
  PRICE_UPDATED: "가격 수정",
  ATTRIBUTE_UPDATED: "상품속성 수정",
  MARKETPLACE_REGISTERED: "등록 성공",
  MARKETPLACE_FAILED: "등록 실패",
  SETTING_UPDATED: "설정 변경",
};

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * N-4.08-5(대표님 지시: "Audit Log UI") — recordAuditLog()가 이미 등록성공/실패/
 * 가격변경 등 시점에 기록하고 있던 audit_log(마이그레이션 028)를, 처음으로
 * 화면에 보여준다. 새 기록 지점을 추가하지 않는다 — 순수 읽기 전용 뷰어.
 */
export function AuditLogPanel({ snapshotId }: { snapshotId: string }) {
  const [entries, setEntries] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/audit-log/${snapshotId}`)
      .then((res) => res.json())
      .then((json: AuditLogResponse) => {
        if (!cancelled) setEntries(json.ok ? json.entries : []);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [snapshotId]);

  if (loading) return null;
  if (entries.length === 0) return null;

  return (
    <CollapsibleSection title={`변경 이력 (${entries.length})`}>
      <ul className="space-y-2 text-xs">
        {entries.map((entry) => {
          const before = formatValue(entry.beforeValue);
          const after = formatValue(entry.afterValue);
          return (
            <li key={entry.id} className="rounded-md border border-border bg-background p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-text-primary">
                  {EVENT_TYPE_LABEL[entry.eventType]}
                  {entry.marketplace ? ` · ${entry.marketplace}` : ""}
                  {entry.field ? ` · ${entry.field}` : ""}
                </span>
                <span className="text-[10px] text-text-tertiary">
                  {new Date(entry.createdAt).toLocaleString("ko-KR")}
                </span>
              </div>
              {(before || after) && (
                <p className="mt-1 text-text-secondary">
                  {before ? <span className="line-through">{before}</span> : null}
                  {before && after ? " → " : ""}
                  {after ?? ""}
                </p>
              )}
              {entry.reason && <p className="mt-1 text-text-tertiary">{entry.reason}</p>}
            </li>
          );
        })}
      </ul>
    </CollapsibleSection>
  );
}
