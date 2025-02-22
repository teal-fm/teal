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
import { m } from "framer-motion";
import { ArrowRight, AtSign, Brain, TriangleAlert } from "lucide-react";
import { SiBluesky } from "react-icons/si";
import Link from "next/link";
import Image from "next/image";
import UnderConstruction from "@/components/underConstruction";

export default function HomePage() {
  return (
    <>
      <div className="flex flex-1 flex-col text-center items-center">
        <NavBar />
        <m.div
          initial={{ opacity: 0.1 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.8,
            ease: "easeOut",
          }}
          className="relative w-full -mt-14 pt-24 md:pt-4 p-0 overflow-hidden"
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
          <div className="relative flex md:h-[98.5vh] h-[85vh] flex-col noisey max-w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-t from-background/40 via-sky-100/80 to-sky-200 dark:from-transparent dark:to-transparent bg-background">
            <div className="flex-1 max-w-screen-2xl w-full relative flex h-[98.5vh] flex-col items-center justify-between rounded-2xl">
              <div />
              <div>
                <HeroBadge
                  text="Follow us on Bluesky"
                  icon={
                    <SiBluesky className="text-lg text-[rgb(10,122,255)]" />
                  }
                  endIcon={<ArrowRight width={20} height="auto" />}
                  href="https://bsky.app/profile/teal.fm"
                />
                <m.h1
                  initial={{ opacity: 0.1, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.8,
                    ease: "easeOut",
                  }}
                  className="mt-4 bg-gradient-to-br from-slate-300 to-slate-500 bg-clip-text text-center text-4xl font-medium tracking-tight text-transparent md:text-7xl transform-gpu"
                >
                  <div className="font-sans text-4xl md:text-6xl text-teal-800 dark:text-teal-100 max-w-screen-2xl font-light transition-all mt-4">
                    Your music,{" "}
                    <div className="block lg:inline">
                      <span className="font-modern-serif font-medium text-teal-700 dark:text-teal-400">
                        beautifully
                      </span>{" "}
                      tracked.
                    </div>
                  </div>
                </m.h1>
                <m.div
                  initial={{ opacity: 0.1, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.2,
                    duration: 0.8,
                    ease: "easeOut",
                  }}
                >
                  <AnimatedText
                    text={
                      <span className="font-sans text-4xl md:text-7xl text-teal-800 dark:text-teal-100 font-light transition-all">
                        All{" "}
                        <span className="text-teal-700 dark:text-teal-400 font-modern-serif font-medium">
                          yours.
                        </span>
                      </span>
                    }
                    underlinePath="M0,10 Q25,0,50,10 Q75,20,100,10 Q125,0,150,10 Q185,20,220,10 Q250,0,300,10"
                    underlineClassName="-bottom-2.5 scale-x-110"
                    underlineDuration={1.5}
                  />
                </m.div>
                <m.div
                  initial={{ opacity: 0.1, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.25,
                    duration: 0.9,
                    ease: "easeOut",
                  }}
                  className="flex gap-2 items-center justify-center mt-6"
                >
                  <p className="max-w-2xl text-xs md:text-sm px-4 text-pretty">
                    Track every listen, mood, and moment on ATProto:
                    <br />
                    decentralized, seamless, and{" "}
                    <span className="text-teal-800 dark:text-teal-400 italic inline">
                      yours.
                    </span>{" "}
                    No middlemen, no mysteries. <br />
                    Just your music, your way.
                  </p>
                </m.div>
                <m.div
                  initial={{ opacity: 0.1, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.3,
                    duration: 1.2,
                    ease: "easeOut",
                  }}
                  className="flex gap-2 items-center justify-center mt-4 md:mt-8"
                >
                  <Link href="https://discord.gg/B67XEhYYjx">
                    <SpaceButton>Join the Discord</SpaceButton>
                  </Link>
                  <Link href="/docs">
                    <Button variant={"secondary"} className="rounded-full">
                      Docs
                    </Button>
                  </Link>
                </m.div>
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
        </m.div>
        <m.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.9,
            ease: "easeOut",
          }}
          className="flex flex-col items-center justify-start rounded-xl gap-2 max-w-screen-lg noisey bg-opacity-30 bg-muted/30 md:absolute relative bottom-12 z-0 md:-bottom-28 pb-8 px-2"
        >
          <p className="text-accent-foreground text-3xl md:text-4xl text-center mt-6 font-modern-serif">
            What&apos;s Playing?
          </p>
          <p className="md:text-xl max-w-screen-md px-2">
            Get inspired by what’s trending. See what’s hot, discover new songs,
            and share your unique style with the world.
          </p>
          <div
            className="max-w-screen-2xl w-screen flex flex-col items-center absolute md:static overflow-clip -top-32 -mb-8 mt-2"
            style={{
              mask: "linear-gradient(to right, transparent 0%, black calc(5% + 2rem), black calc(95% - 2rem), transparent 100%)",
            }}
          >
            <Marquee />
          </div>
          <div className="block md:hidden border-t w-64 my-4" />
          <p className="max-w-screen-md px-2">
            Let every track spark inspiration—and pass it on. Share your latest
            finds with friends, dive into their listens, or uncover hidden gems
            together. With personalized picks and real-time updates (soon), your
            music journey becomes a collaborative adventure. Turn every listen
            into your shared soundtrack, crafted for the moments you’ll revisit.
          </p>
        </m.div>
        <div className="gap-4 p-2 md:mt-36 pt-12 text-start place-items-center md:border-t">
          <div className="flex flex-col noisey items-center text-center md:items-start md:text-start justify-center max-w-2xl gap-2 h-full p-6 border rounded-xl">
            <h1 className="text-3xl">
              <TriangleAlert className="inline h-full w-8 mb-2 mr-2 text-yellow-600 dark:text-yellow-400" />
              Heads up!
            </h1>
            <p>
              Things move fast here! While we strive for accuracy, our features
              and integrations are still evolving. Details on this page may
              shift as we rework and refine.
            </p>
            <p>
              This website is also{" "}
              <span className="font-semibold text-yellow-700 dark:text-yellow-300">
                under heavy construction - expect surprises, placeholders, and
                unexpected twists!
              </span>{" "}
              We’re updating it as we go, so{" "}
              <span className="font-semibold">expect things to change.</span>
            </p>
          </div>
        </div>
        <div className="max-w-screen-xl w-full min-h-[75vh] flex flex-col lg:flex-row items-center justify-between gap-4 p-2 px-4 pt-16 md:px-8 text-start">
          <div className="flex flex-col items-start text-start max-w-2xl gap-4">
            <h2 className="text-5xl font-modern-serif font-medium text-teal-800 dark:text-teal-300">
              {" "}
              World, meet you.
            </h2>
            <p className="text-xl text-balance tracking-normal">
              Share every beat, track, and obsession with{" "}
              <span className="text-teal-700 dark:text-teal-400">
                the world
              </span>
              .
            </p>
            <p className="text-lg text-balance tracking-normal">
              Stay ahead of your listening habits with intuitive stats and
              milestones. Share your top tracks, monthly recaps, or hidden gems
              directly to friends or the world (soon). Follow others to dive
              into their musical worlds, compare tastes, or connect with
              like-minded listeners.
            </p>
          </div>
          <div className="flex flex-col text-start flex-1 items-center">
            <Image
              src="/your-stamps.png"
              className="rounded-md border-4"
              alt="listening"
              height={400}
              width={400}
            />
          </div>
        </div>
        <div className="max-w-screen-xl w-full min-h-[75vh] px-2 pt-16 md:pt-36 text-center md:text-start">
          <div>
            <h2 className="text-5xl font-modern-serif font-medium text-teal-800 dark:text-teal-300 text-center">
              {" "}
              Innovate your listening.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start mt-12">
              <div className="border p-4 rounded-lg space-y-2">
                <Image
                  height={300}
                  width={500}
                  src="/jinping.jpg"
                  alt="Image"
                  className="object-fill aspect-video"
                />
                <h3 className="text-2xl">Track *everything*</h3>
                <p>
                  Sync plays from Spotify, Tidal* and more into one place. Watch
                  your habits evolve, rediscover forgotten gems, and make your
                  music yours.
                </p>
              </div>
              <div className="border p-4 rounded-lg space-y-2">
                <Image
                  height={300}
                  width={500}
                  src="/jinping.jpg"
                  alt="Image"
                  className="object-fill aspect-video"
                />
                <h3 className="text-2xl">Sound in full colour</h3>
                <p>
                  Turn your taste into art. Design stunning, shareable cards of
                  your top tracks, artists, and milestones. Sleek designs, moody
                  gradients—your taste, ready to post.
                </p>
              </div>
              <div className="border p-4 rounded-lg space-y-2">
                <Image
                  height={300}
                  width={500}
                  src="/jinping.jpg"
                  alt="Image"
                  className="object-fill aspect-video"
                />
                <h3 className="text-2xl">Find your friends</h3>
                <p>
                  Connect through sound, not algorithms Follow listeners who
                  actually share your taste. Dive into their playlists, or react
                  to their latest obsessions. Music hits harder when it’s with
                  friends.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-screen-xl w-full min-h-[75vh] py-16 px-4 md:pt-36 text-center md:text-start">
          <div>
            <h2 className="text-5xl font-modern-serif font-medium text-teal-800 dark:text-teal-300 text-start md:text-center">
              Built for tomorrow&apos;s music.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 items-start mt-12 text-start md:divide-x">
              <div className="flex justify-center border-b md:border-b-0 mb-8 pb-8 md:mb-auto md:pb-0 text-pretty">
                <div className="flex justify-center flex-col max-w-lg gap-4 md:ml-4">
                  <div className="text-7xl">
                    <AtSign
                      height="4.5rem"
                      width="4.5rem"
                      className="text-blue-500"
                    />
                  </div>
                  <p className="text-2xl font-semibold text-start">
                    Powered by ATProtocol.{" "}
                  </p>
                  <div className="text-muted-foreground">
                    Where your data is yours, your taste transcends platforms,
                    and music thrives in an open ecosystem.
                  </div>
                  {/* <p className="text-lg text-balance">
                  teal.fm isn’t just another music tracker—it’s a gateway to a
                  decentralized future. Built on ATProto, your music journey is
                  anchored in user-owned data, portability, and
                  interoperability. Your Personal Data Server (PDS) stores every
                  play, like, and share, putting you in control. Follow friends
                  or let your musical identity evolve freely across the
                  Atmosphere. Even if teal.fm evolves (and we plan to stick
                  around), your music history stays safe in your PDS – no
                  corporate graveyard.
                </p> */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold">
                      Your data, finally yours
                    </h3>
                    <p>
                      Your original plays, likes, and shares live in your
                      Personal Data Server (PDS), not a corporate datalake.
                    </p>
                    <h3 className="text-xl font-semibold">
                      Interoperable by design
                    </h3>
                    <p>
                      Follow friends, share your music, and let your musical
                      identity evolve freely across the Atmosphere.
                      <span className="text-muted-foreground">*</span>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        * within reason. as long as the third-party app is
                        compatible
                      </span>
                    </p>
                    <h3 className="text-xl font-semibold">Built to outlast</h3>
                    <p>
                      Even if teal.fm disappears (though we plan to stick
                      around), your music history stays safe right in your PDS.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-4 justify-center text-pretty">
                <div className="flex justify-center flex-col max-w-lg gap-4 md:ml-4">
                  <div className="text-7xl">
                    <Brain height="4.5rem" width="4.5rem" />
                  </div>
                  <p className="text-2xl font-semibold">
                    Rooted in MusicBrainz.
                  </p>
                  <div className="text-muted-foreground">
                    The open-source database music nerds have trusted for
                    decades - and will for decades to come.
                  </div>
                  {/*
                <p className="text-lg text-balance">
                  We lean on MusicBrainz&apos;s crowdsourced precision to ensure
                  every artist, album, and track is tagged with pixel-perfect
                  metadata. Whether it’s correcting mislabeled tracks, surfacing
                  deep-cut album editions, or mapping niche genres, they help
                  turn chaos into clarity. Your listening history won&apos;t
                  just be history—it&apos;ll be a living archive, refined by a
                  global community of music lovers.
                </p> */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xl font-semibold">
                      Crowdsourced truth
                    </h3>
                    <p>
                      20+ years of contributions from music nerds (like us) mean
                      your tracks are labeled with pixel-perfect accuracy – down
                      to alternate takes and live bootlegs.
                    </p>
                    <h3 className="text-xl font-semibold">Forever.</h3>
                    <p>
                      MusicBrainz isn’t owned by a startup or streaming giant.
                      It’s owned by the MetaBrainz Foundation, a non-profit
                      organization specifically dedicated to preserving and
                      promoting music metadata.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground border-t pt-2">
                    teal.fm utilizes open-source music metadata from
                    MusicBrainz, a community-driven encyclopedia maintained by
                    contributors worldwide. teal.fm is not affiliated with,
                    endorsed by, or partnered with MusicBrainz. All data is
                    provided &quot;as-is&quot; per their stated CC0/CC BY-NC-SA
                    licenses.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UnderConstruction />
    </>
  );
}
