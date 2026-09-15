#!/usr/bin/env node
import { rmSync } from 'node:fs';

for (const dir of ['dist', 'build']) {
  rmSync(dir, { recursive: true, force: true });
}
