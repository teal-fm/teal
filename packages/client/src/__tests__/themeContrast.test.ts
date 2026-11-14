import { readFileSync } from "node:fs";
import { join } from "node:path";

type Color = [number, number, number, number];
const css = readFileSync(join(__dirname, "../../../../apps/amethyst/global.css"), "utf8");
const blocks = {
  light: css.match(/\s:root\s*\{([^}]+)\}/)?.[1] || "",
  dark: css.match(/@variant dark\s*\{([^}]+)\}/)?.[1] || "",
};

/** Reads a token written as #rrggbb, rgba(r, g, b, a), or the bare "h s% l%" form. */
function token(block: string, name: string): Color {
  const value = block.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`Missing color token ${name}`);
  const hex = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) return [...hex.slice(1, 4).map((h) => parseInt(h, 16) / 255), 1] as Color;
  const rgba = value.match(/^rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)$/);
  if (rgba) return [Number(rgba[1]) / 255, Number(rgba[2]) / 255, Number(rgba[3]) / 255, Number(rgba[4])];
  const hsl = value.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (hsl) {
    const h = Number(hsl[1]) / 30;
    const s = Number(hsl[2]) / 100;
    const l = Number(hsl[3]) / 100;
    const c = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h) % 12;
      return l - c * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4), 1];
  }
  throw new Error(`Unreadable color token ${name}: ${value}`);
}

/** A colour composited over an opaque background. */
function over(color: Color, background: Color): Color {
  const a = color[3];
  return [0, 1, 2].map((i) => a * color[i] + (1 - a) * background[i]).concat(1) as Color;
}

function luminance(color: Color) {
  const linear = color.slice(0, 3).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first: Color, second: Color) {
  const high = Math.max(luminance(first), luminance(second));
  const low = Math.min(luminance(first), luminance(second));
  return (high + 0.05) / (low + 0.05);
}

describe.each(["light", "dark"] as const)("%s theme", (theme) => {
  const block = blocks[theme];
  const grounds = ["ground", "ground-2"].map((name) => token(block, name));

  // Buttons darken on hover rather than fading, so the resting colours are the ones to check.
  it("keeps primary button text readable", () => {
    expect(contrast(token(block, "tint"), token(block, "on-tint"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps ink, secondary ink, tint links, and errors readable on the grounds", () => {
    for (const ground of grounds) {
      for (const name of ["ink", "ink-2", "tint", "destructive"]) {
        expect(contrast(over(token(block, name), ground), ground)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps the listening-now ring visible against the ground", () => {
    expect(contrast(token(block, "now"), grounds[0])).toBeGreaterThanOrEqual(3);
  });
});
