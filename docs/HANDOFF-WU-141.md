# 🟡 WU-141 — **국내 SAME 확보 경로 개선** (CPO 지시 2026-10-21 · 🔴 착수 전)

> 🔴🔴 **이 WU 는 «게이트» 가 열린 뒤에만 시작한다**(CPO §0):
> ```
> WU-140-R1 CEO UI 확인  →  PASS  ⟹ R1 닫고 WU-141 시작
>                        →  FAIL  ⟹ 🔴 국내 MI 작업 **시작하지 않고** UI 원인만 최소 수정
> ```
> 🔴 이 문서가 작성된 시점에 **측정 0 · 구현 0** 이다. 아래는 **CPO 지시 + 이미 측정된
> 출발값** 이고, 다음 세션이 **준비 없이 §3 부터 들어가게** 하기 위한 것이다(헌장 §4-C).

---

## ① 목표 — 「가격 수집」이 아니다

> **실제로 존재하는 국내 SAME 상품을 MI 가 «안전하게» SAME 으로 확정할 수 있는 경로 확보.**

```
국내 후보 → SAME 확정 → 판매중 확인 → 가격 있으면 가격 / 없으면 🔗 링크
🔴 **가격 추출 실패를 SAME 실패와 혼동하지 않는다**(CPO §8).
   SAME O + 가격 X + 링크  ⟹ 🟢 기능적으로 **유효한 결과**
   SAME X + 가격 ₩88,000   ⟹ 🔴 가격이 아무리 정확해도 시장가격 판단에 **넣지 않는다**
```

🔴 **recall 보다 false SAME 방지가 우선** 이다(CPO §6). 「국내 SAME=0」을 풀려고 MI 를
약하게 만들지 않는다 — 원하는 것은 **많은 후보가 아니라 믿을 수 있는 SAME** 이다.

---

## ② 대상 — human SAME **2건만**. 새 GT 를 만들지 않는다

```
B226AC009  biskuit.kr
B226AC010  beaumonde.co.kr
```

---

## ③ 🟢🟢 **출발값 — 이미 측정돼 있다. 다시 재지 않는다**

🟢 WU-138 하니스(`WU_138_PROBE=1`)로 **URL 단위 전수** 가 이미 났고, **2026-10-21 R1
세션에서 재현 확인** 됐다. 🔴 그래서 CPO §3 의 표는 **이미 채워져 있다**:

| URL | human | 후보 | 판정 | 대표 | tier | 시장 | 판매 | 가격 | 최종 | 막는 축 |
|---|---|---|---|---|---|---|---|---|---|---|
| `biskuit.kr` | SAME | O | O | O | PRESUMED_SAME | **KR** | UNKNOWN | **KRW 88,000** | ✗ | `BRAND_MISMATCH` · `NO_TITLE_OVERLAP` |
| `beaumonde.co.kr` | SAME | O | O | O | PRESUMED_SAME | **UNKNOWN** | UNKNOWN | **없음** | ✗ | `BRAND_UNCONFIRMED` |

🔴🔴 **그래서 CPO §4(Discovery Gap)의 답이 이미 나와 있다 — 「못 찾는 것」이 아니다.**
```
두 URL 모두 **후보가 생성되고 MI 판정까지 도달한다.** Registry/검색범위 문제가 아니다.
⟹ 🔴 병목은 §4 가 아니라 **§5·§6(MI verdict)** 다. Discovery 쪽을 파지 않는다.
🟡 단 WU-138 이 측정한 다른 사실 하나 — 국내 human **DIFFERENT 3건**
   (`m.luxboy.com` · `luksusbaby.kr` · `kream.co.kr`)은 **후보 자체가 안 생긴다**(축 C).
   🔴 그것은 지금 **방어가 되고 있는 것** 이므로 열지 않는다.
```

재현 명령(측정이 필요할 때만):
```bash
cd apps/admin
WU_138_PROBE=1 npx vitest run src/app/api/price-history/_lib/__tests__/wu-138-domestic-funnel.test.ts
```

---

## ④ 🔴🔴🔴 **이미 REJECT 된 레버 — 다시 측정하지 않는다**

| 레버 | 측정 결과 | 출처 |
|---|---|---|
| `NO_TITLE_OVERLAP` 비차단(품번 exact 조건) | 🔴 **순손실** — 국내 0→**0** · DIFFERENT 방어 4/4→**3/4** · 가격 축에 KRW 59,000(human DIFFERENT) 유입 | WU-138 반사실 |
| `BRAND_MISMATCH` 제거(`extractSiteBrandName`) | 🟡 거짓 신호인 것은 **맞다**(biskuit 가 brand 자리에 자기 이름 「비스킷」) · 🔴 **효과 국내 0 → 0**(NO_TITLE_OVERLAP 이 남는다) | WU-138 |
| `BRAND_UNCONFIRMED` **단독** 완화 | 🔴 **FP +2 실측** · DIFFERENT 개방 | WU-059 · WU-080 |
| 원상품 brand 공백 메우기 | 🔴 보류→**충돌** 로 악화(SAME 4 더 막힘 · DIFFERENT 2 열림) | WU-080 CF-3 |
| threshold · 8축 · `crossSellerReserved` 우회 | 🔴 **전부 CLOSED**(precision 91.7%→55.6% 실측 포함) | WU-063~080 · WU-066 |

🔴🔴 **그러므로 `biskuit.kr` 은 현재 구조에서 열 수 있는 레버가 «없다»** — 남은 단독
blocker 가 `NO_TITLE_OVERLAP` 이고 그것이 위 표의 첫 줄이다. 🔴 CPO §5 도 「다시 열지
않는다」고 명시했다. ⟹ **biskuit 를 여는 방향으로 WU-141 을 설계하지 않는다.**

---

## ⑤ 🟡 **아직 측정되지 않은 축 하나 — `beaumonde` 후보측 brand** (가설 · 미검증)

🔴 **이것은 가설이다. CTO 가 아직 측정하지 않았다**(게이트 때문에 시작하지 않았다).

```
관측된 사실 둘:
  ① B226AC010 **원상품** brand 는 **있다** — 라이브 실측 `brand="Bobo Choses"`
     (WU-134 의 siteBrandName 복구가 원상품 쪽에서 작동한다)
  ② 그런데 beaumonde 의 blocker 는 `BRAND_UNCONFIRMED` **하나** 다
⟹ 🟡 그렇다면 그 blocker 는 **후보(beaumonde) 쪽 brand 가 null** 이라서 걸릴 가능성이 있다
   (`brandKnown = Boolean(x.brand && y.brand)` 에서 y 가 후보다)

🔴 WU-080 이 REJECT 한 것은 **원상품(x) 쪽 공백 메우기** 였다 ⟹ **후보(y) 쪽** 은
   그 측정의 분모가 아니었을 **가능성** 이 있다. 🔴 단정하지 않는다 — 확인이 먼저다.
```

🔴 **그래서 WU-141 의 첫 작업은 이것이다**(구현이 아니라 **확인**):
```
① beaumonde 후보의 `brand` 가 실제로 null 인지 운영 함수로 확인
② null 이면 그 이유를 확인한다(페이지에 brand 가 없는가 / 읽는 칸이 없는가)
③ 🔴 **그 페이지에 brand 가 없으면 거기서 끝이다** — 지어내지 않는다(WU-080 금지축)
④ brand 가 페이지에 **있는데 못 읽는** 경우에만 counterfactual 로 넘어간다
⑤ counterfactual 은 CPO §6 그대로 — human DIFFERENT **3건이 같이 열리는지** 본다
   🔴 SAME 증가 + DIFFERENT 누출 ⟹ **즉시 폐기**
```

🔴 그리고 `beaumonde` 는 **가격이 없어 market UNKNOWN** 이다(WU-077 ⒞) ⟹ SAME 이 되어도
🇰🇷 블록에 바로 서지 않는다. 🟢 그 경우 WU-140-R1 의 **「시장 미확정 후보 N곳」 줄**이
그 사실을 이미 말한다(거짓말하지 않는다). 🔴 **가격 축을 함께 열지 않는다**(CPO §8).

---

## ⑥ 🔴 금지 (CPO §4·§5·§11 전수)

```
❌ Registry 대규모 확대 · 신규 category adapter 대량 추가 · 국내 전체 크롤러 구축
❌ threshold 완화 · `NO_TITLE_OVERLAP` 재개방 · 8축 재설계
❌ SIMILAR/PRESUMED_SAME 을 가격비교에 포함 · 국내 SAME 0 인데 가격을 시장가처럼 표시
❌ 새 UI 영역 — 국내 가격비교 패널 · 동일상품 가격비교 패널 · 별도 AI 조사 패널 ·
   상단 보조 가격 위젯. 🟢 국내 결과는 **「📊 시장 판매 판단」 하나** 안에 들어간다
❌ 원인 미확정 상태에서 코드 수정(CPO §7)
```

## ⑦ 완료 게이트 (CPO §7·§10·§12)

```
root cause 확정 → human SAME 개선 확인 → human DIFFERENT 방어 확인 → 최소 수정
→ contract → negative/mutation → E2E **B226AC009 그리고 B226AC010**(한 상품만이면 미완)
→ regression → typecheck → build → deploy → **그 다음에 CEO 1회**
```

🔴 성공 기준은 「국내 가격 100% 수집」이 **아니다**:
> **검증된 국내 SAME 을 놓치지 않고, SAME 으로 확인된 것만 국내 판매/가격 판단에 넣고,
> 가격이 없으면 링크로 셀러가 직접 확인할 수 있게 하는 것.**

🟡 **허용되는 결과** — 「국내 SAME 1+ · 판매/가격 일부 확인 불가 · 링크 표시」.
🔴 그리고 **「안전한 레버가 없다」도 정당한 결론이다**(WU-138 이 그렇게 닫혔다) —
그때는 **구현 0 으로 종료** 하고 무엇이 막는지를 코드 위치와 함께 올린다(헌장 §4-B ⑦⑧).
