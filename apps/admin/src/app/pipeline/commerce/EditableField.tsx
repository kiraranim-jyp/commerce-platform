"use client";

import { useState } from "react";

interface EditableTextProps {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
}

const DEFAULT_INPUT_CLASS =
  "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-zinc-200 focus:border-zinc-400 focus:bg-white focus:outline-none";

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
    />
  );
}

export function EditableTextarea({ value, onCommit, placeholder, className }: EditableTextProps) {
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
      rows={4}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      className={className ?? `${DEFAULT_INPUT_CLASS} resize-y`}
    />
  );
}
