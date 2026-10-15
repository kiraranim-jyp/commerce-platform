# WU-019A-SEARCH-ALT ② — S1·S2 후보의 **독립 GT 확정**

🔴 추가 DDG 검색 **0** · AI API 0 · 키 0 · 비용 **₩0** · 운영 코드 변경 0 · 배포 0.
🟡 후보 페이지 재확인 GET **10회**.
🔴 **MI 판정을 GT 로 쓰지 않았다** — 실제 페이지의 품번·상품명·색상을 직접 받아 판정했다.

---

## GT 규칙 (기존 그대로)
```
1순위 품번(brandModelCode)  2순위 상품명 토큰  3순위 색상
🔴 품번이 본문에 있고 색상이 어긋나지 않으면 SAME · 색상을 읽지 못하면 그 사실을 적는다
🔴 색상이 «다르면» SAME 이 아니다(WU-018 B10 규칙 유지)
```

## S1 — 원상품 `B226AC010` Booty Ghosts LS T-Shirt · **Heather Grey**

| 후보 | 품번 | 상품명 | 색상 | **GT** | MI | 일치 |
|---|---|---|---|---|---|---|
| bobochoses.com/b226ac010 | 🟢 | 🟢 | 🟢 heather grey | **SAME** (known-positive) | `SAME` 0.97 | 🟢 |
| **global.trenbe.com** | 🟢 본문 일치 | 🔴 「Twin Ghost」(판매처 표기 다름) | 🟡 grey 있음 | 🟡 **SAME(조건부)** | `SAME` 0.97 | 🟡 |
| bobochoses.co.jp/b226ac010 | 🟢 | 🟢 | 🟢 | **SAME**(다른 시장) | `PRESUMED_SAME` 0.95 | 🟡 보수적 |
| **peipeicollection.com** | 🟢 | 🟢 | 🔴 **색상 미확인** | 🟡 **SAME(색상 미확인)** | `SIMILAR` 0.75 | 🟡 보수적 |
| **advicefromacaterpillar.ca** | 🟢 | 🟢 | 🟢 제목에 Heather | **SAME** | `PRESUMED_SAME` 0.58 | 🟡 보수적 |

🔴 **trenbe 를 「확정 SAME」으로 적지 않는다** — 품번이 **본문에** 있지만 그것이 그 상품의
품번인지 관련상품 목록의 품번인지 이 증거로는 가르지 못한다(리셀 플랫폼). 🟡 조건부다.

## S2 — 원상품 `B226AC009` Hug Hairy Monster T-Shirt · **Light Blue**

| 후보 | 품번 | 상품명 | 색상 | **GT** | MI | 일치 |
|---|---|---|---|---|---|---|
| bobochoses.com/b226ac009 | 🟢 | 🟢 | 🟢 | **SAME** (known-positive) | `SAME` 1.0 | 🟢 |
| www.bobochoses.com/…(같은 샵 변형) | 🟢 | 🟢 | 🟢 | **SAME**(사실상 중복) | `SAME` 1.0 | 🟢 |
| **junioredition.com** | 🟢 | 🟢 | 🟢 | **SAME** | `SAME` 1.0 | 🟢 |
| **tinyapple.net** | 🟢 | 🟢 | 🟢 제목에 Light Blue | **SAME** | `SAME` 0.79 | 🟢 |
| **advicefromacaterpillar.ca** | 🟢 | 🟢 | 🟢 | **SAME** | `SAME` 0.69 | 🟢 |

---

## 층 A — Discovery (DDG 가 어디까지)
```
유효 2상품(4/6 은 차단으로 측정불가)
known-positive 발견            입력 URL 기준 1/7 · 검증 URL 기준 2/7
GT 확정 **신규** SAME(등록부 밖) **6건**
   junioredition · tinyapple · advicefromacaterpillar(×2) · bobochoses.co.jp
   + 🟡 조건부 trenbe · 🟡 색상 미확인 peipeicollection
🔴 「DDG 가 MI 보다 좋다」로 적지 않는다 — 분모가 2상품이고 4회가 차단됐다
```

## 층 B — Identity (MI 가 그 후보들을)
```
GT=SAME 10건 중
  MI SAME            7   🟢 전건 GT 와 일치
  MI PRESUMED_SAME   2   🟡 보수적(확정 보류) — GT 로는 SAME
  MI SIMILAR         1   🟡 보수적 — 색상을 읽지 못한 그 후보다
🟢🟢 **MI False SAME = 0** — MI 가 SAME 이라고 한 7건이 **전부 실제 SAME** 이었다
🔴 MI 가 틀린 쪽은 전부 «덜 확정하는» 방향이다(가격 오염 위험이 아니다)
🔴 sample N=10 후보 / 원상품 2 — 일반화하지 않는다
```

🟢 **보수적 3건의 원인이 WU-018 과 같은 축이다** — `PRESUMED_SAME`·`SIMILAR` 가 나온 세
후보 중 둘은 **색상/시장 증거가 약한** 경우다(peipeicollection 은 색상 미확인 · `.co.jp` 는
다른 시장). 🔴 그 축을 바꾸지 않았다(색상 사전 0 · 보류 정책 0 · threshold 0).

---

## 이번 단계의 **정확한 결론** (CPO 문장 유지)
> DDG 6회 PoC 는 4회 차단으로 **정량 평가 불가**. 그러나 차단되지 않은 S1/S2 에서
> **등록부 외 후보가 실제 확보**되었고, 독립 GT 로 그중 **6건이 SAME 으로 확정**됐다.
> → `검색 기반 Discovery → MI Identity` 파이프라인의 **유효성을 추가 검증할 가치가 확인**됨.

🔴 금지 표현 유지 — 「DDG 가 MI 보다 좋다」 ❌ · 「MI Discovery 가 틀렸다」 ❌(N=2) ·
「Recall」 ❌ · 「AI 가 못 찾았다」 ❌.
🔴 **CEO Action: NONE.**
