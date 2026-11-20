// Frontend permission registry + menu permissions se backend/config/permission_keys.php banata hai.
// Chalane ka tareeqa (repo root se): node scripts/sync-permission-keys.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const src = read('src/app/features/users/permission-registry.ts').replace(/^import .*$/m, '');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const tmp = path.join(os.tmpdir(), `perm-registry-${process.pid}.mjs`);
fs.writeFileSync(tmp, js);
const registry = await import(tmp);
fs.unlinkSync(tmp);

const menuKeys = [...read('src/app/core/nav/menu.config.ts').matchAll(/permission:\s*'([a-z_.]+)'/g)].map((m) => m[1]);
const keys = [...new Set([...registry.allPermissionKeys(), ...menuKeys, 'settings.manage'])].sort();

const out = "<?php\n\n// scripts/sync-permission-keys.mjs se generate hota hai. Haath se na badlein.\nreturn [\n" +
  keys.map((k) => `    '${k}',`).join('\n') + '\n];\n';
fs.writeFileSync(path.join(root, 'backend/config/permission_keys.php'), out);
console.log(`permission_keys.php: ${keys.length} keys`);
