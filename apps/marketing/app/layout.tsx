import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "teal.fm";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Teal — Keep your music close";
  const description = "A more personal way to remember what you listen to, find what moves you, and share your taste.";

  return {
    title,
    description,
    openGraph: { title, description, url: origin, siteName: "Teal", images: [{ url: `${origin}/og.png`, width: 1734, height: 907, alt: "Teal — A more personal way to keep your music close." }], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
