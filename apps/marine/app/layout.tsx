import { domAnimation, LazyMotion } from "framer-motion";
import "./global.css";
import { RootProvider } from "fumadocs-ui/provider";
import { Crimson_Pro, DM_Sans, Fraunces } from "next/font/google";
import type { ReactNode } from "react";
import UnderConstruction from "@/components/underConstruction";
import Footer from "@/components/footer";

const crimson = Crimson_Pro({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-crimson",
  style: "italic",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-fraunces",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export const metadata = {
  metadataBase: new URL("https://docs.teal.fm"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    images: "/og-image.png",
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${crimson.variable} ${fraunces.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen max-w-[99vw] overflow-x-clip">
        <RootProvider>
          <LazyMotion features={domAnimation}>
            {children}
            <Footer />
          </LazyMotion>
        </RootProvider>
        <UnderConstruction />
        <svg width="0" height="0">
          <filter id="grainy-blur" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="6"
              result="noise"
              seed="128"
              stitchTiles="stitch"
            />
            <feBlend in="SourceGraphic" mode="hard-light" />
          </filter>
        </svg>
      </body>
    </html>
  );
}
