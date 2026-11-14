import type { MomentView } from "@teal/client/teal/api";
import { musicAlbumHref } from "@teal/client/teal/routes";
import { A, AmbientSource, Avatar, Cover, coverUri, Glass, Heading } from "~/ds";

function albumHref(m: MomentView) {
  const r = m.release;
  return r.releaseMbId && r.artistName ? musicAlbumHref(r.artistName, r.releaseName, r.releaseMbId) : undefined;
}

/** One way to say how many are on an album, wherever it shows. */
function caption(m: MomentView) {
  const noun = m.kind === "circle" ? ["friend", "friends"] : ["listener", "listeners"];
  const people = `${m.listenerCount} ${m.listenerCount === 1 ? noun[0] : noun[1]}`;
  if (m.kind === "trending" && m.changePercent) return `${people} · +${m.changePercent}%`;
  return `${people} today`;
}

function Faces({ moment, size }: { moment: MomentView; size: number }) {
  return (
    <div className="flex">
      {moment.listeners.slice(0, 3).map((p, i) => (
        <span key={p.did} style={{ marginLeft: i ? -size / 3 : 0 }}>
          <Avatar did={p.did} avatar={p.avatar} name={p.displayName ?? p.handle} size={size} />
        </span>
      ))}
    </div>
  );
}

function MaybeLink({ href, className, children }: { href?: string; className?: string; children: React.ReactNode }) {
  return href ? (
    <A href={href} className={className}>
      {children}
    </A>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** A horizontal shelf of albums people are converging on today. */
export function HeatingShelf({ moments, title = "Heating up" }: { moments: MomentView[]; title?: string }) {
  if (moments.length === 0) return null;
  return (
    <section className="mt-1 mb-5">
      <Heading level={2} onBackdrop className="px-2.5 pb-3">
        {title}
      </Heading>
      <ul className="flex snap-x gap-3.5 overflow-x-auto px-2.5 pb-2 scrollbar-none">
        {moments.map((m) => (
          <li key={m.release.releaseMbId ?? m.release.releaseName} className="w-[150px] shrink-0 snap-start">
            <MaybeLink href={albumHref(m)} className="block hover:opacity-90">
              <AmbientSource uri={coverUri(m.release.releaseMbId)}>
                <Cover releaseMbId={m.release.releaseMbId} size={150} radius={14} className="shadow-xl" />
              </AmbientSource>
              <p className="halo mt-2 truncate text-sm font-semibold text-ink">{m.release.releaseName}</p>
              <p className="halo truncate text-[13px] text-ink-2">{caption(m)}</p>
              <div className="mt-1.5">
                <Faces moment={m} size={20} />
              </div>
            </MaybeLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The same albums as a compact list for the desktop rail. */
export function HeatingRail({ moments }: { moments: MomentView[] }) {
  if (moments.length === 0) return null;
  return (
    <Glass as="section" className="flex flex-col gap-1 p-4">
      <Heading level={2} className="mb-1 text-[19px]">
        Heating up
      </Heading>
      {moments.map((m) => (
        <MaybeLink
          key={m.release.releaseMbId ?? m.release.releaseName}
          href={albumHref(m)}
          className="flex items-center gap-3 rounded-[12px] py-1.5 hover:opacity-85"
        >
          <Cover releaseMbId={m.release.releaseMbId} size={52} radius={9} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold text-ink">{m.release.releaseName}</span>
            <span className="truncate text-[13.5px] text-ink-2">{caption(m)}</span>
          </span>
        </MaybeLink>
      ))}
    </Glass>
  );
}
