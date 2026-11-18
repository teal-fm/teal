import type { Profile } from "~/lib/types";

export function Avatar({
  profile,
  size = 32,
}: {
  profile?: Profile;
  size?: number;
}) {
  const letter = (profile?.displayName || profile?.handle || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-teal-500/25 font-semibold text-teal-800 dark:text-teal-100"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {letter}
      {profile?.avatar && (
        <img
          src={profile.avatar}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
