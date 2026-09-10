import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

export function canonicalizeGeneratedRust(root: string) {
  for (const filePath of rustFiles(root)) {
    const original = readFileSync(filePath, "utf8");
    const canonical = canonicalizeRustSource(original);

    if (canonical !== original) {
      writeFileSync(filePath, canonical);
    }
  }
}

function rustFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...rustFiles(path));
    } else if (entry.endsWith(".rs")) {
      files.push(path);
    }
  }

  return files;
}

function canonicalizeRustSource(source: string): string {
  let output = canonicalizeStateModules(source);
  output = sortIsSetBounds(output);
  return output;
}

function canonicalizeStateModules(source: string): string {
  const modulePattern = /pub mod \w+_state \{/g;
  let output = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = modulePattern.exec(source)) !== null) {
    const start = match.index;
    const openBrace = source.indexOf("{", start);
    const end = findMatchingBrace(source, openBrace);

    if (end === -1) {
      break;
    }

    output += source.slice(cursor, start);
    output += canonicalizeStateModule(source.slice(start, end + 1));
    cursor = end + 1;
    modulePattern.lastIndex = end + 1;
  }

  return output + source.slice(cursor);
}

function findMatchingBrace(source: string, openBrace: number): number {
  let depth = 0;

  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function canonicalizeStateModule(block: string): string {
  let output = sortTypeLines(block);
  output = sortTransitionBlocks(output);
  output = sortMembers(output);
  return output;
}

function sortTypeLines(source: string): string {
  const lines = source.split("\n");
  const sorted: string[] = [];

  for (let index = 0; index < lines.length;) {
    if (isSortableTypeLine(lines[index])) {
      const start = index;
      while (index < lines.length && isSortableTypeLine(lines[index])) {
        index += 1;
      }
      sorted.push(...lines.slice(start, index).sort(compareByTypeName));
    } else {
      sorted.push(lines[index]);
      index += 1;
    }
  }

  return sorted.join("\n");
}

function sortTransitionBlocks(source: string): string {
  const marker = "    ///State transition - sets the `";
  const membersIndex = source.indexOf("    /// Marker types for field names");
  const firstTransition = source.indexOf(marker);

  if (firstTransition === -1 || membersIndex === -1 || firstTransition > membersIndex) {
    return source;
  }

  const prefix = source.slice(0, firstTransition);
  const transitionsSource = source.slice(firstTransition, membersIndex);
  const suffix = source.slice(membersIndex);
  const transitions = transitionsSource
    .split(`\n${marker}`)
    .map((part, index) => index === 0 ? part : `${marker}${part}`)
    .filter((part) => part.trim().length > 0)
    .map((part) => sortTypeLines(part.replace(/^\n+/, "").replace(/\n+$/, "")));

  transitions.sort((a, b) => compareKeys(transitionKey(a), transitionKey(b)));

  return `${prefix}${transitions.join("\n")}\n${suffix}`;
}

function sortMembers(source: string): string {
  const membersPattern = /    pub mod members \{\n([\s\S]*?)    \}/;
  const match = membersPattern.exec(source);

  if (!match) {
    return source;
  }

  const entries = match[1]
    .split("        ///Marker type for the `")
    .map((part, index) => index === 0 ? part : `        ///Marker type for the \`${part}`)
    .filter((part) => part.trim().length > 0);

  entries.sort((a, b) => compareKeys(memberKey(a), memberKey(b)));

  const replacement = `    pub mod members {\n${entries.join("")}    }`;
  return source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length);
}

function sortIsSetBounds(source: string): string {
  return source.replace(
    /((?:    St::[A-Za-z][A-Za-z0-9_]*: [A-Za-z0-9_:]+_state::IsSet,\n){2,})/g,
    (block) => block.split("\n").filter(Boolean).sort(compareByTypeName).join("\n") + "\n",
  );
}

function isSortableTypeLine(line: string): boolean {
  return /^        type (?:r#)?[A-Za-z][A-Za-z0-9_]*(?:;| = )/.test(line);
}

function compareByTypeName(left: string, right: string): number {
  return compareKeys(typeKey(left), typeKey(right));
}

function typeKey(line: string): string {
  return line.match(/\btype ((?:r#)?[A-Za-z][A-Za-z0-9_]*)/)?.[1].replace(/^r#/, "") ?? line;
}

function transitionKey(block: string): string {
  return block.match(/\btype ([A-Za-z][A-Za-z0-9_]*) = Set</)?.[1]
    ?? block.match(/pub struct Set([A-Za-z][A-Za-z0-9_]*)/)?.[1]
    ?? block;
}

function memberKey(entry: string): string {
  return entry.match(/pub struct ((?:r#)?[A-Za-z_][A-Za-z0-9_]*)/)?.[1].replace(/^r#/, "") ?? entry;
}

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
