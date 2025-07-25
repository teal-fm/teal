import { execa } from 'execa';
import pc from 'picocolors';
import { findWorkspaceRoot } from '../utils/workspace.js';

export async function diff(commit: string = 'HEAD~1') {
  const workspaceRoot = findWorkspaceRoot();
  
  console.log(pc.blue(`🔍 Showing lexicon changes since ${commit}...`));
  
  try {
    await showLexiconDiff(workspaceRoot, commit);
    await showGeneratedDiff(workspaceRoot, commit);
  } catch (error) {
    console.error(pc.red('❌ Diff failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function showLexiconDiff(workspaceRoot: string, commit: string) {
  console.log(pc.cyan('  📝 Lexicon source changes:'));
  
  try {
    const { stdout } = await execa('git', [
      'diff',
      '--name-only',
      commit,
      'HEAD',
      'lexicons/'
    ], {
      cwd: workspaceRoot,
      stdio: 'pipe'
    });
    
    if (stdout.trim()) {
      console.log(pc.yellow('    Changed files:'));
      stdout.split('\n').forEach(file => {
        if (file.trim()) {
          console.log(pc.gray(`      ${file}`));
        }
      });
      
      // Show actual diff for lexicon files
      const { stdout: diffOutput } = await execa('git', [
        'diff',
        commit,
        'HEAD',
        'lexicons/'
      ], {
        cwd: workspaceRoot,
        stdio: 'pipe'
      });
      
      if (diffOutput.trim()) {
        console.log(pc.cyan('\n    Detailed changes:'));
        console.log(diffOutput);
      }
    } else {
      console.log(pc.green('    ✓ No lexicon source changes'));
    }
  } catch (error) {
    console.log(pc.yellow('    ⚠️  Could not check lexicon diff (not a git repo?)'));
  }
}

async function showGeneratedDiff(workspaceRoot: string, commit: string) {
  console.log(pc.cyan('\n  🔄 Generated type changes:'));
  
  try {
    const { stdout } = await execa('git', [
      'diff',
      '--name-only',
      commit,
      'HEAD',
      'packages/lexicons/src/types/',
      'services/types/src/'
    ], {
      cwd: workspaceRoot,
      stdio: 'pipe'
    });
    
    if (stdout.trim()) {
      console.log(pc.yellow('    Changed generated files:'));
      stdout.split('\n').forEach(file => {
        if (file.trim()) {
          console.log(pc.gray(`      ${file}`));
        }
      });
      
      console.log(pc.cyan(`\n    💡 Run 'git diff ${commit} HEAD -- packages/lexicons/src/types/' to see TypeScript changes`));
      console.log(pc.cyan(`    💡 Run 'git diff ${commit} HEAD -- services/types/src/' to see Rust changes`));
    } else {
      console.log(pc.green('    ✓ No generated type changes'));
    }
  } catch (error) {
    console.log(pc.yellow('    ⚠️  Could not check generated file diff'));
  }
}