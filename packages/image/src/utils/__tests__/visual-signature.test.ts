import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { VISUAL_SIGNATURE_SPEC, computeVisualSignature, hammingHex } from "../visual-signature.util";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-IMAGE-EVIDENCE-02 — **정규화 계약 I8~I11**(CPO §8)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **threshold 가 이 파일에 «없다».** 「dHash < X → SAME」을 만들지 않는다 —
 *    잠그는 것은 **구조** 다(규격 통일 · 전후 구분 · 실패 처리).
 *
 * 🔴 **왜 정규화가 핵심인가**(IMAGE-EVIDENCE-01 실측): trim 없이 재면 human SAME 이
 *    **26**, human DIFFERENT 가 **11** 로 **순서가 뒤집혔다**. 판매처마다 크롭·여백·
 *    종횡비가 다르기 때문이다. ⟹ 이 파일이 지키는 것은 **그 역전이 다시 생기지 않는 것**.
 *
 * 🟢 테스트 이미지는 **그 자리에서 만든다** — 저장소에 바이너리를 넣지 않는다.
 */

/** 흰 여백을 두른 색 견본(판매처마다 다른 크롭을 흉내낸다). */
async function swatch(w: number, h: number, pad: number, rgb: { r: number; g: number; b: number }): Promise<Buffer> {
  const inner = await sharp({ create: { width: w, height: h, channels: 3, background: rgb } })
    /** 🔴 균일 색만 쓰면 dHash 가 전부 0 이 된다 — **구조** 를 넣어야 의미가 있다. */
    .composite([
      {
        input: await sharp({
          create: {
            width: Math.max(1, Math.round(w / 2)),
            height: Math.max(1, Math.round(h / 3)),
            channels: 3,
            background: { r: 20, g: 20, b: 20 },
          },
        })
          .png()
          .toBuffer(),
        top: Math.round(h / 3),
        left: Math.round(w / 4),
      },
    ])
    .png()
    .toBuffer();
  return sharp(inner)
    .extend({
      top: pad,
      bottom: pad,
      left: Math.round(pad / 2),
      right: Math.round(pad / 2),
      background: { r: 255, g: 255, b: 255 },
    })
    .jpeg()
    .toBuffer();
}

describe("CORE-IMAGE-EVIDENCE-02 — 비교용 정규화(I8~I11)", () => {
  it("I8 — normalized representation 이 생성된다", async () => {
    const sig = await computeVisualSignature(await swatch(200, 200, 40, { r: 180, g: 60, b: 60 }));
    expect(sig.normalizedDHash).toMatch(/^[0-9a-f]{16}$/);
    expect(sig.normalizedAHash).toMatch(/^[0-9a-f]{16}$/);
    expect(sig.digest.startsWith("d1:")).toBe(true);
    expect(sig.sourceWidth).toBeGreaterThan(0);
    expect(sig.sourceHeight).toBeGreaterThan(0);
  });

  it("I9 — 🔴🔴 종횡비·여백이 달라도 **정규화가 차이를 없앤다**", async () => {
    /** 같은 내용 · 다른 크롭(정사각 ↔ 세로로 긴 여백) — 01 에서 답을 뒤집었던 축이다. */
    const square = await computeVisualSignature(await swatch(300, 300, 20, { r: 120, g: 140, b: 200 }));
    const tall = await computeVisualSignature(await swatch(300, 300, 260, { r: 120, g: 140, b: 200 }));

    expect(square.normalizedDHash).toHaveLength(tall.normalizedDHash.length);
    const rawGap = hammingHex(square.rawDHash, tall.rawDHash);
    const normGap = hammingHex(square.normalizedDHash, tall.normalizedDHash);
    /** 🟢 핵심 단언 — **정규화 후가 정규화 전보다 가깝다**(threshold 를 쓰지 않는다). */
    expect(normGap).toBeLessThan(rawGap);
    /** 🔴 여백 색(흰색)에 색 서명이 끌려가지 않아야 한다. */
    expect(Math.abs(square.color.b - tall.color.b)).toBeLessThan(40);
  });

  it("I9-b — 다른 «내용» 은 정규화 후에도 구분된다(정규화가 전부 같게 만들지 않는다)", async () => {
    const a = await computeVisualSignature(await swatch(300, 300, 20, { r: 200, g: 60, b: 60 }));
    const b = await computeVisualSignature(await swatch(300, 300, 20, { r: 40, g: 60, b: 200 }));
    /** 🔴 색이 완전히 다르면 **색 서명** 이 갈라야 한다(dHash 는 회색조라 못 볼 수 있다). */
    const colorGap = Math.abs(a.color.r - b.color.r) + Math.abs(a.color.b - b.color.b);
    expect(colorGap).toBeGreaterThan(40);
  });

  it("I10 — trim 전/후를 **따로** 들고 있다", async () => {
    const sig = await computeVisualSignature(await swatch(200, 200, 120, { r: 60, g: 160, b: 90 }));
    expect(sig).toHaveProperty("rawDHash");
    expect(sig).toHaveProperty("normalizedDHash");
    /** 🔴 여백이 큰데 trim 이 발화하지 않았다면 정규화가 거짓말을 하는 것이다. */
    expect(sig.trimmed).toBe(true);
    expect(sig.rawDHash).not.toBe(sig.normalizedDHash);
  });

  it("I10-b — 규격 상수가 하나이고 dHash 는 가로를 하나 더 본다", () => {
    expect(VISUAL_SIGNATURE_SPEC.hashWidth).toBe(VISUAL_SIGNATURE_SPEC.hashHeight + 1);
    expect(VISUAL_SIGNATURE_SPEC.colorGrid % 4).toBe(0);
    expect(VISUAL_SIGNATURE_SPEC.trimThreshold).toBeGreaterThan(0);
  });

  it("I10-c — digest 는 **정규화 해시 + 색** 을 같이 담는다(한쪽만 보지 않게)", async () => {
    const sig = await computeVisualSignature(await swatch(200, 200, 30, { r: 10, g: 20, b: 200 }));
    expect(sig.digest).toBe(`d1:${sig.normalizedDHash}:${sig.color.r},${sig.color.g},${sig.color.b}`);
  });

  it("I11 — 🔴 decode 실패는 **던진다**(0 을 지어내지 않는다)", async () => {
    await expect(computeVisualSignature(Buffer.from("not an image at all"))).rejects.toBeTruthy();
  });

  it("I11-b — 여백이 전혀 없는 이미지도 실패하지 않는다(trim 무발화는 정상)", async () => {
    const flat = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 10, b: 10 } } })
      .jpeg()
      .toBuffer();
    const sig = await computeVisualSignature(flat);
    expect(sig.normalizedDHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("안정성 — 같은 바이트는 같은 서명을 낸다", async () => {
    const buf = await swatch(240, 180, 25, { r: 90, g: 90, b: 120 });
    const a = await computeVisualSignature(buf);
    const b = await computeVisualSignature(buf);
    expect(a.digest).toBe(b.digest);
    expect(hammingHex(a.normalizedDHash, b.normalizedDHash)).toBe(0);
  });
});
