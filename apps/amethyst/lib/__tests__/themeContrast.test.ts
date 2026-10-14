import { readFileSync } from "node:fs";
import { join } from "node:path";

type Color = [number, number, number];
const css = readFileSync(join(__dirname, "../../global.css"), "utf8");
const blocks = {
  light: css.match(/\s:root\s*\{([^}]+)\}/)?.[1] || "",
  dark: css.match(/\.dark:root\s*\{([^}]+)\}/)?.[1] || "",
};

function token(block: string, name: string): Color {
  const value = block.match(
    new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`),
  );
  if (!value) throw new Error(`Missing color token ${name}`);
  const hue = Number(value[1]) / 30;
  const saturation = Number(value[2]) / 100;
  const lightness = Number(value[3]) / 100;
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const channel = (offset: number) => {
    const k = (offset + hue) % 12;
    return lightness - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

function blend(color: Color, background: Color, opacity: number): Color {
  return color.map(
    (channel, i) => opacity * channel + (1 - opacity) * background[i],
  ) as Color;
}

function luminance(color: Color) {
  const linear = color.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first: Color, second: Color) {
  const high = Math.max(luminance(first), luminance(second));
  const low = Math.min(luminance(first), luminance(second));
  return (high + 0.05) / (low + 0.05);
}

describe.each(["light", "dark"] as const)(
  "%s shared action colors",
  (theme) => {
    const block = blocks[theme];
    const surfaces = ["background", "card", "popover", "muted", "accent"];

    it.each(["primary", "destructive"])(
      "keeps %s button text readable, including the 90%% opacity hover",
      (role) => {
        const color = token(block, role);
        const foreground = token(block, `${role}-foreground`);
        expect(contrast(color, foreground)).toBeGreaterThanOrEqual(4.5);
        for (const surface of surfaces) {
          const backdrop = token(block, surface);
          // Button hover fades the entire control, including its foreground.
          expect(
            contrast(
              blend(color, backdrop, 0.9),
              blend(foreground, backdrop, 0.9),
            ),
          ).toBeGreaterThanOrEqual(4.5);
        }
      },
    );

    it("keeps error text readable on surfaces and 10% destructive-tinted panels", () => {
      const error = token(block, "destructive");
      for (const surface of surfaces) {
        const backdrop = token(block, surface);
        expect(contrast(error, backdrop)).toBeGreaterThanOrEqual(4.5);
        expect(
          contrast(error, blend(error, backdrop, 0.1)),
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  },
);
