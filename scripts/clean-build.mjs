import fs from 'node:fs';
import path from 'node:path';

for (const rel of ['dist', 'build']) {
  fs.rmSync(path.join(process.cwd(), rel), { recursive: true, force: true });
}

console.log('Removed dist and build');
