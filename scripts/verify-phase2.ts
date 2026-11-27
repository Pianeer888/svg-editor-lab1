import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const transcripts = join(root, 'doc', 'transcript');
const expected = join(transcripts, 'phase2.expected.json');
const temporary = mkdtempSync(join(tmpdir(), 'svg-phase2-'));
const main = join(root, 'dist', 'main.js');
const config = join(root, 'plugins.config.json');
const emptyConfig = join(temporary, 'empty.json');
const expectedOutputs: Record<string, { stdout: string; svg?: string }> = {};

function compare(name: string, left: string[], right: string[], generated?: string) {
  const cwd = mkdtempSync(join(temporary, 'session-'));
  if (name === 'cli-plugins') cpSync(join(root, 'test', 'fixtures', 'dir'), cwd, { recursive: true });
  if (name === 'cli-1') copyFileSync(join(transcripts, 'other.svg'), join(cwd, 'other.svg'));
  const input = readFileSync(join(transcripts, `${name}.txt`));
  function run(args: string[]): { stdout: Buffer; svg?: Buffer } {
    const result = spawnSync(process.execPath, args, { cwd, input });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr.toString());
    assert.equal(result.stderr.toString(), '');
    const stdout = result.stdout;
    if (!generated) return { stdout };
    const svgPath = join(cwd, generated);
    const svg = readFileSync(svgPath);
    unlinkSync(svgPath);
    return { stdout, svg };
  }

  const actual = run(left);
  assert.deepEqual(run(right), actual, `${name}: stdout or saved SVG differs`);
  console.log(`${name}: byte-identical ${generated ? '(stdout and SVG)' : '(stdout)'}`);
  return { stdout: actual.stdout.toString('utf8'), ...(actual.svg ? { svg: actual.svg.toString('utf8') } : {}) };
}

try {
  const disabled = [main, '--config', emptyConfig];
  writeFileSync(emptyConfig, '{"plugins":[]}');
  const original = join(temporary, 'phase1');
  mkdirSync(original);
  const archive = execFileSync('git', ['archive', 'final'], { cwd: root });
  execFileSync('tar', ['-xf', '-'], { cwd: original, input: archive, env: { ...process.env, LC_ALL: 'C' } });
  symlinkSync(join(root, 'node_modules'), join(original, 'node_modules'), 'junction');
  execFileSync(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'],
    { cwd: original, stdio: 'inherit' });

  const code = [main];
  const configured = [main, '--config', config];
  expectedOutputs.base = compare('cli-1', code, configured, 'demo.svg');
  expectedOutputs.box = compare('cli-box', code, configured, 'flowchart-box.svg');
  expectedOutputs.commands = compare('cli-plugins', code, configured);
  expectedOutputs.compatibility = compare('cli-1', [join(original, 'dist', 'main.js')], disabled, 'demo.svg');
  if (process.argv.includes('--record')) {
    writeFileSync(expected, JSON.stringify(expectedOutputs, null, 2) + '\n');
  } else {
    assert.deepEqual(expectedOutputs, JSON.parse(readFileSync(expected, 'utf8')));
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
