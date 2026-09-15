#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync } from 'node:fs';

mkdirSync('build/_data', { recursive: true });
rmSync('build/_data/dist', { recursive: true, force: true });
cpSync('dist', 'build/_data/dist', { recursive: true });
