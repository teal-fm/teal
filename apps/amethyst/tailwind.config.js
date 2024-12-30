import { platformSelect, hairlineWidth } from "nativewind/theme";

/** @type {import('tailwindcss').Config} */
export const darkMode = "class";
export const content = ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"];
export const presets = [require("nativewind/preset")];
export const theme = {
  extend: {
    fontFamily: {
      sans: "DM Sans",
      "serif-old": "CrimsonPro",
      "serif-old-italic": "CrimsonPro Italic",
      "serif": "Fraunces",
      // serif: platformSelect({
      //   android: "Fraunces",
      //   ios: "Fraunces",
      //   web: 'Fraunces, Georgia, Cambria, "Times New Roman", Times, serif',
      // }),
      mono: "PlexMono"
      // mono: platformSelect({
      //   android: "PlexMono",
      //   ios: ["PlexMono"],
      //   web: 'PlexMono, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      // }),
    },
    colors: {
      border: "hsl(var(--border))",
      input: "hsl(var(--input))",
      ring: "hsl(var(--ring))",
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      primary: {
        DEFAULT: "hsl(var(--primary))",
        foreground: "hsl(var(--primary-foreground))",
      },
      secondary: {
        DEFAULT: "hsl(var(--secondary))",
        foreground: "hsl(var(--secondary-foreground))",
      },
      destructive: {
        DEFAULT: "hsl(var(--destructive))",
        foreground: "hsl(var(--destructive-foreground))",
      },
      muted: {
        DEFAULT: "hsl(var(--muted))",
        foreground: "hsl(var(--muted-foreground))",
      },
      accent: {
        DEFAULT: "hsl(var(--accent))",
        foreground: "hsl(var(--accent-foreground))",
      },
      popover: {
        DEFAULT: "hsl(var(--popover))",
        foreground: "hsl(var(--popover-foreground))",
      },
      card: {
        DEFAULT: "hsl(var(--card))",
        foreground: "hsl(var(--card-foreground))",
      },
      bsky: "hsl(var(--bsky))",
    },
    borderWidth: {
      hairline: hairlineWidth(),
    },
    keyframes: {
      "accordion-down": {
        from: { height: "0" },
        to: { height: "var(--radix-accordion-content-height)" },
      },
      "accordion-up": {
        from: { height: "var(--radix-accordion-content-height)" },
        to: { height: "0" },
      },
    },
    animation: {
      "accordion-down": "accordion-down 0.2s ease-out",
      "accordion-up": "accordion-up 0.2s ease-out",
    },
  },
};
export const plugins = [require("tailwindcss-animate")];
