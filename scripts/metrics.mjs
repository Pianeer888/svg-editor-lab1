import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : extname(entry.name) === '.ts' ? [path] : [];
  });
}

const rows = files(sourceRoot).sort().map(path => {
  const content = readFileSync(path, 'utf8');
  const sourceLines = content.split('\n').filter(line => line.trim() && !line.trimStart().startsWith('//')).length;
  const imports = [...content.matchAll(/^import .*? from ['"](.+?)['"];?$/gm)].map(match => match[1]);
  return { file: relative(root, path), sourceLines, imports: imports.length };
});

const maximum = rows.reduce((current, row) => row.imports > current.imports ? row : current, rows[0]);
const total = key => rows.reduce((sum, row) => sum + row[key], 0);

console.log(`TypeScript files: ${rows.length}`);
console.log(`Source lines: ${total('sourceLines')}`);
console.log(`Import edges: ${total('imports')}`);
console.log(`Maximum outgoing imports: ${maximum.imports} (${maximum.file})`);
