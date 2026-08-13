import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** N-3.24 — 제안 3안(다크모드/임팩트형) 히어로 구성을 OG 이미지로 재현한다.
 * Deep Navy 배경 + 흰색 "따져" 워드마크 + Vivid Green "TTAEJYO" + 태그라인.
 * 이미지 asset 없이 텍스트/도형만으로 구성한다(STEP 1 조사 결과: 로고 파일
 * 자체가 없어 새로 만들지 않고 시안 텍스트/컬러 스펙만 그대로 재현). */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#0A1F44",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "#0A1F44",
              border: "3px solid rgba(255,255,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="70" height="70" viewBox="0 0 32 32" fill="none">
              <circle cx="13.5" cy="13.5" r="6.5" stroke="white" strokeWidth="2.4" />
              <line x1="18.2" y1="18.2" x2="23" y2="23" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
              <path
                d="M10.5 13.7L12.6 15.9L17 10.8"
                stroke="#00E676"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "white", lineHeight: 1 }}>따져</div>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#00E676", letterSpacing: 4 }}>
              TTAEJYO
            </div>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 48, fontSize: 40, fontWeight: 700, color: "white" }}>
          이거 사서 팔아도 남아?
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 26, color: "rgba(255,255,255,0.75)" }}>
          원가부터 마진까지, 따져드립니다.
        </div>
      </div>
    ),
    { ...size },
  );
}
