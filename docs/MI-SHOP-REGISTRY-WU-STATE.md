# MI Domestic Shop Registry — MANUAL / Disabled / Scope 정책 검증 WU

> 🟢 **종료.** 판정은 §7 — **HOLD (조사 결과를 CPO 가 받아 정책을 정할 자리)**.
> 🔴 **Production 0 · DB 0(SELECT 만) · 정책 0 · `MANUAL→AUTO` 변경 0.**
> 🔴🔴 **직전 WU 의 진단을 정정한다** — `enabled` 의 owner 를 잘못 짚었다(§3).

---

## 1. Strategic Question

> 「현재 Registry 가 «실제로 국내 상품을 찾을 수 있는 샵» 을 얼마나 정확하게
>  탐색 대상으로 분류하고 있는가?」

---

## 2. 🔴🔴 §5-B — 직전 WU 의 진단을 정정한다

직전 WU 에서 「`domestic_price_sources.enabled=false` 라서 검색에서 빠진다」고 썼다.
🔴 **그 전제가 틀렸다.** owner 를 끝까지 읽어 보니:

```
listDomesticPriceSources(workspaceId)      domestic-price-source.ts:155
  → toSource(row, settings.get(row.id) ?? true)          :187
       🔴 **카탈로그의 `enabled` 칸은 «무시» 된다**
       🟢 실효값은 `workspace_domestic_shop_settings.enabled` 다
       🟢 설정 행이 없으면 **ON**(fail-open · 047 주석)
  → run-domestic-price-check.ts:683 이 이것을 부른다
  → :674 주석: 「s.enabled 는 listDomesticPriceSources(workspaceId) 가 이미 [머지한 값]」
  → isBatchSurveyTarget(:442) 이 그 머지된 enabled 를 본다
```

🔴 `[id]/route.ts:10-16` 이 왜 그렇게 됐는지 적어 뒀다(GLOBAL-MARKET ③-2, CPO 확정
2026-09-11):
> 「이전에는 `enabled` 도 카탈로그에 직접 썼다. 그래서 **한 판매자가 편집샵을
>  끄면** [모두의 목록이 같이 바뀌었다].」

🟢 **그래서 결론 자체는 바뀌지 않았다**(§3) — 하지만 **이유가 달랐다.** 🔴 owner 를
확인하지 않고 카탈로그 칸으로 단정했으면, 「카탈로그를 true 로 되돌리면 된다」는
**틀린 처방**을 냈을 것이다.

---

## 3. ① `Bobo Choses Korea` 가 왜 비활성인가 — 🟢 **답을 찾았다**

```
실측 (workspace_domestic_shop_settings 전수 30행 / workspace 6개)
  Bobo Choses Korea(공식)  카탈로그 enabled = **false**
                           ws 설정 행 **6개 · 전부 false** (ws_on 0)
                           → 🔴 **실효값도 false** = 어느 workspace 에서도 검색 안 된다
  last_error_code = NO_RESULT · last_success_at 2026-09-10 17:26
  last_checked_at 2026-09-10 23:29 · updated_at **2026-09-10 23:35**
  그 샵이 만든 링크 32건 — created 2026-08-23 ~ **2026-09-10** (그 뒤 0건)
```

### 🟢 원인 재구성 (근거 있는 것만)

```
🟢 마이그레이션 030 은 이 샵을 `enabled=true` 로 시드했다
🟢 035 가 끈 것은 ssfshop · 29cm · musinsa · wconcept · coupang 이다 — **이 샵이 아니다**
🟢 `apps/admin` 코드에 `enabled=false` 를 쓰는 곳은 **없다**(grep 전수) —
   자동 비활성화 경로가 아니다
🟢 047 이전에는 UI 토글이 **카탈로그를 직접** 바꿨다(`[id]/route.ts:16` 주석)
🟢 047(2026-09-11)이 「카탈로그 enabled=false 인 행을 **모든 workspace 설정에**
   false 로 복사」했다
→ 🔴 **따라서: 2026-09-10 에 사람이 UI 에서 껐고, 그 다음 날 047 이 그 선택을
     모든 workspace 로 «번지게» 했다.** 사고(자동 비활성)가 아니다.
🔴 **누가 왜 껐는지는 UNKNOWN 이다** — 🟢 단 「안 봤다」가 아니라 **`audit_log`(422행)
   가 그 이벤트를 «기록하지 않는다»**. 칸이 `event_type · actor · snapshot_id ·
   marketplace · field · before/after` 이고 2026-09-09~12 구간에 남은 것은
   `AUTH_*` / `IMPERSONATION_*` 뿐이다. 🔴 샵 등록부 토글은 감사 대상이 아니다.
   🟢 참고로 그 시각(UTC 14:35) 직후 구간에 **admin impersonation 기록이 있다**
   (15:04~15:34) — 🔴 그러나 토글 기록이 없으므로 **인과로 쓰지 않는다.**
```

🔴 그래서 이것은 **CTO 가 되돌릴 사안이 아니다** — 사람의 선택이었고, 되살리면
6개 workspace 전부에 영향이 간다. **CPO/CEO 결정 영역이다.**

---

## 4. 🟢 실효로 검색되는 샵 — **7개** (링크 보유 workspace 2곳 기준)

```
workspace  설정 보유 6 · 스냅샷 보유 4 · 🔴 **링크 보유 2**

링크 보유 workspace 2곳 모두 동일:
  🟢 실효 ON 7 / AUTO_* 전체 8
  CHOCO.EL · DEUXBEBE · LITTLE LUNA · LOOXLOO · RULII · 스카이스포츠 · 포레포레
  🔴 OFF 1 = Bobo Choses Korea(공식)
```

🟢 **그 7개 중 아동의류 대상은 6개** 다(스카이스포츠는 `scope=TENNIS`).
🔴 그리고 그 6개 중 실제로 링크를 만든 것은 **3개**(포레포레 32 · 듀베베 23 ·
리틀루나 1). CHOCO.EL · LOOXLOO · RULII 는 **0건**이고 선행 WU 가 이유를 이미 쟀다.

### 🔴 `MANUAL` 샵은 실효 ON 이어도 «검색되지 않는다»

```
types.ts:224 주석 — 「AUTO_API/AUTO_SCRAPE 인 것만 실제로 검색을 시도한다
                     (MANUAL/NOT_AVAILABLE 은 아직 [대상이 아니다])」
실측: COCO & JENNIE 는 ws 설정이 **null → 실효 ON** 이다.
      🔴 그런데 `MANUAL` 이라 검색되지 않는다.
→ 🟢 즉 「ON/OFF」와 「수집전략」은 **서로 다른 두 문** 이다. 둘 다 통과해야 뒤진다.
```

🔴 **그래서 coconjennie 를 「켜는」 것으로는 아무 일도 일어나지 않는다** —
`AUTO_SCRAPE` 로 승격해야 한다. 그것이 ②다.

---

## 5. ② `coconjennie` 수집 가능성 — 🔴 **조사 미완 · UNKNOWN 유지**

```
🟢 확보된 것 (선행 WU 실측, 재측정 안 함)
   /brand · /shop 2경로 fetch 성공(182,981 bytes)
   우리 브랜드 4개 취급 확인 — Louise Misha · Emile et Ida ·
   the new society · Misha & Puff
🔴 미확보 — **sixshop product path 미관찰**
   즉 「상품 1건의 URL 모양」을 모른다. 그것 없이는 어댑터를 쓸 수 없다
🔴 robots 상태도 이 WU 에서 재확인하지 않았다(선행 domval-robots 범위)
```

🔴 **그래서 승격 후보로 «올리지 않았다».** CPO §「실측 근거가 있는 샵만 승격
후보로 다룬다」를 지켰다. 다음 작업은 **product path 1건 관찰** 이고 그건 live
fetch 1~2회다 — 🔴 이 WU 의 범위(정책 검증)를 넘으므로 하지 않았다.

---

## 6. ③ MANUAL 12곳 조사 우선순위 — 🟢 근거 있는 것만 정렬

🟢 판별 기준은 이미 확정돼 있다(메모 `auto-source-adoption-standard`):
「우리 UA 가 robots 에서 허용되는가」 **그리고** 「상품명·URL·설명문에 해외
브랜드 품번을 적는가」.

| 순위 | 샵 | 근거 | 상태 |
|---|---|---|---|
| **1** | `coconjennie.com` | 🟢 우리 브랜드 **4개** 취급 실측 | 🔴 product path 미관찰 |
| 2 | `kidikidi.elandmall.co.kr` | `VERTICAL`(049) · scope `KIDS_FASHION,KIDS_GOODS` | 🔴 미측정 |
| 3 | `oco.co.kr` · `무신사 키즈` · `29CM 키즈` · `W컨셉` · `SSF SHOP` | `MARKETPLACE`(049) | 🔴 미측정 · 🔴 **ws 설정이 이미 OFF**(사람이 껐다) |
| — | `chouchouenfant.kr` | 🟢 Bobo 취급 — **그러나 현 시즌 0**(품번 50건 전수에 현행 226 = 0, 아웃렛) | 🔴 **제외 근거 확보** |
| — | `nokimore.com` · `karymarket.com` | 🟢 교집합 **0** | 🔴 **제외 근거 확보** |
| — | `kream` · `다나와` | 중고/가격비교 — 우리 축이 아니다 | 🔴 미조사 |

🔴 **3순위 그룹은 「조사 전에 정책 질문이 먼저」다** — `MARKETPLACE` 5곳은 사람이
ws 설정에서 **이미 껐다**(29CM/SSF/W컨셉 5~6 workspace). 그 선택을 되돌릴지가
조사보다 앞선다.

## ④ `NOT_AVAILABLE` 12곳 — 🟢 **약관 경계 유지**
쿠팡 · 네이버 스마트스토어 · G마켓 · 11번가 · SSG · 롯데ON · GS SHOP · CJ온스타일 ·
옥션 · 현대H몰 · 에누리 · KREAM. 🔴 승격 대상이 아니다(메모
`portal-scraping-blocked-by-terms`). 🟢 네이버 쇼핑은 `API_DISCONTINUED` 로 별도.

## ⑤ `AW26` / 브랜드 공백 — 🟢 **분리했다**
```
AW26 40건(링크 0 기준) · 브랜드 공백 25건 → **Registry 문제가 아니다.**
브랜드 추출/backfill 축이고, 🔴 선행 WU 가 brand backfill 변경을 **금지** 했다.
→ 별 과제로 분리한다. 이 WU 에서 손대지 않았다.
```

---

## 7. 판정 — **HOLD**

```
🟢 Registry 분류는 «의도대로» 작동한다 — ON/OFF(workspace) 와 수집전략(카탈로그)이
   서로 다른 두 문이고, 둘 다 통과해야 검색된다. 설계 결함을 찾지 못했다.
🔴 그런데 실효 검색 샵이 **아동의류 6개** 이고 실제로 링크를 만든 것은 **3개** 다.
🔴 그 좁음의 원인 둘은 **사람의 선택**이다 —
   ① Bobo Choses Korea 를 2026-09-10 에 껐고 047 이 전 workspace 로 번지게 했다
   ② MARKETPLACE 5곳(29CM·SSF·W컨셉 등)을 ws 설정에서 껐다
🟢 즉 다음 레버는 코드가 아니라 **그 선택을 유지할 것인가** 다 → CPO/CEO.
```

🔴 **CPO 금지사항 준수** — `MANUAL→AUTO` 일괄 변경 0 · 실측 근거 없는 승격 제안 0 ·
Production 0 · DB 0.

---

## 8. 🔴 CPO/CEO 결정 — **셋** (전부 「되돌릴 것인가」 형태다)

```
① Bobo Choses Korea(공식)를 다시 켤 것인가.
   🟢 근거: 링크 36%(32/88)의 출처였고 AUTO_API 다 · GLOBAL seller_type
   🔴 위험: 047 구조상 다시 켜면 **6개 workspace 전부** 에 영향
   🔴 그리고 끈 이유가 UNKNOWN 이다(감사 로그 미확인)
② MARKETPLACE 5곳(29CM·SSF·W컨셉·무신사·OCO)의 OFF 를 유지할 것인가.
   🔴 이들은 MANUAL 이라 켜도 검색되지 않는다 — 켜는 것과 승격이 **둘 다** 필요하다
③ coconjennie 를 조사할 것인가(product path 1건 관찰 → AUTO_SCRAPE 승격 판단).
   🟢 우리 브랜드 4개 취급이 실측됐다. 🔴 지금은 UNKNOWN 이고 추측 승격 금지
```

## 9. Known Unknowns

```
🔴 Bobo Choses Korea 를 «누가 왜» 껐는지 — `audit_log` 가 샵 토글을 기록하지 않아
   **구조적으로 확인 불가** 다(「안 봤다」가 아니다)
🔴 coconjennie product path · robots 현재 상태 미관찰
🔴 MANUAL 12곳 중 9곳 미측정 (조사된 것은 coconjennie · chouchouenfant ·
   nokimore · karymarket 4곳이고 그중 2곳은 제외 근거 확보)
🔴 CHOCO.EL · LOOXLOO · RULII 가 실효 ON 인데 링크 0 인 이유는 선행 WU 결론을
   재사용했다(교집합/품번 표기) — 이 WU 에서 재측정하지 않았다
🟢 스냅샷 보유 4곳 중 링크 0 인 2곳은 **설정 차이가 아니다** — 실측으로
   **스냅샷이 각각 1개뿐** 이다(461 · 35 · 1 · 1). 설정행도 같다(5 · 5 · 5 · 0)
🟢 ws 설정 ON 3개를 확인했다 — **29CM 키즈 · W컨셉 · 무신사 키즈**(전부
   workspace `b60b0ad7…`). 🔴 셋 다 `MANUAL` 이라 **켜도 검색되지 않는다**
   → 「셀러가 켠 샵이 실제로는 안 뒤져진다」는 UX 간극이다(별 과제)
```
