"use client";

import { useState } from "react";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12b(CTO 지시, 2026-09-25) — **이미 나가 있는데 «연결» 이 없다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * migration 063 «이전» 에 등록된 상품은 ChannelProduct 가 없다. 그래서 화면은
 * 「등록됨」이라고 말하면서도 수정으로 가지 못했고, 등록을 눌러도 중복 방지
 * 빗장에 막혀 «아무 일도 일어나지 않았다» — 대표님이 ₩156,900 으로 겪은 것이
 * 정확히 이 상태다(attempt 행조차 생기지 않는다).
 *
 * 🔴 자동으로 잇지 않는다. 근거(등록 이력의 상품번호)를 «보여주고» 사람이
 * 누른다. PHASE D-2 가 정한 「기존 snapshot 은 사람이 확인한 뒤에만 연결한다」를
 * 지키면서, 그 「확인」을 콘솔이나 SQL 이 아니라 «버튼» 으로 만든다.
 *
 * 🔴 두 단계다. 먼저 무엇을 할지 읽고(dry-run), 그 다음에 잇는다.
 * 한 번에 잇게 하면 「확인한 뒤에만」이 말뿐이 된다.
 */

interface LinkPlan {
  snapshotId: string;
  snapshotTitle: string | null;
  productId: string | null;
  successfulAttempts: number;
}

export interface LegacyLinkPanelProps {
  commerceId: string;
  commerceLabel: string;
  /** 등록 이력이 말하는 외부 상품번호. 없으면 이을 근거가 없다. */
  externalProductId: string | null;
  /** 연결이 끝나면 화면이 상태를 다시 읽게 한다. */
  onLinked: () => void;
}

type Phase =
  | { kind: "IDLE" }
  | { kind: "BUSY" }
  | { kind: "PLANNED"; plan: LinkPlan; alreadyLinked: boolean }
  /** 🔴 STOP 은 «실패» 가 아니라 「그렇게 하면 안 된다」이다. */
  | { kind: "STOPPED"; reason: string }
  | { kind: "DONE" };

export function LegacyLinkPanel({ commerceId, commerceLabel, externalProductId, onLinked }: LegacyLinkPanelProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "IDLE" });

  async function call(apply: boolean) {
    if (!externalProductId) return;
    setPhase({ kind: "BUSY" });
    try {
      const res = await fetch("/api/channel-products/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalProductId, channel: commerceId, ...(apply ? { apply: true } : {}) }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        stop?: string;
        result?: { alreadyLinked?: boolean; applied?: boolean; plan?: LinkPlan };
      };
      /* 🔴 서버가 준 STOP 문구를 «그대로» 보여준다. 화면이 「연결에 실패했습니다」
         같은 말로 덮으면, 무엇이 어긋났는지(다른 Product 에 붙어 있다 등)가
         사라진다 — 그 정보가 바로 사람이 판단할 근거다. */
      if (!data.ok) return setPhase({ kind: "STOPPED", reason: data.stop ?? "연결하지 못했습니다." });
      if (data.result?.applied || data.result?.alreadyLinked) {
        setPhase({ kind: "DONE" });
        onLinked();
        return;
      }
      setPhase({ kind: "PLANNED", plan: data.result!.plan!, alreadyLinked: false });
    } catch (error) {
      setPhase({ kind: "STOPPED", reason: error instanceof Error ? error.message : "서버에 연결하지 못했습니다." });
    }
  }

  if (phase.kind === "DONE") {
    return (
      <section data-testid="legacy-link" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="font-medium">{commerceLabel} 연결을 복구했습니다.</p>
        <p className="mt-1">이제 이 상품의 내용을 고치고 등록을 누르면 «기존 상품이 수정»됩니다.</p>
      </section>
    );
  }

  return (
    <section data-testid="legacy-link" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
      <h3 className="text-base font-semibold">{commerceLabel}에 이미 등록돼 있지만 연결 정보가 없습니다</h3>
      <p className="mt-2">
        등록 이력에는 상품번호 <strong>{externalProductId ?? "(확인 불가)"}</strong>가 남아 있는데, 저희 쪽 연결
        기록이 없습니다. 그래서 <strong>수정할 수도, 새로 만들 수도 없습니다</strong> — 새로 만들면 같은 상품이 하나 더
        생기기 때문에 막아 두었습니다.
      </p>
      {/* 🔴 무엇을 할지 먼저 말한다. 「복구」가 무슨 뜻인지 모르면 누를 수 없다. */}
      <p className="mt-2 text-xs text-orange-800">
        연결하면 이 상품번호를 «현재 연결»로 기록합니다. 스마트스토어의 상품 자체는 건드리지 않고, 등록 이력도 그대로
        둡니다.
      </p>

      {phase.kind === "PLANNED" && (
        <div className="mt-3 rounded-lg border border-orange-200 bg-white/80 p-3">
          <p className="font-medium">이렇게 잇습니다</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>상품: {phase.plan.snapshotTitle ?? "(제목 없음)"}</li>
            <li>근거: 성공한 등록 이력 {phase.plan.successfulAttempts}건</li>
            <li>{phase.plan.productId ? `기존 상품 정체성에 잇습니다` : "상품 정체성을 새로 만들어 잇습니다"}</li>
          </ul>
        </div>
      )}

      {phase.kind === "STOPPED" && (
        <div className="mt-3 rounded-lg border border-red-300 bg-white/80 p-3">
          {/* 🔴 서버가 멈춘 이유를 그대로. 덮어쓰지 않는다. */}
          <p className="font-medium text-red-900">잇지 않았습니다</p>
          <p className="mt-1 text-red-900">{phase.reason}</p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {phase.kind === "PLANNED" ? (
          <button
            type="button"
            onClick={() => void call(true)}
            className="rounded-lg bg-orange-600 px-3 py-2 font-medium text-white"
          >
            이대로 연결
          </button>
        ) : (
          <button
            type="button"
            disabled={phase.kind === "BUSY" || !externalProductId}
            onClick={() => void call(false)}
            className="rounded-lg bg-orange-600 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {phase.kind === "BUSY" ? "확인하는 중…" : "연결 확인"}
          </button>
        )}
      </div>
    </section>
  );
}
