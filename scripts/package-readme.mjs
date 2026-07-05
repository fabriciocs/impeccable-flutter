import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv[2];
const root = process.cwd();
const readme = path.join(root, 'README.md');
const repoReadme = path.join(root, 'README.repo.md');
const npmReadme = path.join(root, 'README.npm.md');

if (mode === 'prepack') {
  fs.copyFileSync(readme, repoReadme);
  fs.copyFileSync(npmReadme, readme);
  console.log('Prepared npm README');
} else if (mode === 'postpack') {
  fs.copyFileSync(repoReadme, readme);
  fs.rmSync(repoReadme, { force: true });
  console.log('Restored repository README');
} else {
  throw new Error('Usage: node scripts/package-readme.mjs <prepack|postpack>');
}
