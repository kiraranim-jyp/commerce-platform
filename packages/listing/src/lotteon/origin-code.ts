/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-FINAL-02 P0 — 원산지 텍스트 → 롯데ON 원산지코드(OPLC_CD)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 생겼나 ──────────────────────────────────────────────────────────────
 * 실제 LotteON 등록이 이 필드에서 막혔다. 화면은 「롯데ON 원산지코드(공통코드
 * OPLC_CD)가 지정되지 않았습니다」라고만 말하고, 셀러가 239개 목록에서 손으로
 * 고르게 했다. 그런데 **원산지는 우리가 이미 갖고 있다** — 같은 값이 쿠팡·
 * 네이버에는 그대로 나간다.
 *
 * 🔴 이전에는 일부러 매핑하지 않았다(`useLotteOnCommonCodes` 아래 주석:
 * 「매핑이 아니다. 코드를 고르지도 않는다」). 그 보수적 결정을 CPO 가 뒤집었다
 * (2026-09-29): 「이걸 상세페이지 참조로 고정하는 것은 현재 구조상 후퇴다.
 * 기존 OPLC_CD 목록과 기존 원산지 값을 재사용해 정확 매칭만 한다.」
 *
 * ── 🔴 이 파일이 지키는 것 ─────────────────────────────────────────────────
 * **코드를 «만들지» 않는다.** 고르는 것은 언제나 롯데ON 이 준 239개 중 하나다.
 * 못 맞추면 `null` 이고, 그때는 셀러가 고른다. 첫 LIVE 등록이 거절된 이유가
 * 바로 「코드 자리에 코드가 아닌 것」을 보낸 것이었다
 * (`"oplcCd": "OPLC_CD"` ← 코드그룹 «이름»).
 *
 * 🔴 여럿이 맞으면 «고르지 않는다». 배송지 `autoPick` 과 같은 규칙이다 —
 * 여럿 중 하나를 우리가 고르면 틀린 값이 조용히 나간다.
 */

/** 롯데ON 공통코드 한 줄. `/api/lotteon/common-codes?group=OPLC_CD` 가 주는 모양. */
export interface LotteOnCommonCode {
  code: string;
  name: string;
}

/** 앞뒤 공백과 연속 공백만 정리한다. 🔴 값을 «바꾸지» 않는다. */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * 🔴 LOTTEON-FINAL-05 — «임의의 제한 목록» 을 없앤다.
 *
 * 여기 있던 것: 손으로 적은 19개국 표(`spain: "스페인"` …). 우리 소싱 국가만
 * 담아 두었고, 목록에 없는 나라는 조용히 매칭에 실패했다. **우리가 지원 국가를
 * 정하는 구조였다** — 그건 롯데ON 목록이 정할 일이다.
 *
 * 대신 **플랫폼이 가진 ISO-3166 국가명**을 쓴다(`Intl.DisplayNames`). 영어 이름과
 * 한국어 이름을 같은 코드로 이어 역색인을 만든다. 우리가 «번역하지» 않는다 —
 * 표준 데이터를 읽을 뿐이다.
 *
 * 🔴 그래도 고르는 것은 언제나 «롯데ON 이 준 목록» 안의 코드다. 이 색인은
 * 「Spain 과 스페인이 같은 나라다」만 말하고, 코드는 롯데ON 목록에서 찾는다.
 */
function buildCountryNameIndex(): Map<string, string> {
  const index = new Map<string, string>();
  try {
    const ko = new Intl.DisplayNames(["ko"], { type: "region" });
    const en = new Intl.DisplayNames(["en"], { type: "region" });
    /* ISO-3166 alpha-2 전체(AA~ZZ). 실재하지 않는 조합은 DisplayNames 가
       입력을 그대로 돌려주므로 걸러 낸다. */
    for (let a = 65; a <= 90; a += 1) {
      for (let b = 65; b <= 90; b += 1) {
        const code = String.fromCharCode(a, b);
        let koName: string | undefined;
        let enName: string | undefined;
        try {
          koName = ko.of(code);
          enName = en.of(code);
        } catch {
          continue;
        }
        if (!koName || koName === code) continue;
        /* 한국어 이름 → 한국어 이름(자기 자신), 영어 이름 → 한국어 이름. */
        index.set(koName.toLowerCase(), koName);
        if (enName && enName !== code) index.set(enName.toLowerCase(), koName);
      }
    }
  } catch {
    /* 🔴 Intl 이 없으면 색인 없이 간다 — 원문 그대로만 매칭한다.
       기능이 조용히 «틀리는» 것이 아니라 «덜 맞추는» 쪽으로 떨어진다. */
  }
  return index;
}

let countryNameIndex: Map<string, string> | null = null;
function koreanCountryName(name: string): string | undefined {
  if (!countryNameIndex) countryNameIndex = buildCountryNameIndex();
  return countryNameIndex.get(name.toLowerCase());
}

/**
 * 🔴 LOTTEON-FINAL-03 A — Production 에서 «여기서» 끊겼다.
 *
 * 순수 함수도 DOM 도 PASS 였는데 실제 상품에서 원산지가 비었다. 원인은 매칭이
 * 아니라 **입력의 모양** 이었다 — 상품 원문은 `"스페인"` 이 아니라
 * **`"Made in Spain"`** 처럼 «문장» 으로 온다(`resolveCommonOrigin` 은 원문을
 * 그대로 통과시킨다. 정규화하는 곳이 없다).
 *
 * 🔴 네이버가 안 터진 이유: 네이버는 못 맞추면 `OTHER_MANUAL`(코드 04 = 기타)로
 * 조용히 떨어진다. 롯데ON 에는 그런 폴백이 없어서 «빈 값» 이 된다.
 *
 * 그래서 붙이는 것은 «라벨 제거» 뿐이다. 나라 이름을 추측하지 않는다 —
 * 벗겨낸 나머지를 여전히 «정확 일치» 로만 본다. 못 맞추면 그대로 null 이다.
 */
const ORIGIN_LABEL_PATTERNS: RegExp[] = [
  /^made\s+in\s+/i,
  /^manufactured\s+in\s+/i,
  /^origin\s*[:：]\s*/i,
  /^(?:원산지|제조국|생산지)\s*[:：]?\s*/,
];

/** 라벨을 벗긴다. 벗길 것이 없으면 원문 그대로다. */
function stripOriginLabel(value: string): string {
  let out = value;
  for (const pattern of ORIGIN_LABEL_PATTERNS) out = out.replace(pattern, "");
  /* 꼬리의 마침표·쉼표만 떼어 낸다. 🔴 국가명 안의 글자는 건드리지 않는다. */
  return normalize(out.replace(/[.,·]+$/, ""));
}

/** 이름 후보를 만든다 — 원문 · 라벨 벗긴 값 · 영문이면 한국어 표기. */
function candidateNames(originText: string): string[] {
  const raw = normalize(originText);
  if (!raw) return [];
  const names: string[] = [];
  const push = (value: string) => {
    if (value && !names.includes(value)) names.push(value);
  };
  /* 🔴 원문을 «먼저» 본다 — 목록에 그 표기가 그대로 있으면 벗길 이유가 없다. */
  push(raw);
  const stripped = stripOriginLabel(raw);
  push(stripped);
  for (const name of [raw, stripped]) {
    const ko = koreanCountryName(name);
    if (ko) push(ko);
  }
  return names;
}

/**
 * 원산지 텍스트로 OPLC_CD 를 고른다.
 *
 * @returns 고른 코드 한 줄, 또는 `null`(못 맞췄거나 여럿이 맞았다 → 셀러가 고른다)
 */
export function autoPickLotteOnOriginCode(
  items: readonly LotteOnCommonCode[],
  originText: string | null | undefined,
): LotteOnCommonCode | null {
  const candidates = candidateNames(originText ?? "");
  if (candidates.length === 0 || items.length === 0) return null;

  for (const candidate of candidates) {
    /* 🔴 정확 일치만 본다. 「스페인」이 「스페인령 ○○」에 부분일치해서 엉뚱한
       코드가 잡히는 것을 막는다. 대소문자는 라틴 문자에서만 의미가 있어 무시한다. */
    const key = candidate.toLowerCase();
    const matched = items.filter((item) => normalize(item.name).toLowerCase() === key);
    if (matched.length === 1) return matched[0];
    /* 🔴 여럿이면 «고르지 않는다» — 여기서 하나를 집으면 틀린 원산지가 조용히 나간다. */
    if (matched.length > 1) return null;
  }
  return null;
}
