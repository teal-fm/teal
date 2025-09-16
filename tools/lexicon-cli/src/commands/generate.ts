import { existsSync } from "fs";
import { join } from "path";
import { execa } from "execa";
import pc from "picocolors";

import { findWorkspaceRoot } from "../utils/workspace.js";

interface GenerateOptions {
  tsOnly?: boolean;
  rustOnly?: boolean;
  force?: boolean;
}

export async function generate(options: GenerateOptions = {}) {
  const workspaceRoot = findWorkspaceRoot();

  console.log(pc.blue("🔧 Generating lexicon types..."));

  try {
    if (!options.rustOnly) {
      await generateTypeScript(workspaceRoot, options.force);
    }

    if (!options.tsOnly) {
      await generateRust(workspaceRoot, options.force);
    }

    console.log(pc.green("✅ Lexicon generation complete!"));
  } catch (error) {
    console.error(
      pc.red("❌ Generation failed:"),
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

async function generateTypeScript(workspaceRoot: string, force?: boolean) {
  const lexiconsPath = join(workspaceRoot, "lexicons");

  if (!existsSync(lexiconsPath)) {
    throw new Error("Lexicons directory not found at workspace root");
  }

  // Check if packages/lexicons exists for TypeScript generation
  const packagesLexiconsPath = join(workspaceRoot, "packages/lexicons");
  if (!existsSync(packagesLexiconsPath)) {
    console.log(
      pc.yellow(
        "    ⚠️  TypeScript lexicons package not found, skipping TypeScript generation",
      ),
    );
    return;
  }

  console.log(pc.cyan("  📦 Generating TypeScript types..."));

  try {
    await execa("pnpm", ["lex:gen-server"], {
      cwd: packagesLexiconsPath,
      stdio: "inherit",
    });
    console.log(pc.green("    ✓ TypeScript types generated"));
  } catch (error) {
    throw new Error(
      `TypeScript generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function generateRust(workspaceRoot: string, force?: boolean) {
  const typesPath = join(workspaceRoot, "services/types");
  const lexiconsPath = join(workspaceRoot, "lexicons");

  if (!existsSync(typesPath)) {
    throw new Error("Rust types service not found");
  }

  if (!existsSync(lexiconsPath)) {
    throw new Error("Lexicons directory not found at workspace root");
  }

  console.log(pc.cyan("  🦀 Generating Rust types..."));

  try {
    // Check if esquema-cli is available
    try {
      await execa("esquema-cli", ["--version"], { stdio: "pipe" });
    } catch {
      console.log(pc.yellow("    ⚠️  esquema-cli not found. Installing..."));
      try {
        await execa(
          "cargo",
          [
            "install",
            "esquema-cli",
            "--git",
            "https://github.com/fatfingers23/esquema.git",
          ],
          {
            stdio: "inherit",
          },
        );
        console.log(pc.green("    ✓ esquema-cli installed successfully"));
      } catch (installError) {
        throw new Error(
          "Failed to install esquema-cli. Please install manually: cargo install esquema-cli --git https://github.com/fatfingers23/esquema.git",
        );
      }
    }

    // create typespath/src if it doesn't exist
    if (!existsSync(join(typesPath, "src"))) {
      console.log(pc.yellow("    Creating src directory for Rust types..."));
      await execa("mkdir", ["-p", join(typesPath, "src")], {
        stdio: "inherit",
      });
    }

    await execa(
      "esquema-cli",
      [
        "generate",
        "local",
        "--lexdir",
        lexiconsPath,
        "--outdir",
        join(typesPath, "src"),
      ],
      {
        cwd: typesPath,
        stdio: "inherit",
      },
    );

    console.log(pc.green("    ✓ Rust types generated"));
  } catch (error) {
    throw new Error(
      `Rust generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
