import { createFileRoute } from "@tanstack/react-router";
import { Choices, LinkButton, Screen, Section } from "~/ds";
import { useAuth } from "~/lib/auth";
import { useHydrated } from "~/lib/media";
import { useTheme } from "~/lib/theme";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Teal" }] }),
  component: Settings,
});

function Settings() {
  const { preference, setPreference } = useTheme();
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
