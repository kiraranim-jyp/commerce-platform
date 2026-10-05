"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { computeMasterReady, type MasterReadyResult } from "@/lib/master-ready";
import type { SourcingSignal } from "./workflow";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-C — ③ 소싱 선택 화면. **기존 ②④ API 를 그대로 «소비» 한다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 판정을 만들지 않는다:
 *   · 단계 문자열(`SOURCE_SELECTED` 등)을 지어내지 않는다 — 서버 `masterReady` 를 쓴다
 *   · `isSelected` 같은 파생 칸을 후보에 붙이지 않는다 — `selectedCandidateId` 와 대조한다
 *   · 품절이라고 선택을 풀지 않는다 — 경고만 보여준다
 *   · 후보가 하나뿐이어도, 새로 생겨도, 재분석돼도 «자동 선택하지 않는다»
 *
 * 🔴 네 상태를 섞지 않는다(CPO 확정):
 *
 *     productId = null              정체성이 없어 소싱을 «시작할 수 없다»
 *     productId 있음 + 후보 0        상품은 있고 후보가 아직 없다 — 직접 추가 가능
 *     후보 > 0 + selected = null     골라야 한다
 *     selected 있음                  Master 확정
 *
 * 첫째를 「소싱 후보가 없습니다」로 그리면 거짓이다 — 조사해서 없는 것이 아니다.
 */

/** ②의 `toCandidate()` 가 내보내는 모양 그대로. 🔴 여기서 칸을 더하지 않는다. */
interface Candidate {
  id: string;
  sourceKind: string | null;
  sourceUrl: string;
  sourceSite: string;
  sourceCountry: string | null;
  priceAmount: number | null;
  priceAmountRaw: string | null;
  currency: string | null;
  availability: string | null;
  shippingNote: string | null;
  originatingSnapshotId: string | null;
}

interface SelectionResponse {
  ok: boolean;
  selectedCandidateId?: string | null;
  candidateCount?: number;
  masterReady?: MasterReadyResult;
  registrationReadyEvaluated?: boolean;
  error?: string;
}

/**
 * 🔴 조회 결과를 **명시 태그 유니온**으로 적는다. 생략하면 TypeScript 가 여러
 * object literal 반환을 합치면서 없는 속성을 `optional undefined` 로 보정해,
 * 성공 분기에서도 `string | undefined` 가 섞인다 — 이번 스프린트에서 `resolve()`
 * 로 «이미 한 번» 겪은 함정이다(03-B ④ 라우트의 Resolved 타입).
 */
type SourcingLoad =
  | {
      ok: true;
      candidates: Candidate[];
      selectedId: string | null;
      masterReady: MasterReadyResult | null;
      readyEvaluated: boolean;
    }
  | { ok: false; message: string };

/** §19 — 상태코드별 기본 문구. 🔴 서버가 문장을 주면 «그것» 을 쓴다. */
function messageFor(status: number, serverError?: string): string {
  if (serverError) return serverError;
  if (status === 404) return "소싱 후보를 찾을 수 없습니다. 다시 확인해 주세요.";
  if (status === 409) return "현재 선택된 소싱처는 바로 삭제할 수 없습니다.";
  if (status === 422) return "소싱처 정보를 확인해 주세요.";
  return "소싱 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

const AVAILABILITY_LABEL: Record<string, string> = {
  IN_STOCK: "재고 있음",
  OUT_OF_STOCK: "품절",
  INVALID: "재고 표기 확인 필요",
  UNKNOWN: "재고 미확인",
};

/** 🔴 `null` 을 두 값 중 하나로 «분류하지 않는다» — 077 의 legacy 미확정이다. */
function provenanceLabel(sourceKind: string | null): string {
  if (sourceKind === "DISCOVERED") return "수집에서 발견";
  if (sourceKind === "SELLER_ENTERED") return "직접 입력";
  return "출처 미확정";
}

export function SourcingPanel({
  productId,
  onSignalChange,
}: {
  /** `ProductSnapshot.productId`. null 이면 소싱을 시작할 수 없다. */
  productId: string | null;
  onSignalChange: (signal: SourcingSignal) => void;
}) {
  /* 🔴 `loading` 을 state 로 «두지 않는다». 「아직 못 받았다」는 masterReady 가
     null 인 것으로 이미 알 수 있고, state 로 두면 effect 안에서 동기 setState 를
     하게 되어 cascading render 를 부른다(lint 가 잡는 그 규칙). 상태를 하나
     줄이는 쪽이 구조도 낫다. */
  const [loadFailed, setLoadFailed] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [masterReady, setMasterReady] = useState<MasterReadyResult | null>(null);
  const [readyEvaluated, setReadyEvaluated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newSite, setNewSite] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCurrency, setNewCurrency] = useState("");

  /**
   * 🔴 **setState 가 없는** 조회. effect 와 사용자 행동이 «같은» 이 함수를 쓴다 —
   * 두 벌로 쓰면 한쪽만 고쳐지고(이 저장소가 반복해 겪은 유형), 반대로 state 를
   * 건드리는 함수를 effect 가 부르면 lint 의 `set-state-in-effect` 에 걸린다
   * (`admin/users/page.tsx` 가 같은 이유로 조회를 effect 안에 인라인해 뒀다).
   * 여기서는 «순수 조회» 로 떼어내 중복도 경고도 없게 한다.
   */
  const fetchSourcing = useCallback(async (): Promise<SourcingLoad | null> => {
    if (!productId) return null;
    const [listRes, selRes] = await Promise.all([
      fetch(`/api/products/${productId}/sourcing-candidates`),
      fetch(`/api/products/${productId}/selected-source`),
    ]);
    const list = (await listRes.json()) as { ok: boolean; candidates?: Candidate[]; error?: string };
    const sel = (await selRes.json()) as SelectionResponse;
    if (!listRes.ok || !list.ok || !selRes.ok || !sel.ok) {
      return { ok: false, message: messageFor(listRes.ok ? selRes.status : listRes.status, list.error ?? sel.error) };
    }
    return {
      ok: true,
      candidates: list.candidates ?? [],
      selectedId: sel.selectedCandidateId ?? null,
      masterReady: sel.masterReady ?? null,
      readyEvaluated: sel.registrationReadyEvaluated === true,
    };
  }, [productId]);

  const apply = useCallback((result: SourcingLoad | null) => {
    if (!result) return;
    if (!result.ok) {
      /* 🔴 「후보 없음」으로 내려가지 않는다 — 확인하지 못한 것이다. */
      setLoadFailed(true);
      setNotice(result.message);
      return;
    }
    setCandidates(result.candidates);
    setSelectedId(result.selectedId);
    setMasterReady(result.masterReady);
    setReadyEvaluated(result.readyEvaluated);
    setNotice(null);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await fetchSourcing());
    } catch {
      setLoadFailed(true);
      setNotice(messageFor(0));
    }
  }, [fetchSourcing, apply]);

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    /* 🔴 effect 본문에서 «동기» setState 를 하지 않는다 — 전부 await 뒤다
       (`admin/users/page.tsx` 와 같은 패턴). */
    void (async () => {
      try {
        const result = await fetchSourcing();
        if (cancelled) return;
        apply(result);
      } catch {
        if (cancelled) return;
        setLoadFailed(true);
        setNotice(messageFor(0));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, fetchSourcing, apply]);

  /**
   * 🔴 상단 작업 Flow(③)에 «사실만» 올려보낸다. 여기서 단계를 정하지 않는다.
   *
   * `productId === null` 일 때는 서버를 부를 수 없으므로 문구가 없다. 그래서
   * **같은 순수 함수** 를 그대로 불러 쓴다 — 새 문구를 지어내면 서버와 화면이
   * 다른 말을 하게 된다(`master-ready.ts` 는 DB·네트워크를 보지 않는다).
   */
  const identityOnly = productId == null ? computeMasterReady({
    hasProduct: false,
    candidateCount: 0,
    selectedCandidateId: null,
    registrationReadyRequiredPassed: false,
  }) : null;
  const shown = masterReady ?? identityOnly;

  useEffect(() => {
    onSignalChange({
      /* productId 가 없는 것은 「아직 조회 안 함」이 아니라 «아는 사실» 이다. */
      /* 아직 «받지 못했다» — 「없다」가 아니다. */
      notStarted: productId != null && masterReady == null && !loadFailed,
      productMissing: productId == null,
      candidateCount: candidates.length,
      masterConfirmed: shown?.masterConfirmed === true,
      warning: shown?.warning ?? null,
      nextAction: shown?.nextAction ?? null,
      loadFailed,
    });
  }, [productId, masterReady, candidates.length, shown, loadFailed, onSignalChange]);

  async function act(run: () => Promise<Response>) {
    setBusy(true);
    try {
      const res = await run();
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || body.ok !== true) {
        /* 🔴 409 는 «정상적인 보호 동작» 이다 — 실패로 그리지 않는다(§10). */
        setNotice(messageFor(res.status, body.error));
        return false;
      }
      setNotice(null);
      await load();
      return true;
    } catch {
      setNotice(messageFor(0));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /* ── 상태 A — 상품 정체성이 없다 ───────────────────────────────────────── */
  if (productId == null) {
    return (
      <Card padding="md" className="space-y-2">
        <h3 className="text-sm font-semibold text-text-primary">소싱 선택</h3>
        {/* 🔴 「소싱 후보가 없습니다」가 아니다 — 서버와 같은 문장을 쓴다. */}
        <p className="text-sm text-text-secondary">{identityOnly?.nextAction}</p>
      </Card>
    );
  }

  if (masterReady == null && !loadFailed) {
    return (
      <Card padding="md">
        <p className="text-sm text-text-secondary">소싱 후보를 불러오고 있습니다...</p>
      </Card>
    );
  }

  if (loadFailed) {
    return (
      <Card padding="md" className="space-y-3">
        <p className="text-sm text-text-secondary">{notice ?? messageFor(0)}</p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            /* 사용자 이벤트에서의 setState 는 effect 와 달리 문제가 없다. */
            setLoadFailed(false);
            setNotice(null);
            void load();
          }}
        >
          다시 불러오기
        </Button>
      </Card>
    );
  }

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const others = candidates.filter((c) => c.id !== selectedId);

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">소싱 선택</h3>
        {/* 🔴 서버 단계를 그대로 보여준다 — 여기서 다시 계산하지 않는다. */}
        {shown && <span className="text-xs text-text-secondary">{shown.stage}</span>}
      </div>

      {shown?.warning && (
        <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
          {shown.warning}
        </p>
      )}
      {notice && <p className="text-xs text-text-secondary">{notice}</p>}

      {selected ? (
        <section className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">선택된 소싱처</p>
          <CandidateRow
            candidate={selected}
            isSelected
            busy={busy}
            onUnselect={() =>
              void act(() => fetch(`/api/products/${productId}/selected-source`, { method: "DELETE" }))
            }
            onDelete={() =>
              void act(() =>
                fetch(`/api/products/${productId}/sourcing-candidates/${selected.id}`, { method: "DELETE" }),
              )
            }
          />
          {/* 🔴 ③ 완료 = Master 확정. 등록 준비(④)와 «다른 단계» 다. */}
          <p className="text-xs text-text-secondary">
            {readyEvaluated
              ? shown?.readyForCommerce
                ? "판매 상품으로 준비되었습니다."
                : (shown?.nextAction ?? "등록에 필요한 항목이 남아 있습니다.")
              : /* 🔴 「등록 준비 안 됨」이 아니다 — 아직 평가하지 않았다(§14). */
                "등록 준비 상태 — 아직 평가되지 않았습니다."}
          </p>
        </section>
      ) : (
        <p className="text-sm text-text-secondary">{shown?.nextAction}</p>
      )}

      {others.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">후보 소싱처</p>
          {others.map((candidate) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              isSelected={false}
              busy={busy}
              onSelect={() =>
                void act(() =>
                  fetch(`/api/products/${productId}/selected-source`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ candidateId: candidate.id }),
                  }),
                )
              }
              onDelete={() =>
                void act(() =>
                  fetch(`/api/products/${productId}/sourcing-candidates/${candidate.id}`, { method: "DELETE" }),
                )
              }
            />
          ))}
        </section>
      )}

      {adding ? (
        <section className="space-y-2 rounded-md border border-border p-3">
          <input
            aria-label="소싱처 주소"
            placeholder="https://..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full rounded border border-border px-2 py-1 text-sm"
          />
          <input
            aria-label="사이트 이름"
            placeholder="사이트 이름"
            value={newSite}
            onChange={(e) => setNewSite(e.target.value)}
            className="w-full rounded border border-border px-2 py-1 text-sm"
          />
          <div className="flex gap-2">
            <input
              aria-label="원가"
              placeholder="원가"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-24 rounded border border-border px-2 py-1 text-sm"
            />
            <input
              aria-label="통화"
              placeholder="통화"
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value)}
              className="w-20 rounded border border-border px-2 py-1 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                const ok = await act(() =>
                  fetch(`/api/products/${productId}/sourcing-candidates`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      /* 🔴 셀러가 직접 넣은 것이므로 «항상» SELLER_ENTERED 다.
                         생략하거나 추론하지 않는다(077 의 NULL 은 legacy 다). */
                      sourceKind: "SELLER_ENTERED",
                      sourceUrl: newUrl,
                      sourceSite: newSite,
                      /* 비우면 «null» 이다 — 빈 문자열은 0원으로 읽힌다. */
                      ...(newPrice.trim() ? { priceAmount: newPrice.trim() } : {}),
                      ...(newCurrency.trim() ? { currency: newCurrency.trim() } : {}),
                    }),
                  }),
                );
                if (ok) {
                  setAdding(false);
                  setNewUrl("");
                  setNewSite("");
                  setNewPrice("");
                  setNewCurrency("");
                }
              }}
            >
              추가
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAdding(false)}>
              취소
            </Button>
          </div>
        </section>
      ) : (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setAdding(true)}>
          + 소싱처 직접 추가
        </Button>
      )}
    </Card>
  );
}

function CandidateRow({
  candidate,
  isSelected,
  busy,
  onSelect,
  onUnselect,
  onDelete,
}: {
  candidate: Candidate;
  /** 🔴 후보에 박힌 칸이 아니다 — 호출부가 `selectedCandidateId` 와 대조한 결과다. */
  isSelected: boolean;
  busy: boolean;
  onSelect?: () => void;
  onUnselect?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="space-y-1 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary">{candidate.sourceSite}</span>
        <Badge size="sm" variant={isSelected ? "success" : "default"}>
          {isSelected ? "선택됨" : provenanceLabel(candidate.sourceKind)}
        </Badge>
        {isSelected && <Badge size="sm">{provenanceLabel(candidate.sourceKind)}</Badge>}
      </div>
      <p className="truncate text-xs text-text-secondary">{candidate.sourceUrl}</p>
      <p className="text-xs text-text-secondary">
        {/* 🔴 표시는 priceAmount 다. priceAmountRaw 는 원문 보존용이고 화면에 쓰지 않는다. */}
        {candidate.priceAmount != null
          ? `${candidate.currency ?? ""} ${candidate.priceAmount}`.trim()
          : "원가 미확인"}
        {" · "}
        {candidate.availability ? (AVAILABILITY_LABEL[candidate.availability] ?? "재고 미확인") : "재고 미확인"}
      </p>
      <div className="flex gap-2 pt-1">
        {onSelect && (
          <Button size="sm" disabled={busy} onClick={onSelect}>
            선택
          </Button>
        )}
        {onUnselect && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onUnselect}>
            선택 해제
          </Button>
        )}
        {onDelete && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onDelete}>
            삭제
          </Button>
        )}
      </div>
    </div>
  );
}
