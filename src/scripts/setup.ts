import * as fs from 'fs';
import * as path from 'path';

const DATA_DIRS = ['.audit-data', '.audit-data/reports', '.audit-data/vectors'];

async function setup(): Promise<void> {
  console.log('[code-audit-mcp] Running post-install setup...');

  for (const dir of DATA_DIRS) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[code-audit-mcp] Created directory: ${dir}`);
    }
  }

  const gitignorePath = '.gitignore';
  const auditIgnoreEntry = '\n# code-audit-mcp data\n.audit-data/\n';

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes('.audit-data')) {
      fs.appendFileSync(gitignorePath, auditIgnoreEntry);
      console.log('[code-audit-mcp] Added .audit-data/ to .gitignore');
    }
  }

  console.log('[code-audit-mcp] Setup complete!');
}

setup().catch(console.error);
