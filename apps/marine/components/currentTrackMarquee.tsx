import React, { useEffect, useState, useRef } from "react";
import { Music, Disc, Radio, Mic2, PlayCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface MarqueeItem {
  id: string;
  artist: string;
  track: string;
  album: string;
  image: string;
  icon: "music" | "disc" | "radio" | "mic" | "play";
}

interface MarqueeProps {
  speed?: number; // pixels per second
}

export function Marquee({ speed = 30 }: MarqueeProps) {
  const [items, setItems] = useState<MarqueeItem[]>([]);
  const [trackPool, setTrackPool] = useState<MarqueeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  function getRandomIcon() {
    const icons: ("music" | "disc" | "radio" | "mic" | "play")[] = [
      "music",
      "disc",
      "radio",
      "mic",
      "play",
    ];
    return icons[Math.floor(Math.random() * icons.length)];
  }

  async function fetchLastFmTracks(): Promise<MarqueeItem[]> {
    try {
      const response = await fetch(
        "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=kanb&api_key=6f5ff9d828991a85bd78449a85548586&limit=50&format=json",
      );
      const data = await response.json();
      return data.recenttracks.track.map((track: any) => ({
        id: Math.random().toString(36).substring(2, 9),
        artist: track.artist["#text"],
        track: track.name,
        album: track.album["#text"],
        image:
          track.image[2]["#text"] ||
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
        icon: getRandomIcon(),
      }));
    } catch (error) {
      console.error("Error fetching Last.fm data:", error);
      return [];
    }
  }

  async function generateInitialItems() {
    setIsLoading(true);
    const tracks = await fetchLastFmTracks();
    if (tracks.length > 0) {
      setItems(tracks.slice(0, 30));
      setTrackPool(tracks.slice(30));
    }
    setIsLoading(false);
  }

  const IconComponent = ({ type }: { type: MarqueeItem["icon"] }) => {
    switch (type) {
      case "music":
        return <Music className="w-5 h-5" />;
      case "disc":
        return <Disc className="w-5 h-5" />;
      case "radio":
        return <Radio className="w-5 h-5" />;
      case "mic":
        return <Mic2 className="w-5 h-5" />;
      case "play":
        return <PlayCircle className="w-5 h-5" />;
    }
  };

  useEffect(() => {
    generateInitialItems();
  }, []);
  useEffect(() => {
    if (isLoading) return;

    const FETCH_INTERVAL = 30000; // 30 seconds
    let timeoutId: NodeJS.Timeout;

    const fetchData = async () => {
      const tracks = await fetchLastFmTracks();
      if (tracks.length > 0) {
        setTrackPool(tracks);
      }
      timeoutId = setTimeout(fetchData, FETCH_INTERVAL);
    };

    fetchData();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading]);

  // Separate effect for data fetching
  useEffect(() => {
    if (isLoading) return;

    const FETCH_INTERVAL = 30000; // 30 seconds
    let timeoutId: NodeJS.Timeout;

    const fetchData = async () => {
      const tracks = await fetchLastFmTracks();
      if (tracks.length > 0) {
        setTrackPool(tracks);
      }
      timeoutId = setTimeout(fetchData, FETCH_INTERVAL);
    };

    fetchData();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading]);

  if (isLoading || items.length === 0) {
    return (
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 0.8,
          ease: "easeInOut",
        }}
        className="flex items-center justify-center h-32"
      >
        <div className="flex items-center gap-3 text-white">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg">Loading tracks...</span>
        </div>
      </motion.h1>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.8,
        ease: "easeInOut",
      }}
      className="relative overflow-hidden transparent h-32 max-h-32"
    >
      <div
        className="flex whitespace-nowrap"
        style={{
          width: "100%",
        }}
      >
        <div className="animate-marquee inline-flex gap-8">
          {items.map((item) => (
            <motion.div
              key={`${item.id}-duplicate`}
              className="flex-shrink-0 noisey w-[300px] p-2 bg-opacity-30 bg-muted/50 rounded-lg shadow-lg border border-purple-500/10 backdrop-blur-sm"
            >
              <TrackCard item={item} />
            </motion.div>
          ))}
          {/* Duplicate items for seamless loop */}
          {items.map((item) => (
            <motion.div
              key={`${item.id}-duplicate`}
              className="flex-shrink-0 noisey w-[300px] p-2 bg-opacity-30 bg-muted/50 rounded-lg shadow-lg border border-purple-500/10 backdrop-blur-sm"
            >
              <TrackCard item={item} />
            </motion.div>
          ))}
          {items.map((item) => (
            <motion.div
              key={`${item.id}-duplicate`}
              className="flex-shrink-0 noisey w-[300px] p-2 bg-opacity-30 bg-muted/50 rounded-lg shadow-lg border border-purple-500/10 backdrop-blur-sm"
            >
              <TrackCard item={item} />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
const TrackCard = ({ item }: { item: MarqueeItem }) => {
  return (
    <div className="flex items-center gap-4">
      <img
        src={item.image}
        alt={item.track}
        className="w-16 h-16 rounded-md object-cover"
      />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-white font-medium truncate">{item.track}</p>
        <p className="text-gray-300 text-sm truncate">{item.artist}</p>
        <p className="text-gray-300 text-xs truncate">{item.album}</p>
      </div>
    </div>
  );
};
