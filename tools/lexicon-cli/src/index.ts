#!/usr/bin/env node

import { Command } from 'commander';
import { generate } from './commands/generate.js';
import { watch } from './commands/watch.js';
import { validate } from './commands/validate.js';
import { diff } from './commands/diff.js';
import pc from 'picocolors';

const program = new Command();

program
  .name('lexicon-cli')
  .description('Unified lexicon management for Teal')
  .version('0.1.0');

program
  .command('generate')
  .alias('gen')
  .description('Generate TypeScript and Rust types from lexicons')
  .option('--ts-only', 'Generate only TypeScript types')
  .option('--rust-only', 'Generate only Rust types')
  .option('--force', 'Force regeneration even if no changes detected')
  .action(generate);

program
  .command('watch')
  .description('Watch lexicon files and auto-regenerate types')
  .option('--ts-only', 'Watch only TypeScript generation')
  .option('--rust-only', 'Watch only Rust generation')
  .action(watch);

program
  .command('validate')
  .description('Validate generated types for consistency')
  .action(validate);

program
  .command('diff')
  .description('Show changes between lexicon versions')
  .argument('[commit]', 'Git commit to compare against (default: HEAD~1)')
  .action(diff);

program.parseAsync().catch((error: unknown) => {
  console.error(pc.red('Error:'), error instanceof Error ? error.message : String(error));
  process.exit(1);
});