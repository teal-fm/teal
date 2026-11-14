import { useQueries } from "@tanstack/react-query";
import { getAlbum } from "@teal/client/teal/api";
import { musicAlbumHref } from "@teal/client/teal/routes";
import { A, AmbientSource, Cover, coverUri, Glass, Heading } from "~/ds";

export type Favourite = { mbid: string; type: string };

export function favouriteId(item: Favourite) {
  return item.mbid.replace(/^mbid:/, "");
}

/** Up to four albums someone chose to define them, Letterboxd-style. */
export function Favourites({ favourites, isSelf, onEdit }: { favourites: Favourite[]; isSelf: boolean; onEdit?: () => void }) {
  const albums = useQueries({
    queries: favourites.map((f) => ({
      // Not ["album", …]: the album page keeps paged data under that key.
      queryKey: ["album-summary", favouriteId(f)],
      queryFn: () => getAlbum(`mbid:${favouriteId(f)}`, 1),
      staleTime: 60 * 60_000,
    })),
  });
  if (favourites.length === 0 && !isSelf) return null;

  return (
    <Glass as="section" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <Heading level={2} className="text-[20px]">
          Favourites
        </Heading>
        {isSelf && onEdit ? (
          <button type="button" onClick={onEdit} className="text-[15px] text-tint hover:underline">
            {favourites.length ? "Edit" : "Choose"}
          </button>
        ) : null}
      </div>
      {favourites.length === 0 ? (
        <p className="text-[15px] text-ink-2">Pick four albums that say who you are. They sit at the top of your profile.</p>
      ) : (
        <ul className="grid grid-cols-4 gap-2.5">
          {favourites.map((f, i) => {
            const album = albums[i]?.data?.album;
            const id = favouriteId(f);
            const body = (
              <AmbientSource uri={coverUri(id)}>
                <Cover releaseMbId={id} radius={10} className="shadow-lg" label={album?.name} />
                <p className="mt-1.5 truncate text-[13px] font-semibold text-ink">{album?.name ?? " "}</p>
                <p className="truncate text-xs text-ink-2">{album?.artistName ?? " "}</p>
              </AmbientSource>
            );
            return (
              <li key={id} className="min-w-0">
                {album?.artistName ? (
                  <A href={musicAlbumHref(album.artistName, album.name, id)} className="block hover:opacity-90">
                    {body}
                  </A>
                ) : (
                  body
                )}
              </li>
            );
          })}
          {/* Empty slots invite you to fill them, so only you see them. */}
          {Array.from({ length: isSelf ? 4 - favourites.length : 0 }, (_, i) => (
            <li key={`empty-${i}`} aria-hidden className="aspect-square rounded-[10px] border border-dashed border-hair" />
          ))}
        </ul>
      )}
    </Glass>
  );
}
