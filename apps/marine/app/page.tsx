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
import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col text-center items-center px-2 md:px-8">
      <NavBar />
      <motion.div
        initial={{ opacity: 0.1 }}
        whileInView={{ opacity: 1 }}
        transition={{
          duration: 0.8,
          ease: "easeOut",
        }}
        className="relative w-screen -mt-14 pt-24 md:p-4 p-2 overflow-visible"
        style={{
          mask: "linear-gradient(to bottom, black 0%, black 60%, transparent 99%)",
        }}
      >
        <GlowEffect
          colors={["#0894FF", "#C95a9D", "#2E54FF", "#90FFee"]}
          mode="static"
          blur="medium"
          opacity={0.3}
          style={{
            mask: "linear-gradient(to bottom, black 60%, transparent 80%)",
          }}
        />
        <div className="relative flex md:h-[98.5vh] h-[85vh] flex-col max-w-full items-center justify-center overflow-hidden rounded-2xl bg-background">
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
                <p className="font-sans text-3xl sm:text-6xl text-teal-700 dark:text-teal-100 max-w-screen-2xl mx-auto font-light transition-all mt-4">
                  Your music,{" "}
                  <span className="font-modern-serif font-medium text-teal-600 dark:text-teal-400">
                    beautifully
                  </span>{" "}
                  tracked.
                </p>
              </motion.h1>
              <motion.div
                initial={{ opacity: 0.1, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.2,
                  duration: 0.8,
                  ease: "easeOut",
                }}
              >
                <AnimatedText
                  text={
                    <span className="font-sans text-4xl sm:text-7xl text-teal-700 dark:text-teal-100 mx-auto font-light transition-all">
                      All{" "}
                      <span className="text-teal-600 dark:text-teal-400 font-modern-serif font-medium">
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
                  delay: 0.25,
                  duration: 0.9,
                  ease: "easeOut",
                }}
                className="flex gap-2 items-center justify-center mt-6"
              >
                <p className="max-w-2xl text-sm px-4">
                  Track every listen, mood, and moment on ATProto:
                  <br />
                  decentralized, seamless, and{" "}
                  <span className="text-teal-600 dark:text-teal-400 italic inline">
                    yours.
                  </span>{" "}
                  No middlemen, no mysteries. <br />
                  Just your music, your way.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0.1, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.3,
                  duration: 1.2,
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
            <div className="h-32" />

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
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.3,
          duration: 0.9,
          ease: "easeOut",
        }}
        className="flex flex-col items-center justify-start rounded-xl gap-2 max-w-screen-lg noisey bg-opacity-30 bg-muted/30 md:absolute relative bottom-12 z-0 md:-bottom-28 w-screen h-96 px-2"
      >
        <p className="text-accent-foreground text-3xl md:text-4xl text-center mt-6 font-modern-serif">
          Now Playing
        </p>
        <p className="md:text-xl max-w-screen-md px-2">
          {" "}
          Get inspired by what’s trending. See what’s hot, discover new songs,
          and share your unique style.
        </p>
        <div
          className="w-screen flex flex-col items-center overflow-x-hidden absolute md:static -top-32 -mb-8 mt-2"
          style={{
            mask: "linear-gradient(to right, transparent 0%, black calc(5% + 2rem), black calc(95% - 2rem), transparent 100%)",
          }}
        >
          <Marquee />
        </div>
        <div className="block md:hidden border-t w-64 my-4" />
        <p className="max-w-screen-md px-2">
          Stay connected to the music that moves you. Share your favorite tracks
          with friends, explore what they’re listening to, and discover new
          sounds together. Your music journey can evolve to become a shared
          experience—let’s make it unforgettable.
        </p>
      </motion.div>
    </div>
  );
}
