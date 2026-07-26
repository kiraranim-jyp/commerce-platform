"use client";

import { useState } from "react";
import type { ReadinessField, ReadinessReport } from "@commerce/listing";

const STATUS_ICON: Record<ReadinessField["status"], string> = {
  VALID: "✓",
  WARNING: "⚠",
  ERROR: "❌",
};

const STATUS_CLASS: Record<ReadinessField["status"], string> = {
  VALID: "text-success",
  WARNING: "text-warning",
  ERROR: "text-error",
};

const FIXABLE_TEXT_FIELDS: Record<string, { placeholder: string }> = {
  countryOfOrigin: { placeholder: "예: 대한민국, 스페인" },
  returnPolicy: { placeholder: "예: 수령 후 7일 이내 무료 반품" },
};

const FIXABLE_NUMBER_FIELDS: Record<string, { placeholder: string; unit: string }> = {
  shippingFee: { placeholder: "0", unit: "원" },
  stockQuantity: { placeholder: "999", unit: "개" },
};

export function ReadinessScorePanel({
  report,
  onFixTextField,
  onFixNumberField,
}: {
  report: ReadinessReport;
  onFixTextField: (field: "countryOfOrigin" | "returnPolicy", value: string) => void;
  onFixNumberField: (field: "shippingFee" | "stockQuantity", value: number) => void;
}) {
  const scoreClassName =
    report.score >= 80 ? "text-success" : report.score >= 50 ? "text-warning" : "text-error";

  return (
    <section className="rounded-lg border border-border bg-surface p-4 text-sm shadow-subtle">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-text-primary">등록 준비도</h3>
        <span className={`text-2xl font-semibold tabular-nums ${scoreClassName}`}>
          {report.score}%
        </span>
      </div>
      <p className="mt-1 text-xs text-text-secondary">
        필수 항목 {report.requiredPassed} / {report.requiredTotal} · 주의 {report.warningCount}개 ·
        누락 {report.errorCount}개
      </p>

      <ul className="mt-4 space-y-2">
        {report.fields.map((field) => (
          <ReadinessRow
            key={field.field}
            field={field}
            onFixTextField={onFixTextField}
            onFixNumberField={onFixNumberField}
          />
        ))}
      </ul>
    </section>
  );
}

function ReadinessRow({
  field,
  onFixTextField,
  onFixNumberField,
}: {
  field: ReadinessField;
  onFixTextField: (field: "countryOfOrigin" | "returnPolicy", value: string) => void;
  onFixNumberField: (field: "shippingFee" | "stockQuantity", value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isOk = field.status === "VALID";
  const textFixable = FIXABLE_TEXT_FIELDS[field.field];
  const numberFixable = FIXABLE_NUMBER_FIELDS[field.field];

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 font-bold ${STATUS_CLASS[field.status]}`}>
          {STATUS_ICON[field.status]}
        </span>
        <div className="flex-1">
          <span className="font-medium text-text-primary">{field.label}</span>
          {field.message && !isOk && (
            <span className="ml-2 text-xs text-text-secondary">{field.message}</span>
          )}
        </div>
        {!isOk && field.resolution && (textFixable || numberFixable) && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-background"
          >
            {field.resolution}
          </button>
        )}
      </div>

      {editing && textFixable && (
        <InlineTextFix
          placeholder={textFixable.placeholder}
          onSave={(value) => {
            onFixTextField(field.field as "countryOfOrigin" | "returnPolicy", value);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
      {editing && numberFixable && (
        <InlineNumberFix
          placeholder={numberFixable.placeholder}
          unit={numberFixable.unit}
          onSave={(value) => {
            onFixNumberField(field.field as "shippingFee" | "stockQuantity", value);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </li>
  );
}

function InlineTextFix({
  placeholder,
  onSave,
  onCancel,
}: {
  placeholder: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="ml-6 flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="flex-1 rounded-md border border-border px-2 py-1 text-xs text-text-primary focus:border-primary focus:outline-none"
      />
      <button
        type="button"
        onClick={() => value.trim() && onSave(value.trim())}
        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-hover"
      >
        저장
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-background"
      >
        취소
      </button>
    </div>
  );
}

function InlineNumberFix({
  placeholder,
  unit,
  onSave,
  onCancel,
}: {
  placeholder: string;
  unit: string;
  onSave: (value: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="ml-6 flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="w-28 rounded-md border border-border px-2 py-1 text-xs text-text-primary focus:border-primary focus:outline-none"
      />
      <span className="text-xs text-text-secondary">{unit}</span>
      <button
        type="button"
        onClick={() => value !== "" && onSave(Number(value))}
        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-hover"
      >
        저장
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-background"
      >
        취소
      </button>
    </div>
  );
}
