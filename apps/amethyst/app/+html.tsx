import { ScrollViewStyleReset } from "expo-router/html";

// The web document shell. Runs in Node during rendering, so no DOM access here.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Teal</title>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* Pages scroll inside their ScrollView, as on native. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Matches --ground so the first paint doesn't flash before global.css loads.
const responsiveBackground = `
body { background-color: #ffffff; }
@media (prefers-color-scheme: dark) {
  body { background-color: #000000; }
}`;
