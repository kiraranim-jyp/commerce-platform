# WU-098 — 「판정 보류 후보」의 제품 상태/노출 정책 **설계 조사** (구현 0)

> 🔴 CPO 지시 2026-10-19. 「**아직 구현하지 않는다.** 조사만 한다 · **제품 정책을 CTO 가
> 결정하지 않는다** · 구현 0」

---

# WU-098 FINAL

## 0. 🔴🔴 먼저 — **WU-097 의 결론 한 줄을 정정한다**

WU-097 에서 「`DROPPED` 후보에는 **라벨이 없다**(verdict·blocker 가 존재하지 않는다)」고
적었다. 🔴 **그 문장은 과했다.** 실측:

```
DROPPED 샵의 후보 **53건** · crossSellerVerdict 분포
   CONFLICT 38 · SIMILAR 12 · UNKNOWN 3   ⟹ 🔴 **null 0건**
```

🟢 **판정 어휘가 이미 있다.** 없는 것은 `matchTruth` / `priceTier` / `verified` —
즉 **「국내 링크 판정」 계열** 이고, **교차판매처 판정(`crossSellerVerdict`)은 살아 있다**.

🔴 그러므로 WU-091 의 ③「행마다 판정 라벨」은 **충족 가능하다**(아래 §4).
🔴 WU-097 의 **나머지 결론(기존 sink 재사용 불가)은 그대로 유효하다**.

## 1. 현재 상태 모델 전수 — **셋뿐이다**

`DomesticJudgement`(run-domestic-price-check.ts:628):

| kind | 조건 | 들고 나오는 것 | sink 도달 |
|---|---|---|---|
| `NO_CANDIDATES` | 자기참조 제외 후 0건 | `selfReferenceExcluded` | 🔴 없음 |
| `DROPPED` | gate **둘** | `observed.candidate`(**1건**) · `candidateCount` | 🔴 없음 |
| `JUDGED` | 통과 | `best` · `matchTruth` · `verified` · **`priceTier`** | 🟢 push |

🔴 `DROPPED.gate` 어휘는 **둘** 이다 — `EVIDENCE_NOT_WORTHWHILE` · `NOT_MATCHED`.
🔴 **제3의 상태는 없다.** 「판정하지 않았지만 보여줄 수 있다」를 표현할 칸이 **없다**.

🔴🔴 **그리고 `DROPPED` 는 top 후보 «1건» 만 들고 나온다** — `observed.candidate`.
⟹ 「후보 전부 보존」은 **지금 구조로는 불가능** 하고, `judgeDomesticCandidate` 의
반환 모양을 바꿔야 한다(샵당 N건). 🔴 그것은 **계약 변경** 이다.

## 2. 필요한 데이터 필드 — 🟢 **UI 가 읽는 칸에서 역산했다**

`GeminiTransientCandidates.tsx` 가 실제로 읽는 칸 **전수**(grep):
```
source · domain · title · discoveredUrl · market ·
priceAmount · priceCurrency · priceStatus ·
matchTruth · crossSellerVerdict · crossSellerBlockers · crossSellerConflicts · matchReasons
```
🟢🟢 **`priceTier` 를 읽지 않는다.** 그 필드가 `GeminiTransientEvidence` 에서 **필수** 인
이유는 UI 가 아니라 **MI 집계**(`market-intelligence.ts:226` 루프) 때문이다.

### ⟹ 「판정 보류 후보」에 필요한 필드 (지어내지 않고 **있는 값만**)
| 필드 | 출처 | 비고 |
|---|---|---|
| `source` | 러너 분기 | 기존과 동일 |
| `domain` · `title` · `discoveredUrl` | `observed.candidate` | 🟢 있다 |
| `market` · `basis` | `classifyCandidateMarket` | 🟢 있다 |
| `priceAmount/Currency/Status` | `observed.candidate.price` | 🟢 있다 |
| `crossSellerVerdict/Blockers/Conflicts` | `observed.candidate` | 🟢 **있다**(§0) |
| `matchReasons` · `matchLevel` | `observed.candidate` | 🟢 있다 |
| `dropGate` | `judgement.gate` | 🟢 있다 (**왜 보류인지**) |
| 🔴 `matchTruth` · `verified` · `priceTier` | — | 🔴 **없다. 넣지 않는다** |

🔴 **새로 계산하거나 지어내야 하는 값이 «하나도 없다»** — 전부 이미 손에 있다.

## 3. 가격비교 입력과의 분리 — 🟢 **최소 경로가 «한 줄» 이다**

```
현재   check/route.ts:159   domesticShop.geminiEvidence || domesticShop.urlCandidateEvidence
                            → computeMarketIntelligence(…, 그 배열)
설계   세 번째 배열 `pendingCandidates` 를 **그 인자에 넣지 않는다**
       → 응답에만 싣는다 → UI 가 별도 구역으로 그린다
```
🟢 `computeMarketIntelligence` 는 **인자로 받은 배열만** 순회한다(`for (const e of geminiEvidence ?? [])`).
⟹ 🟢 **넘기지 않으면 가격 축에 들어갈 경로가 없다.** 분리는 **구조적으로** 성립한다.

🟢 운영 소비처 파일은 **넷** 뿐이다(테스트 제외):
`check/route.ts` · `market-intelligence.ts` · `run-domestic-price-check.ts` · `DomesticPriceIntelligencePanel.tsx`.

## 4. UI 상태/라벨 — 🔴 **기존 어휘로 충분한가**

`match-display.ts` 의 `TIERS` 어휘는 **여섯** — `SAME` · `SAME_MODEL_OPTION_DIFF` ·
`PRESUMED_SAME` · `SIMILAR` · `UNKNOWN` · `CONFLICT`.

🟢 `crossSellerVerdict`(CONFLICT/SIMILAR/UNKNOWN)가 있으므로 **WU-091 의 ③ 라벨은 붙는다**.
🔴 **그러나 구역 머리 문구는 새로 필요하다** — 「이 후보들은 **판정을 하지 않았습니다**」.
   그 이유(`dropGate`)를 셀러 말로 옮기는 것이 **제품 정책** 이고 **CTO 가 정하지 않았다**.

🔴 WU-091 4중 계약 대조:
| | 충족 가능? |
|---|---|
| ① 기본 접힘 | 🟢 `<details>` 그대로 |
| ② 「동일상품 없음」 먼저 | 🟢 기존 문구 재사용 |
| ③ 행마다 판정 라벨 | 🟢 **`crossSellerVerdict` 로 가능**(§0 정정) |
| ④ 「가격비교 미사용」 명시 | 🟢 가능 — 🔴 그리고 **그것이 사실이다**(§3) |

## 5. 기존 경로 영향 — 🟢 **0 으로 설계 가능**

```
JUDGED 경로      🟢 무변경 (새 배열은 DROPPED 분기에서만 push)
가격/집계        🟢 무변경 (MI 에 넘기지 않는다 · §3)
price_alerts     🟢 무변경 (국내 축에 안 들어가므로 computeMarketAlert 에 닿지 않는다)
8축·threshold    🟢 무변경
🔴 단 **계약 변경 1건** 이 필요하다 — `DROPPED` 가 **top 1건** 만 들고 나오므로,
   「후보 전부」를 보존하려면 `DomesticJudgement.DROPPED` 에 배열 칸을 더해야 한다.
   🟡 「top 1건만 보존」이면 계약 변경 **0** 이다. 🔴 어느 쪽인지는 **제품 정책** 이다.
```

## 6~7. 🔴 **제품 정책은 결정하지 않았다 · 구현 0**

```
결정하지 않은 것 — ⒜ 상태 이름(`PENDING`/`UNJUDGED`/…) ⒝ 구역 문구 ⒞ 보존 범위
                   (top 1건 ↔ 후보 전부) ⒟ 셀러에게 보일 가치가 있는가
운영 코드 변경 **0** · 배포 **0** · 테스트 추가 **0** · UI **0**
```

---

## 🔴 CPO 결정에 필요한 재료 (CTO 가 고르지 않는다)

```
🟢 **기술적으로는 안전하게 분리된다** — 필요한 값이 전부 이미 있고, MI 에 넘기지 않으면
   가격 축 오염 경로가 **구조적으로 없다**. 소비처 파일도 넷뿐이다.
🔴 **그러나 가치가 측정되지 않았다**:
   WU-096 기준 DROPPED 샵의 후보 **53건** · verdict **CONFLICT 38 · SIMILAR 12 · UNKNOWN 3**
   ⟹ 🔴 **대부분이 「충돌」** 이다. 셀러에게 보여줄 때 **노이즈가 다수** 일 가능성이 높다.
   🔴 단 WU-093 GT(SAME 2 / DIFFERENT 8)는 **다른 표본** 이라 이 53건에 쓰지 않는다.
🔴 **보존 범위가 결과를 바꾼다** — top 1건이면 **샵당 1줄**(최대 26줄), 전부면 **53줄**.
   전자는 계약 변경 0, 후자는 `DomesticJudgement` 계약 변경이 필요하다.
```

## 🔴 Known Unknowns

```
① 🔴 **셀러 가치 미측정.** 「판정 보류 후보를 보면 셀러가 더 잘 판단하는가」는 **측정 안 됨**
② 🔴 verdict 분포(CONFLICT 38)는 **원상품 1개 · AI 산출 1덩어리** 기준이다
③ 🔴 `NOT_MATCHED` gate 로 떨어지는 후보는 이 표본에 **0건** — 그 모양은 **미측정**
④ 🔴 `NO_CANDIDATES` 샵은 보존할 것이 **애초에 없다**(후보가 0) — 별개 문제다
⑤ 🔴 소비처 「넷」은 **파일 수** 다. 파일 안의 참조 수(29)는 분해하지 않았다
⑥ 🔴 WU-097 이 기록한 **행동 단언 한계**(집계 루프 미도달)는 그대로 유지된다 —
   §3 의 「넘기지 않으면 안 들어간다」는 **코드 경로 근거** 이고 실행 근거가 아니다
```

## 판정 — 🟢 **조사 완료 / 구현 0 · CPO 제품 정책 결정 대기**

```
🟢 분리는 **기술적으로 안전하게 가능** 하고 필요한 값이 **전부 이미 있다**
🔴 **가치는 측정되지 않았다** — DROPPED 후보의 다수가 CONFLICT 다
🔴 상태 이름 · 문구 · 보존 범위는 **전부 제품 정책** 이고 CTO 가 정하지 않았다
🔴🔴 그리고 WU-097 의 「라벨이 없다」는 **정정했다** — `crossSellerVerdict` 는 있다
```

## CEO Action — **없음**
