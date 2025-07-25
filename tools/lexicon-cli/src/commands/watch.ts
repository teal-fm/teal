import chokidar from 'chokidar';
import { join } from 'path';
import pc from 'picocolors';
import { generate } from './generate.js';
import { findWorkspaceRoot } from '../utils/workspace.js';

interface WatchOptions {
  tsOnly?: boolean;
  rustOnly?: boolean;
}

export async function watch(options: WatchOptions = {}) {
  const workspaceRoot = findWorkspaceRoot();
  const lexiconsPath = join(workspaceRoot, 'lexicons');
  
  console.log(pc.blue('👀 Watching lexicon files for changes...'));
  console.log(pc.gray(`  Lexicons directory: ${lexiconsPath}`));
  console.log(pc.yellow('  Press Ctrl+C to stop watching'));
  
  const watcher = chokidar.watch(lexiconsPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true
  });
  
  let isGenerating = false;
  
  const handleChange = async (path: string, event: string) => {
    if (isGenerating) {
      console.log(pc.yellow(`  ⏳ Skipping ${event} for ${path} (generation in progress)`));
      return;
    }
    
    console.log(pc.cyan(`  📝 ${event}: ${path}`));
    
    isGenerating = true;
    try {
      await generate(options);
    } catch (error) {
      console.error(pc.red('  ❌ Auto-generation failed:'), error instanceof Error ? error.message : String(error));
    } finally {
      isGenerating = false;
    }
  };
  
  watcher
    .on('add', (path) => handleChange(path, 'Added'))
    .on('change', (path) => handleChange(path, 'Changed'))
    .on('unlink', (path) => handleChange(path, 'Removed'))
    .on('error', (error) => console.error(pc.red('Watcher error:'), error));
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(pc.yellow('\n🛑 Stopping lexicon watcher...'));
    watcher.close();
    process.exit(0);
  });
  
  // Keep the process alive
  return new Promise<void>(() => {});
}