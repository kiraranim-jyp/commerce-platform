# MSRUX-1 D·C — 계약 스윕 착수 노트 (브랜치 `wip/msrux-1-dc` 전용)

🔴 **스윕을 시작하기 «전» 에 고쳐야 할 결함이 하나 있다.** 그대로 스윕하면 **틀린 기반**을
정답으로 굳힌다.

## 🔴🔴 결함 — D 수술이 「동일상품 확정 N건」 줄을 잃었다

```
증상   해외 SAME **3건** 인데 화면에는 「동일상품 확정 0건」(국내)만 있고
       해외의 「동일상품 확정 3건」 줄이 **없다**
잡은 것 내 B 계약 `msrux-1b-card-shell-parity.test.ts` B-4
       (D 적용 «전» 에는 4/4 PASS 였다 ⟹ **D 가 만든 회귀** 다)
```
🔴 즉 D 수술의 유지 목록(`market-judgement`·`seller-decision(-line)`·`market-split`·
`market-verdict`)이 **충분하지 않았다** — `market-same-count-{suffix}`(건수 줄)도
**판단 결과** 이고 CPO 유지 목록에 암묵적으로 포함된다(A 에서 이름을 바꾼 그 지표다).

🟢 **고치는 법** — `d-surgery.mjs` 의 유지 범위에 그 줄을 **추가** 한다. 좌표는
`MarketPriceComparison.tsx` 의 `market-same-count-${suffix}` 블록 둘(0분기 · price-guide 분기)
이고, 둘 다 `isSummary` 조건 안에 있다.

## 스윕 범위(실측)

```
통합 회귀   **127 failed / 10,734 passed**  · 실패 테스트 파일 **약 40**
분류 규칙   ⒜ 유지 testid → 유지 단언 **추가**
            ⒝ 제거한 UI → 제거 단언으로 갱신 + **보존 단언을 같이** 둔다
            ⒞ `Cannot read properties of null (reading 'textContent')` 11건은
               제거된 testid 를 쿼리한 뒤 바로 읽는 모양이다(기계적 갱신 대상)
🔴 테스트 제외(skip)·무력화로 해결하지 않는다(CPO 금지).
```

## 순서

1. 위 결함 수정 → `msrux-1b` **4/4 복구** 확인
2. 127건 전수 분류·갱신
3. B·D·C 통합 회귀 · typecheck · build
4. **전부 PASS 일 때만** main 병합 → Production 배포 확인
