"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { Library } from "lucide-react";
import { ThemeToggle } from "fumadocs-ui/components/layout/theme-toggle";
import { ShrinkableSearchBar } from "./shrinkableSearchBar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const navItems = [
  {
    path: "/",
    el: (
      <div className="flex gap-2 items-center">
        <Image
          src="/tfm-dark.png"
          className="dark:block hidden"
          width={80}
          height={22.5}
          alt="logo"
        />
        <Image
          src="/tfm-light.png"
          className="dark:hidden"
          width={80}
          height={22.5}
          alt="logo"
        />
      </div>
    ),
    //size: "icon",
    inactiveColor: "text-zinc-900 dark:text-zinc-400",
  },
  {
    path: "/docs",
    el: (
      <div className="flex gap-2 items-center">
        <Library className="w-5 h-6" />
        <div className="hidden md:block">Docs</div>
      </div>
    ),
  },
];

export default function NavBar() {
  let pathname = usePathname();

  if (pathname.includes("/writing/")) {
    pathname = "/writing";
  }

  const [hoveredPath, setHoveredPath] = useState(pathname);

  return (
    <div className="container p-0 z-10 sticky border border-foreground/20 dark:border-stone-800/90 overflow-hidden rounded-full top-4 bg-transparent shadow-inner shadow-stone-200 dark:shadow-stone-800 *:transition-colors">
      <div className="absolute inset-0 blurry container-pad bg-muted dark:bg-muted/20" />
      <div className="flex items-center justify-between w-full p-[0.4rem] noisey rounded-full">
        <nav className="flex relative justify-start w-full z-100 rounded-full">
          {navItems.map((item) => {
            const isActive = item.path === pathname;

            return (
              <div
                key={item.path}
                className="flex items-center justify-center"
                onMouseOver={() => setHoveredPath(item.path)}
                onMouseLeave={() => setHoveredPath(pathname)}
              >
                <Link
                  className={`px-4 py-2 rounded-full text-sm lg:text-base relative no-underline duration-300 ease-in ${
                    isActive
                      ? "text-zinc-800 dark:text-zinc-100"
                      : item.inactiveColor || "text-zinc-700 dark:text-zinc-400"
                  }`}
                  href={item.path}
                  data-active={isActive}
                  onMouseOver={() => setHoveredPath(item.path)}
                  onMouseLeave={() => setHoveredPath(pathname)}
                >
                  <div>{item.el}</div>
                  {item.path === hoveredPath && (
                    <motion.div
                      className="absolute top-0 left-0 w-full h-full dark:bg-stone-600/50 bg-stone-300/50 rounded-full -z-10"
                      layoutId="navbar"
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: 0.8 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="flex gap-2 items-center">
          <ShrinkableSearchBar />
          <ThemeToggle className="rounded-full hover:dark:bg-stone-600/50 hover:bg-stone-300/50 mr-1" />
        </div>
      </div>
    </div>
  );
}
