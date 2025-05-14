import { Github, Twitter } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function CompactFooter() {
  return (
    <footer className="w-full bg-card dark:bg-black border-t px-4 py-8">
      <div className="container mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-1">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/tfm-dark.png"
                className="dark:block hidden"
                width={120}
                height={28}
                alt="logo"
              />
              <Image
                src="/tfm-light.png"
                className="dark:hidden"
                width={120}
                height={28}
                alt="logo"
              />
            </Link>
            <p className="text-sm text-gray-400">
              Your music, beautifully tracked.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-right">
            <div className="space-y-3">
              <Link
                href="#"
                className="block text-sm text-gray-400 hover:text-teal-400"
              >
                Features
              </Link>
              <Link
                href="#"
                className="block text-sm text-gray-400 hover:text-teal-400"
              >
                API
              </Link>
              <Link
                href="#"
                className="block text-sm text-gray-400 hover:text-teal-400"
              >
                Docs
              </Link>
            </div>
            <div className="space-y-3">
              <Link
                href="#"
                className="block text-sm text-gray-400 hover:text-teal-400"
              >
                Terms
              </Link>
              <Link
                href="#"
                className="block text-sm text-gray-400 hover:text-teal-400"
              >
                Privacy
              </Link>
              <Link
                href="#"
                className="block text-sm text-gray-400 hover:text-teal-400"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
        <div className="px-4 py-6 flex justify-between items-center">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} teal.fm
          </p>
          <div className="flex gap-4">
            <Link
              href="#"
              className="text-gray-400 hover:text-teal-400 transition-colors"
            >
              <Twitter className="h-5 w-5" />
              <span className="sr-only">Twitter</span>
            </Link>
            <Link
              href="#"
              className="text-gray-400 hover:text-teal-400 transition-colors"
            >
              <Github className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
