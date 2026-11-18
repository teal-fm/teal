import type { ComponentType } from "react";
import { ChartColumn, Share2, Sparkles, Users } from "lucide-react";

const BLUESKY = "https://bsky.app/profile/did:plc:iwhuynr6mm6xxuh25o4do2tx";
const DISCORD = "https://discord.gg/DMSZ3xFUpk";
const GITHUB = "https://github.com/teal-fm";

const FEATURES: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  glow: string;
}[] = [
  {
    title: "Own your data",
    description:
      "Built on ATProto, you can take control of your sound, connect with your audience, and share your tastes with the world.",
    icon: ChartColumn,
    glow: "from-teal-400/30 to-emerald-500/30",
  },
  {
    title: "Social Discovery",
    description:
      "Connect with music lovers who share your taste and discover new tracks through community recommendations.",
    icon: Users,
    glow: "from-blue-400/30 to-teal-500/30",
  },
  {
    title: "Universal Tracking",
    description:
      "Seamlessly sync your listening history across Spotify, Apple Music, YouTube Music, and more platforms.",
    icon: Sparkles,
    glow: "from-purple-400/30 to-pink-500/30",
  },
  {
    title: "Share Your Taste",
    description:
      "Create beautiful cards of your top tracks and artists to share your music taste with the world.",
    icon: Share2,
    glow: "from-orange-400/30 to-pink-500/30",
  },
];

// Brand marks from Simple Icons.
const SOCIALS = [
  {
    label: "Bluesky",
    href: BLUESKY,
    path: "M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z",
  },
  {
    label: "Discord",
    href: DISCORD,
    path: "M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z",
  },
  {
    label: "GitHub",
    href: GITHUB,
    path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },
];

/** What the old landing page said, below the live part of the home page. */
export function Landing() {
  return (
    <div id="features" className="mx-auto max-w-5xl px-4 pt-24 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {FEATURES.map(({ title, description, icon: Icon, glow }) => (
          <div key={title} className="group relative h-full">
            <div
              className={`bg-linear-to-r absolute -inset-0.5 rounded-lg ${glow} opacity-25 blur transition duration-500 group-hover:opacity-100`}
            />
            <div className="relative h-full rounded-xl border border-neutral-400/20 bg-gray-100/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-neutral-400/30 dark:bg-gray-900/50">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-black/10 p-2 dark:bg-white/10">
                  <Icon className="size-6 text-teal-400" />
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
              </div>
              <p className="text-gray-700 dark:text-teal-100">{description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-20 max-w-md">
        <div className="rounded-xl border border-teal-500/20 bg-white/10 p-6 backdrop-blur-lg">
          <h2 className="mb-4 text-xl font-semibold text-black/50 dark:text-white/50">
            Stay updated (soon)
          </h2>
          <p className="text-gray-700 dark:text-teal-100">
            Join our{" "}
            <a href={DISCORD} className="underline">
              Discord Server
            </a>{" "}
            and follow our{" "}
            <a href={BLUESKY} className="underline">
              Bluesky account
            </a>{" "}
            to stay up to date with the latest news and updates.
          </p>
        </div>
      </div>

      <div className="mt-20 flex justify-center gap-4">
        {SOCIALS.map(({ label, href, path }) => (
          <a
            key={label}
            href={href}
            aria-label={label}
            className="transition hover:text-teal-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-6"
              aria-hidden
            >
              <path d={path} />
            </svg>
          </a>
        ))}
      </div>

      <footer className="mt-10 pb-8 text-center text-teal-600 dark:text-teal-400/60">
        <p>© {new Date().getFullYear()} teal computing, LLC - coming soon</p>
        <p>
          <span className="font-display italic">forever</span> open source
        </p>
      </footer>
    </div>
  );
}
