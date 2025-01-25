"use client";


import { Marquee } from "@/components/currentTrackMarquee";
import NavBar from "@/components/navbar";
import { AnimatedText } from "@/components/ui/animatedUnderline";
import HeroBadge from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlowEffect } from "@/components/ui/glowEffect";
import { SpaceButton } from "@/components/ui/spaceButton";
import { Spotlight } from "@/components/ui/spotlights";
import { StarsBackground } from "@/components/ui/stars";
import { m as motion } from "framer-motion";
import { ArrowRight, Info, Music2 } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col text-center items-center px-2 md:px-8 ">
      <NavBar />
      <motion.div
        initial={{ opacity: 0.1 }}
        whileInView={{ opacity: 1 }}
        transition={{
          duration: 0.8,
          ease: "easeOut",
        }}
        className="relative w-screen mt-8 md:-mt-14 p-2"
      >
        <GlowEffect
          colors={["#0894FF", "#C95a9DD", "#2E54FF", "#90FFee"]}
          mode="static"
          blur="medium"
          opacity={0.3}
        />
        <div className="relative flex md:h-[98.5vh] h-[85vh] flex-col items-center justify-center overflow-hidden rounded-2xl bg-background">
          <div className="flex-1 max-w-screen-2xl w-screen relative flex h-[98.5vh] flex-col items-center justify-between rounded-2xl bg-background">
            <div />
            <div>
              <HeroBadge
                text="Join the Discord community"
                icon={<Info />}
                endIcon={<ArrowRight />}
                href="https://discord.gg/B67XEhYYjx"
              />
              <motion.h1
                initial={{ opacity: 0.1, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  ease: "easeOut",
                }}
                className="mt-4 bg-gradient-to-br from-slate-300 to-slate-500 bg-clip-text text-center text-4xl font-medium tracking-tight text-transparent md:text-7xl transform-gpu"
              >
                <div className="flex items-center justify-center space-x-1">
                  <div className="bg-teal-500 rounded-full p-3 h-16 w-16">
                    <Music2 className="text-white h-full w-full" />
                  </div>
                  <h1 className="text-7xl sm:text-8xl font-semibold tracking-tight transition-scale">
                    teal
                    <span className="text-teal-500 font-serif italic">.fm</span>
                  </h1>
                </div>
                <p className="font-sans text-2xl sm:text-4xl text-teal-700 dark:text-teal-100 max-w-2xl mx-auto font-light transition-all mt-4">
                  Your music,{" "}
                  <span className="font-modern-serif font-medium text-teal-500">
                    beautifully
                  </span>{" "}
                  tracked.
                </p>
              </motion.h1>
              <motion.div
                initial={{ opacity: 0.1, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  ease: "easeOut",
                }}
              >
                <AnimatedText
                  text={
                    <span className="font-sans text-2xl sm:text-4xl text-teal-700 dark:text-teal-100 max-w-2xl mx-auto font-light transition-all">
                      All{" "}
                      <span className="text-teal-500 font-modern-serif font-medium">
                        yours.
                      </span>
                    </span>
                  }
                  underlinePath="M0,10 Q25,0,50,10 Q75,20,100,10 Q125,0,150,10 Q185,20,220,10 Q250,0,300,10"
                  underlineClassName="-bottom-2.5 scale-x-110"
                  underlineDuration={1.5}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0.1, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.85,
                  ease: "easeOut",
                }}
                className="flex gap-2 items-center justify-center mt-8"
              >
                <Link href="https://discord.gg/B67XEhYYjx">
                  <SpaceButton>Join the Discord</SpaceButton>
                </Link>
                <Link href="/docs">
                  <Button variant={"secondary"} className="rounded-full">
                    Docs
                  </Button>
                </Link>
              </motion.div>
            </div>
            {/* saving this until after stamps are GA */}
            <div className="gap-4 flex flex-col">
              <p className="font-sans text-muted-foreground text-center">
<span className="animate-pulse text-red-500">●</span>{' '}

  Live: COUNT tracks scrobbled this hour.
              </p>
              <Marquee />
            </div>
            <StarsBackground
              starDensity={0.0003}
              allStarsTwinkle={true}
              minTwinkleSpeed={1}
              maxTwinkleSpeed={3}
            />
            <Spotlight />
          </div>
        </div>
      </motion.div>
    </main>
  );
}
