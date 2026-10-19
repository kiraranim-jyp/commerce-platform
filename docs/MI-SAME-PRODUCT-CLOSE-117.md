# WU-117 — **동일상품 단계 마무리** (CPO 결정 ⒞ · 2026-10-20)

> 🔴 CPO: 「⒞ 현재 확보된 후보로 동일상품 단계 마무리 → 진행」 · CEO GT: `kream.co.kr` **DIFFERENT**

---

# [동일상품 단계 종료 보고]

## 1. 마지막 GT 1건 — 🟢 **시스템이 맞았다**

```
kream.co.kr 「(Kids) Bobo Choses Long Puff T-Shirt Lavender」
  시스템  market KR · **CONFLICT** · 품번 null   (가격비교에서 제외되는 쪽)
  CEO     **DIFFERENT**
⟹ 🟢 **올바른 차단** · 라벨 `fixtures/wu-116-human-gt.json`(URL 키)
```

🔴🔴 **그래서 MI 수정 조건이 성립하지 않는다** — CPO 가 고정한 두 조건은
⒜ DROPPED 안의 Human SAME ⒝ 시스템 SAME 중 Human DIFFERENT 였고,
이번 1건은 **둘 중 어느 것도 아니다**(시스템 CONFLICT · Human DIFFERENT = 일치).
⟹ 🟢 **MI 를 더 고치지 않는다.**

## 2. 동일상품 단계 — **누적 GT 28건**

```
WU-112  27건 — SAME 19 · DIFFERENT 6 · UNCERTAIN 2
WU-116   1건 — DIFFERENT 1
WU-111   2건(그 27 중 2건과 동일 후보 · 둘 다 SAME)   ← 중복이라 합산하지 않는다
⟹ 🟢 **총 28건** 의 Human GT 가 확보됐다
```

### 🟢 WU-113 이후(현재 배포 상태) 정확도

```
금액 집계에 들어간 후보       9건 — Human SAME **9** · DIFFERENT **0**   ⟹ 🟢 **오포함 0**
tier EXACT                   6건 — Human SAME **6** · DIFFERENT **0**   ⟹ 🟢 **정밀도 6/6**
해외 통화별 최저가            USD **58** · EUR 40 · GBP 33 · CAD 64 (전부 Human SAME 후보)
🇰🇷 국내                      biskuit.kr **KR · COMPARISON · 샵 대표** (Human SAME)
🔴 재현율은 낮다 — Human SAME 19 중 가격비교 반영 **9** (나머지는 ⑧ 게이트 3 ·
   샵 2순위 1 · 품번 충돌 EXCLUDED 4 · 가격 없음 1 · KRW+시장미확정 1)
   🔴 그 다섯 자리는 **CPO 가 P2~P5 로 보류** 했다 — 이번에 열지 않았다
```

## 3. 국내 동일상품 — **확정된 사실 셋**

```
① 🟢 국내 Human SAME 은 **2건**(biskuit.kr · beaumonde.co.kr)이고 **둘 다 샵 대표로 화면에 선다**
   ⟹ 🔴 「국내 SAME 이 UI 에 안 보인다」는 **사실이 아니다**(WU-114)
② 🔴 공급이 적다 — 등록부 경로 **0**(어댑터 부재 · WU-115) · AI 경로 신규 **1건**(그것도 DIFFERENT · WU-116)
③ 🔴 beaumonde 는 **가격이 없어** market UNKNOWN 이라 국내 축에 못 들어간다
   ⟹ 🔴 **가격 단계의 일** 이다(§00-B 보류) — 이번에 손대지 않았다
```

## 4. E2E / 배포 / 작업트리

```
코드 변경 **0**(이번 WU) — 동일상품 경로의 마지막 수정은 **WU-113**(배포 `main` · 반영 완료)
회귀(WU-113 시점) **603 files / 8,396 passed · failed 0** · typecheck 0 · build exit 0
Production smoke — `/` **200** · `/pipeline` 307(인증 보호 · 정상)
작업트리 clean · origin/main 과 **ahead 0 / behind 0**
```

## 5. 🟡 CEO Action — **따져 실제 화면 1회**(동일상품 단계 최종 확인)

```
https://ttaejyo.vercel.app/pipeline  — B226AC009 / B226AC010
🔴 보실 것 둘
  ① 🌎 해외 동일상품 참고가격의 **USD 최저가가 58** 인지(53 이면 FAIL · WU-113 수정 지점)
  ② 🇰🇷 국내 비교에 **biskuit 한 줄** 이 서는지
🟢 정상인데 FAIL 로 보이기 쉬운 것 셋
  · 국내 줄이 **1건뿐** 인 것 — 공급 부족이고 **버그가 아니다**(WU-114/115/116)
  · 「동일상품 아님」으로 표시된 후보가 있는 것 — **의도된 표시**(WU-091)
  · 「가격 확인 필요」가 붙은 후보가 있는 것 — **가격 단계 보류 사안**(WU-111)
```

## 결론 — 🟢 **동일상품 단계 CLOSED**

```
GT 누적 **28건** · 오포함 **0** · tier EXACT 정밀도 **6/6** · MI 추가 수정 **불필요**
🔴 재현율(19→9)은 **P2~P5 보류** 때문이고 CPO 가 그 순서를 고정했다
⟹ 🟡 **CEO 최종 화면 확인 1회 뒤 가격 단계로 넘어간다**
```
