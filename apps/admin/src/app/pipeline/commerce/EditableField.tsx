"use client";

import { useState } from "react";

interface EditableTextProps {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
}

interface EditableTextareaProps extends EditableTextProps {
  rows?: number;
}

const DEFAULT_INPUT_CLASS =
  "w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-text-primary hover:border-border focus:border-primary focus:bg-surface focus:outline-none";

/**
 * 값을 controlled draft로 들고 있다가 blur 시점에만 onCommit을 호출한다 — 키 입력마다
 * CanonicalProduct 상태를 갱신하면 플랫폼 탭 전체가 매 타이핑마다 리렌더된다.
 * value가 외부(탭 전환, 다른 필드 편집)에서 바뀌면 draft를 다시 동기화해야 하는데,
 * 이펙트에서 setState하면 캐스케이딩 렌더 경고가 나므로 렌더 중 state 조정 패턴을
 * 쓴다(React 공식 문서의 "prop 변경 시 state 조정" 패턴).
 */
export function EditableText({ value, onCommit, placeholder, className }: EditableTextProps) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      className={className ?? DEFAULT_INPUT_CLASS}
      data-draft-field="true"
    />
  );
}

/**
 * Sprint P2(CPO 지시, 2026-08-19: "KC 취득일자를 텍스트 입력이 아니라
 * 캘린더 선택으로") — <input type="date">는 브라우저 네이티브 달력
 * picker를 제공하면서도 value/onChange가 그대로 "YYYY-MM-DD" 문자열이라
 * CanonicalProductCertification.certificationDate(string) 저장 형식과
 * 변환 없이 맞는다. onCommit 시점(blur)만 EditableText와 같은 패턴을
 * 따른다 — 타이핑(달력 선택)마다 상위 상태를 갱신하지 않는다.
 */
export function EditableDate({ value, onCommit, className }: Omit<EditableTextProps, "placeholder">) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  return (
    <input
      type="date"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        // 네이티브 date input은 값이 확정된 순간(달력에서 날짜 클릭, 또는
        // 키보드로 완전한 날짜 입력 완료)에만 change가 발생한다 — 텍스트
        // 입력처럼 "타이핑 중" 상태가 없어 EditableText와 달리 blur를
        // 기다리지 않고 바로 onCommit해도 매 키 입력마다 갱신되는 문제가
        // 없다.
        if (e.target.value !== value) onCommit(e.target.value);
      }}
      className={className ?? DEFAULT_INPUT_CLASS}
      data-draft-field="true"
    />
  );
}

export function EditableTextarea({ value, onCommit, placeholder, className, rows }: EditableTextareaProps) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }

  return (
    <textarea
      value={draft}
      placeholder={placeholder}
      rows={rows ?? 4}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      className={className ?? `${DEFAULT_INPUT_CLASS} resize-y`}
      data-draft-field="true"
    />
  );
}
