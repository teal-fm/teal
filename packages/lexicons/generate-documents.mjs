import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// @atproto/api still accepts JSON Lexicon documents when registering custom
// PDS calls. Keep those source documents separate from modern runtime schemas.
async function documentsIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const documents = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) documents.push(...(await documentsIn(path)));
    else if (entry.name.endsWith(".json")) {
      documents.push(JSON.parse(await readFile(path, "utf8")));
    }
  }
  return documents;
}

const documents = await documentsIn(process.argv[2]);
await writeFile(
  new URL("./src/documents.ts", import.meta.url),
  `// Generated from JSON Lexicons. Do not edit.\nimport type { LexiconDoc } from "@atproto/lexicon";\n\nexport const schemas: LexiconDoc[] = ${JSON.stringify(documents, null, 2)};\n`,
);
