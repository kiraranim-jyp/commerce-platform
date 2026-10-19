# WU-097 — `EVIDENCE_WORTHWHILE` 게이트와 후보 노출 경로 분리 검증 (구현 0)

> 🔴 CPO 지시 2026-10-19. 「판정 정확도를 건드리지 않고, 현재 DROPPED 되어 사라지는 AI
> 후보를 **「검토 가능한 후보」로 보존할 수 있는지** 확인한다.」
> 「**분리가 안전하지 않다면 코드 변경 없이 REJECT/HOLD** 하고 이유를 확정한다.」

---

# WU-097 FINAL

## 0. 결론 — 🔴 **HOLD. 지금 구조에서는 «안전한 분리» 가 성립하지 않는다**

```
「sink 앞에서 보존한다」 = 「가격 집계 입력에 넣는다」 이다.
sink 는 **화면 전용 배열이 아니다** — `computeMarketIntelligence` 가 그 배열을
**직접 순회해 가격 축에 적재** 한다. ⟹ CPO §6 의 「가격비교 오염 0」을 **보장할 수 없다**.
```

## 1. producer / consumer 확정

```
judgeDomesticCandidate
   ├─ NO_CANDIDATES → continue
   ├─ **DROPPED**   → [MI-REAL-12] 로그 → **continue**        ← 🔴 sink 이전에서 끊긴다
   └─ JUDGED        → best 분해 → … → isTransientShopId 분기
                        → **transientEvidenceSink.push(...)**  ← :1255
                             ├─ SELLER_URL      → urlCandidateEvidence
                             └─ GEMINI_DISCOVERY→ geminiEvidence
```

| 소비처 | 하는 일 |
|---|---|
| `check/route.ts:159` | 두 배열을 **합쳐** `computeMarketIntelligence` 에 넘긴다 |
| `market-intelligence.ts:226` | `for (const e of geminiEvidence ?? [])` — **가격 축 적재 루프** |
| ↳ `:252` | `overseasEvidence.push({ …, priceTier, matchTruth })` (해외/UNKNOWN 축) |
| ↳ 국내 분기 | `market==="KR"` → `domesticTransientRecords` (국내 축) |
| `GeminiTransientCandidates.tsx:223` | `evidence.map()` — **전건 렌더**(게이트 0) |
| `selectCandidatesForDetailConfirmation` | 🟢 **sink 와 무관** — 후보 배열에서 가격 상세확인 대상을 고른다(샵당 2) |

🔴🔴 **A(노출)와 B(판정/가격비교)가 «같은 배열» 을 쓴다.** 그것이 이 WU 의 핵심 사실이다.

## 2. counterfactual — 「보존만」이 가능한가

```
🔴 ⒜ sink 에 넣으면 **집계 루프를 탄다**(위 표) ⟹ 가격 축 오염 가능
🔴 ⒝ `GeminiTransientEvidence.priceTier` 는 **필수 필드**(`DomesticPriceTier`, optional/null 아님)
      DROPPED 후보는 **판정을 하지 않았으므로** 그 값이 없다
      ⟹ 넣으려면 **지어내야 한다**. 🔴 이 트랙이 세 번 틀린 바로 그 행위다
      (WU-085 tier · WU-092 `as never` · WU-094 인덱스)
🔴 ⒞ 국내 축은 **판정 입력** 이다(WU-039 · WU-059) — `computeMarketAlert` →
      `openAlertIfNotActive` 로 **영속 `price_alerts` 행** 이 생길 수 있다
      ⟹ CPO §4 의 「persistent side effect 0」을 **보장할 수 없다**
```

## 3. 🔴 WU-091 계약과의 충돌 — **결정적 이유**

WU-091 이 「후보 노출 ≠ SAME 판정」을 열 때 **넷을 동시에** 걸었다:
```
① 기본 접힘 ② 「동일상품 없음」을 먼저 ③ **행마다 판정 라벨 + 제외 이유** ④ 「가격비교 미사용」
```
🔴🔴 **DROPPED 후보에는 ③ 을 붙일 수 없다** — `judgeDomesticCandidate` 가 **판정을 하지
않고** 돌아왔으므로 verdict·matchTruth·blocker 가 **존재하지 않는다**.
⟹ 「판정 보류」라는 **새 상태 어휘** 를 만들어야 하고, 그것은 **제품 정책** 이다.
🔴 라벨 없이 보여주면 **2026-09-19 사고 모양**(「유력 후보 5건」)에 다시 가까워진다.

## 4. 🟡 분리 설계안 (구현하지 않았다 · CPO 판정용)

```
새 배열  unjudgedCandidates: { domain, title, url, market, price, priceStatus,
                               matchLevel, dropGate }[]   🔴 priceTier/matchTruth **없음**
생산     DROPPED 분기에서 `judgement.observed.candidate` 를 그대로 push
         (🟢 데이터는 **이미 손에 있다** — 새 fetch 0 · 새 판정 0)
전달     🔴 `computeMarketIntelligence` 에 **넘기지 않는다** — 응답에만 싣는다
화면     🔴 **별도 구역** · 라벨은 「판정 보류(증거 부족)」 · 「가격비교에 사용되지 않습니다」
```
비용: 타입 1 · 러너 ~5줄 · route 1줄 · **UI 신규 구역 1** ·  새 상태 어휘 1

🔴 **CPO 가 §3 에서 「UI 수정 선행 금지」를 걸었고**, 이 안은 UI 없이는 의미가 없다
(배열만 만들고 화면이 없으면 **아무도 못 본다**).

## 5. 🔴 안전성 — CPO §4 다섯 축 대조

| 축 | 「sink 앞 보존」(단순안) | 「별도 배열」(설계안) |
|---|---|---|
| 가격비교 오염 | 🔴 **발생 가능**(집계 루프) | 🟢 0 (MI 미전달) |
| SAME 오표시 | 🔴 `priceTier` 를 지어내야 함 | 🟢 0 (tier 없음) |
| persistent side effect | 🔴 `price_alerts` 가능 | 🟢 0 |
| transient ↔ 판정 후보 혼입 | 🔴 **같은 배열** | 🟢 0 (배열 분리) |
| WU-091 노출 분리 | 🔴 ③ 라벨 불가 | 🔴 **③ 라벨 여전히 불가** |

🔴🔴 **설계안도 마지막 축을 못 지킨다** — 그것이 HOLD 의 직접 근거다.

## 6. 검증 기준 (CPO §6) — 현재 달성치

```
False SAME 증가        🟢 **0** (코드 변경 0)
가격비교 오염          🟢 **0** (코드 변경 0)
persistent side effect 🟢 **0**
8축 변경 / threshold   🟢 **0 / 0**
DROPPED → 「검토 가능한 후보」 보존   🔴 **하지 않았다** (위 이유)
```

## 7. 🟢 코드 변경 0 으로 한 것 — **현재 성질을 계약으로 잠갔다**

`wu-097-sink-boundary.test.ts` · **6 계약** · 네트워크 0:
```
① DROPPED 분기의 `continue` 가 sink 보다 **앞** 이다
② sink push 는 `JUDGED` 분해 **뒤** 에만 있다
③ 집계 루프가 sink 배열을 순회하며 `overseasEvidence.push` 한다 (화면 전용 아님)
④ route 가 두 sink 를 **합쳐서** MI 에 넘긴다
⑤ 노출과 집계가 **같은 배열** 이다
⑥ `priceTier` 가 **필수 필드** 다 (판정 없음을 표현 못 한다)
```
🟢 **나중에 누가 분리를 구현하면 ③⑤⑥ 이 FAIL 로 뒤집히고 그것이 수정의 증거다**
(쿠팡 고시 선례 · 헌장 §12).

## 8~10. 코드 변경 / 회귀 / 배포

```
운영 코드 변경 **0** · 배포 **0** · UI 0 · 8축 0 · threshold 0 · Registry 0 · AI 0
typecheck **0** · apps/admin **600 files / 8,367 passed** · failed **0**
```

---

## 🔴 Known Unknowns

```
① 🔴 **행동 단언을 포기했다.** `computeMarketIntelligence` 를 직접 불러 「sink → 가격 축」을
   증명하려 했으나 손으로 만든 product/links 가 **집계 루프에 도달하지 못했다**(결과 불변).
   🔴 그 상태로 「영향 없음」이라 적으면 거짓이라 **소스 수준 단언으로 낮췄다**.
   ⟹ 「sink 가 집계에 실제로 실린다」는 **코드 경로 근거** 이고 **실행 근거가 아니다**
② 🔴 DROPPED 26곳의 후보를 보존했을 때 **셀러에게 얼마나 유용한지** 는 미측정이다.
   🟡 WU-093 GT 로 추정하면 Human **SAME 2 / DIFFERENT 8** — 대부분 다른 상품이다.
   🔴 단 그 GT 는 **다른 표본**(등록부 경로)이라 이 26곳에 그대로 쓰지 않는다
③ 🔴 「판정 보류」 라벨의 문구·위치는 **제품 정책** 이라 CTO 가 정하지 않았다
④ 🔴 `selectCandidatesForDetailConfirmation` 이 sink 와 무관하다는 것은 **코드 기준** 이고
   Production 실행 추적은 하지 않았다
⑤ 🔴 WU-096 의 「182 vs 181」은 **미규명 그대로** 둔다(CPO 지시)
```

## 판정 — 🔴 **HOLD / 구현 0**

```
🔴 단순안(sink 앞 보존)  — **안전하지 않다**(가격 축 오염 · tier 지어냄 · 영속 알림)
🟡 설계안(별도 배열)     — ①~④ 는 안전하나 🔴 **WU-091 의 ③「행마다 판정 라벨」을 못 지킨다**
                           (판정을 안 한 후보라 라벨이 «존재하지 않는다»)
⟹ 🔴 **열려면 「판정 보류」라는 새 상태를 제품에 도입해야 하고 그것은 CPO/CEO 결정이다.**
🟢 그래서 **코드를 한 줄도 바꾸지 않았고**, 대신 **현재 경계를 계약 6건으로 잠갔다**.
```

## CEO Action — **없음**
