import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'dist');
const target = path.join(root, 'build', '_data', 'dist');

if (!fs.existsSync(source)) {
  throw new Error(`Missing build source: ${path.relative(root, source)}`);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Copied ${path.relative(root, source)} to ${path.relative(root, target)}`);
