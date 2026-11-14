import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { getTasteMatch } from "@teal/client/teal/api";
import { musicAlbumHref } from "@teal/client/teal/routes";
import { A, Avatar, Cover, Glass, Heading, Icon } from "~/ds";

const LEVEL = { high: "Very in tune", some: "Some overlap", low: "Different tastes" } as const;

/** How the viewer's listening overlaps with someone else's. */
export function TasteMatch({
  actor,
  viewer,
  name,
  avatars,
}: {
  actor: string;
  viewer: string;
  name: string;
  avatars: { viewer?: { did: string; avatar?: string }; actor?: { did: string; avatar?: string } };
}) {
  const match = useQuery({
    queryKey: ["taste", actor, viewer],
    queryFn: () => getTasteMatch(actor, viewer),
    staleTime: 10 * 60_000,
  });
  const data = match.data;
  if (!data || data.topArtistCount === 0) return null;
  const s = data.suggestion;

  return (
    <Glass as="section" className="flex flex-col gap-3.5 p-4">
      <Heading level={2} className="text-[20px]">
        You and {name}
      </Heading>
      <div className="flex items-center gap-3.5">
        <div className="flex">
          <Avatar did={avatars.viewer?.did} avatar={avatars.viewer?.avatar} size={44} />
          <span style={{ marginLeft: -14 }}>
            <Avatar did={avatars.actor?.did} avatar={avatars.actor?.avatar} name={name} size={44} />
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="rounded-full bg-tint-soft px-2.5 py-0.5 text-[13.5px] font-bold text-tint">{LEVEL[data.level]}</span>
          <p className="text-[15px] text-ink-2">
            <span className="font-semibold text-ink">
              {data.sharedArtistCount} of your top {data.topArtistCount} artists
            </span>{" "}
            {data.sharedArtistCount === 1 ? "is" : "are"} in {name}'s too.
          </p>
        </div>
      </div>
      {data.sharedArtists.length > 0 ? (
        <>
          <p className="-mb-1.5 text-[15px] text-ink-2">You both love</p>
          <ul className="grid grid-cols-4 gap-2.5">
            {data.sharedArtists.slice(0, 4).map((artist) => (
              <li key={artist.name} className="min-w-0">
                <Cover releaseMbId={artist.releaseMbId} radius={9} label={artist.releaseName} />
                <p className="mt-1.5 truncate text-[13px] font-semibold text-ink">{artist.name}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {s?.releaseMbId ? (
        <A
          href={s.artistName ? musicAlbumHref(s.artistName, s.releaseName, s.releaseMbId) : "/"}
          className="flex items-center gap-3 rounded-[14px] border border-hair p-3 hover:bg-fill"
        >
          <Cover releaseMbId={s.releaseMbId} size={56} radius={8} />
          <span className="flex-1 text-[14.5px] text-ink-2">
            <span className="font-semibold text-ink">{s.releaseName}</span> is {name}'s #{s.rank} this month, and you've never played it.
          </span>
          <Icon icon={ChevronRight} size={18} className="text-ink-3" />
        </A>
      ) : null}
    </Glass>
  );
}
