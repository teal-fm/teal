import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Choices, LinkButton, Screen, Section } from "~/ds";
import { useAuth } from "~/lib/auth";
import { useHydrated } from "~/lib/media";
import { useBackdropPreferences } from "~/lib/backdrop";
import { useTheme } from "~/lib/theme";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Teal" }] }),
  component: Settings,
});

function Settings() {
  const { preference, setPreference } = useTheme();
  const backdrop = useBackdropPreferences();
  const status = useAuth((state) => state.status);
  // The theme lives in browser storage, so its control waits for hydration.
  const mounted = useHydrated();
  return (
    <Screen title="Settings" back>
      <Section title="Appearance" panel>
        <div className="flex flex-col gap-3">
          <p className="text-[15px] text-ink-2">Choose a theme, or follow your device.</p>
          {mounted ? (
            <Choices
              label="Theme"
              value={preference}
              onChange={setPreference}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          ) : null}
        </div>
      </Section>

      <Section title="Background" panel>
        <div className="flex flex-col gap-3">
          <p className="text-[15px] text-ink-2">Colour from the album covers on screen, behind every page.</p>
          {mounted ? (
            <>
              <Choices
                label="Background"
                value={backdrop.preferences.backdrop}
                onChange={(value) => backdrop.set("backdrop", value)}
                options={[
                  { value: "on", label: "Album colours" },
                  { value: "off", label: "Plain" },
                ]}
              />
              {backdrop.preferences.backdrop === "on" ? (
                <>
                  <Labelled label="Motion">
                    <Choices
                      label="Motion"
                      value={backdrop.preferences.motion}
                      onChange={(value) => backdrop.set("motion", value)}
                      options={[
                        { value: "moving", label: "Drifting" },
                        { value: "still", label: "Still" },
                      ]}
                    />
                  </Labelled>
                  <Labelled label="Colour">
                    <Choices
                      label="Colour"
                      value={backdrop.preferences.colour}
                      onChange={(value) => backdrop.set("colour", value)}
                      options={[
                        { value: "vivid", label: "Vivid" },
                        { value: "muted", label: "Muted" },
                      ]}
                    />
                  </Labelled>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </Section>

      <Section title="Account" panel>
        <LinkButton
          href={status === "loggedIn" ? "/auth/logout" : "/auth/login"}
          label={status === "loggedIn" ? "Sign out" : "Sign in"}
          variant="secondary"
        />
      </Section>

      <p className="halo text-center text-[13px] text-ink-2">
        Teal web {__APP_VERSION__} · {__GIT_COMMIT__}
      </p>
    </Screen>
  );
}

/** A visible name above a row of choices. */
function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden className="text-[13px] font-semibold text-ink-2">
        {label}
      </span>
      {children}
    </div>
  );
}
