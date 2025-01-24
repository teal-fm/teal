import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import Image from "next/image";

/**
 * Shared layout configurations
 *
 * you can configure layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    // can be JSX too!
    title: (
      <>
        {" "}
        <Image
          src="/tfm-dark.png"
          className="dark:block hidden"
          width={80}
          height={22.5}
          alt="logo"
        />
        <Image
          src="/tfm-light.png"
          className="dark:hidden"
          width={80}
          height={22.5}
          alt="logo"
        />
        <span className="text-teal-500 dark:text-teal-400 font-semibold text-xl -ml-1">
          docs
        </span>
      </>
    ),
  },
  githubUrl: "https://github.com/teal-fm/teal",
  links: [],
};
