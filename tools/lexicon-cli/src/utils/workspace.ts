import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export function findWorkspaceRoot(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  
  let currentDir = __dirname;
  
  while (currentDir !== '/') {
    const packageJsonPath = join(currentDir, 'package.json');
    const pnpmWorkspacePath = join(currentDir, 'pnpm-workspace.yaml');
    
    if (existsSync(packageJsonPath) && existsSync(pnpmWorkspacePath)) {
      return currentDir;
    }
    
    currentDir = dirname(currentDir);
  }
  
  throw new Error('Could not find workspace root (looking for pnpm-workspace.yaml)');
}

export function getRelativePath(from: string, to: string): string {
  const fromParts = from.split('/');
  const toParts = to.split('/');
  
  let commonLength = 0;
  while (
    commonLength < fromParts.length &&
    commonLength < toParts.length &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++;
  }
  
  const upLevels = fromParts.length - commonLength;
  const relativeParts = Array(upLevels).fill('..').concat(toParts.slice(commonLength));
  
  return relativeParts.join('/') || '.';
}