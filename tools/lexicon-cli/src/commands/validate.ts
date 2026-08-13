import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import pc from 'picocolors';
import { findWorkspaceRoot } from '../utils/workspace.js';

export async function validate() {
  const workspaceRoot = findWorkspaceRoot();
  
  console.log(pc.blue('🔍 Validating lexicon types...'));
  
  try {
    await validateTypeScriptGeneration(workspaceRoot);
    await validateRustGeneration(workspaceRoot);
    await validateConsistency(workspaceRoot);
    
    console.log(pc.green('✅ All validations passed!'));
  } catch (error) {
    console.error(pc.red('❌ Validation failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function validateTypeScriptGeneration(workspaceRoot: string) {
  console.log(pc.cyan('  📦 Validating TypeScript generation...'));
  
  const lexiconsPath = join(workspaceRoot, 'lexicons');
  const packagesLexiconsPath = join(workspaceRoot, 'packages/lexicons');
  
  if (!existsSync(lexiconsPath)) {
    throw new Error('Lexicons directory not found at workspace root');
  }
  
  if (!existsSync(packagesLexiconsPath)) {
    console.log(pc.yellow('    ⚠️  TypeScript lexicons package not found, skipping validation'));
    return;
  }
  
  const typesPath = join(packagesLexiconsPath, 'src/types');
  
  if (!existsSync(typesPath)) {
    throw new Error('TypeScript types directory not found');
  }
  
  // Check if generated files exist for each source lexicon
  const sourceFiles = await glob('**/*.json', { cwd: lexiconsPath });
  
  for (const sourceFile of sourceFiles) {
    const namespace: string = sourceFile
      .replace(/\.json$/, '')
      .split('/')
      .flatMap((segment) => segment.split('.'))
      .join('/');
    const expectedTypeFile = join(typesPath, namespace + '.ts');
    
    if (!existsSync(expectedTypeFile)) {
      console.log(pc.yellow(`    ⚠️  Missing TypeScript types for: ${sourceFile}`));
    }
  }
  
  console.log(pc.green('    ✓ TypeScript validation complete'));
}

async function validateRustGeneration(workspaceRoot: string) {
  console.log(pc.cyan('  🦀 Validating Rust generation...'));
  
  const typesPath = join(workspaceRoot, 'services/types');
  const lexiconsPath = join(workspaceRoot, 'lexicons');
  const srcPath = join(typesPath, 'src');
  
  if (!existsSync(lexiconsPath)) {
    throw new Error('Lexicons directory not found at workspace root');
  }
  
  if (!existsSync(srcPath)) {
    throw new Error('Rust src directory not found');
  }
  
  // Check if Cargo.toml exists
  const cargoTomlPath = join(typesPath, 'Cargo.toml');
  if (!existsSync(cargoTomlPath)) {
    throw new Error('Cargo.toml not found in types directory');
  }
  
  console.log(pc.green('    ✓ Rust validation complete'));
}

async function validateConsistency(workspaceRoot: string) {
  console.log(pc.cyan('  🔄 Validating cross-language consistency...'));
  
  // Use centralized lexicons directory
  const lexiconsPath = join(workspaceRoot, 'lexicons');
  
  if (!existsSync(lexiconsPath)) {
    throw new Error('Cannot validate consistency - lexicons directory not found');
  }
  
  // Count lexicon files
  const lexiconFiles = await glob('**/*.json', { cwd: lexiconsPath });
  
  console.log(pc.gray(`    Lexicon files found: ${lexiconFiles.length} files`));
  
  // Check if TypeScript and Rust generated types exist
  const tsTypesPath = join(workspaceRoot, 'packages/lexicons/src/types');
  const rustTypesPath = join(workspaceRoot, 'services/types/src');
  
  let tsExists = existsSync(tsTypesPath);
  let rustExists = existsSync(rustTypesPath);
  
  console.log(pc.gray(`    TypeScript types: ${tsExists ? 'Found' : 'Not found'}`));
  console.log(pc.gray(`    Rust types: ${rustExists ? 'Found' : 'Not found'}`));
  
  if (!tsExists && !rustExists) {
    console.log(pc.yellow('    ⚠️  No generated types found for either language'));
  }
  
  console.log(pc.green('    ✓ Consistency validation complete'));
}
