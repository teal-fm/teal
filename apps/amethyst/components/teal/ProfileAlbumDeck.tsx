import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  getUserTopReleases,
  type StatsPeriod,
} from "@/lib/teal/api";
import { musicAlbumHref } from "@/lib/teal/routes";
import { Disc3 } from "lucide-react-native";

import type { ReleaseView } from "@teal/lexicons/src/fm/teal/stats/defs";

const periodLabels: Record<StatsPeriod, string> = {
  "7days": "7 days",
  "30days": "30 days",
  "90days": "90 days",
  "180days": "180 days",
  "365days": "365 days",
  all: "all time",
};

function AlbumSleeve({
  release,
  index,
  open,
}: {
  release: ReleaseView;
  index: number;
  open: boolean;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const art = failed ? undefined : coverArtUrl(release.mbid, 250);
  const name = release.name || "Unknown album";
  const label = `#${index + 1}: ${name} · ${release.playCount || 0} plays`;
  const href = release.mbid
    ? musicAlbumHref("music", name, release.mbid)
    : undefined;

  if (Platform.OS !== "web") {
    const content = (
      <Pressable
        accessibilityLabel={label}
        className="h-14 w-14 overflow-hidden rounded-md border-2 border-card bg-muted"
      >
        {art ? (
          <Image
            source={{ uri: art }}
            className="h-full w-full"
            onError={() => setFailed(true)}
          />
        ) : (
          <Icon icon={Disc3} size={24} />
        )}
      </Pressable>
    );
    return href ? (
      <Link href={href as any} asChild>
        {content}
      </Link>
    ) : (
      content
    );
  }

  const Sleeve = href ? "a" : "div";
  const content = (
    <Sleeve
      href={href}
      className="profile-album-sleeve"
      style={{ "--album-index": index } as CSSProperties}
      aria-label={label}
      title={label}
      tabIndex={href && open ? 0 : -1}
      role={href ? undefined : "img"}
      aria-hidden={!open}
      onClick={(event) => {
        if (
          !href ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        router.push(href as any);
      }}
    >
      {art ? (
        <img
          src={art}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <Disc3 size={28} aria-hidden />
      )}
      <span className="profile-album-rank" aria-hidden>
        {index + 1}
      </span>
    </Sleeve>
  );
  return content;
}

export default function ProfileAlbumDeck({
  actor,
  period,
  avatarUrl,
  displayName,
}: {
  actor: string;
  period: StatsPeriod;
  avatarUrl?: string;
  displayName: string;
}) {
  const [albums, setAlbums] = useState<ReleaseView[]>([]);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const hovering = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const controlsId = useId();

  useEffect(() => {
    let current = true;
    setAlbums([]);
    setOpen(false);
    pinned.current = false;
    getUserTopReleases(actor, period, 4).then(
      (result) => {
        if (current) setAlbums(result.releases.slice(0, 4));
      },
      () => {
        if (current) setAlbums([]);
      },
    );
    return () => {
      current = false;
    };
  }, [actor, period]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    function dismiss(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target)
      ) {
        pinned.current = false;
        setOpen(false);
      }
    }
    function dismissWithEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (root.current?.contains(document.activeElement)) {
        event.preventDefault();
        button.current?.focus();
      }
      pinned.current = false;
      setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismissWithEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismissWithEscape);
    };
  }, [open]);

  const hasAlbums = albums.length > 0;
  const avatar = avatarUrl && !avatarFailed;
  const label = `Top ${albums.length} albums · ${periodLabels[period]}`;

  if (Platform.OS !== "web") {
    return (
      <View className="h-40 items-center justify-center gap-2">
        {open && (
          <View className="flex-row gap-2">
            {albums.map((release, index) => (
              <AlbumSleeve
                key={`${release.mbid || release.name}-${index}`}
                release={release}
                index={index}
                open
              />
            ))}
          </View>
        )}
        <Pressable
          accessibilityRole={hasAlbums ? "button" : "image"}
          accessibilityLabel={hasAlbums ? label : `${displayName}'s avatar`}
          accessibilityState={{ expanded: open }}
          onPress={() => hasAlbums && setOpen(!open)}
          className="h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-accent"
        >
          {avatar ? (
            <Image
              source={{ uri: avatarUrl }}
              className="h-full w-full"
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <Text className="font-accent text-3xl text-primary">
              {displayName.slice(0, 1).toUpperCase()}
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  const avatarContent = avatar ? (
    <img
      src={avatarUrl}
      alt=""
      draggable={false}
      onError={() => setAvatarFailed(true)}
    />
  ) : (
    <span>{displayName.slice(0, 1).toUpperCase()}</span>
  );
  return (
    <div
      ref={root}
      className="profile-album-deck"
      data-open={open}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          hovering.current = true;
          if (hasAlbums) setOpen(true);
        }
      }}
      onPointerLeave={() => {
        hovering.current = false;
        if (!pinned.current && !root.current?.contains(document.activeElement))
          setOpen(false);
      }}
      onFocusCapture={(event) => {
        if (hasAlbums && event.target.matches(":focus-visible")) setOpen(true);
      }}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !pinned.current &&
          !hovering.current
        )
          setOpen(false);
      }}
    >
      {hasAlbums ? (
        <button
          ref={button}
          type="button"
          className="profile-deck-avatar"
          aria-label={`${open ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-expanded={open}
          aria-controls={controlsId}
          onClick={() => {
            const next = !open;
            pinned.current = next;
            setOpen(next);
          }}
        >
          {avatarContent}
        </button>
      ) : (
        <div
          className="profile-deck-avatar"
          role="img"
          aria-label={`${displayName}'s avatar`}
        >
          {avatarContent}
        </div>
      )}
      <div id={controlsId} className="profile-album-sleeves" aria-label={label}>
        {albums.map((release, index) => (
          <AlbumSleeve
            key={`${release.mbid || release.name}-${index}`}
            release={release}
            index={index}
            open={open}
          />
        ))}
      </div>
    </div>
  );
}
