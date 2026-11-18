import { Link } from "@tanstack/react-router";

import { Logo } from "./Logo";
import { SearchBox } from "./SearchBox";

/** The slim bar on every page but the home page. */
export function Header() {
  return (
    <header className="mx-auto flex max-w-5xl items-center gap-4 px-4 pt-5 sm:px-6 lg:px-8">
      <Link to="/" aria-label="teal.fm home" className="shrink-0">
        <Logo size="sm" />
      </Link>
      <div className="ml-auto w-full max-w-xs">
        <SearchBox size="sm" />
      </div>
    </header>
  );
}
