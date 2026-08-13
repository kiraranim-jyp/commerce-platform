import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** N-3.24 — icon.svg(BrandMark)와 동일한 심볼을 Apple Touch Icon 규격(180x180
 * PNG)으로 렌더링한다. Satori(next/og) 기반이라 SVG path보다 검증된 primitive
 * (svg/circle/line/path)만 써서 렌더링 실패 위험을 줄인다 — icon.svg와 같은
 * 좌표계를 32→180 스케일로 그대로 확대했다. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#0A1F44",
          borderRadius: 45,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 32 32" fill="none">
          <circle cx="13.5" cy="13.5" r="6.5" stroke="white" strokeWidth="2.4" />
          <line x1="18.2" y1="18.2" x2="23" y2="23" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
          <path
            d="M10.5 13.7L12.6 15.9L17 10.8"
            stroke="#00E676"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
