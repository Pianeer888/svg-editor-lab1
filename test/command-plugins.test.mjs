import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import { Cli } from '../dist/cli/Cli.js';
import { PluginLoader } from '../dist/composition/PluginLoader.js';
import { createDefaultExtensions } from '../dist/extensions/DefaultExtensions.js';
import { SvgFileStore } from '../dist/infrastructure/SvgFileStore.js';
import { StatsPlugin } from '../dist/plugins/stats/StatsPlugin.js';
import { DirPlugin } from '../dist/plugins/dir/DirPlugin.js';
import { DirCommand } from '../dist/plugins/dir/DirCommand.js';
import { NodeDirectoryAdapter } from '../dist/plugins/dir/NodeDirectoryAdapter.js';

async function run(lines, plugins) {
  const extensions = createDefaultExtensions();
  let output = '';
  const sink = new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } });
  const cli = new Cli(Readable.from([lines.join('\n') + '\n']), sink, new SvgFileStore(extensions), extensions);
  const results = new PluginLoader(extensions).loadCode(plugins);
  assert.ok(results.every(result => result.status === 'loaded'));
  await cli.run();
  return output;
}

function commandOutput(command) {
  let output = '';
  const context = { write(value) { output += value; } };
  command.execute(context, []);
  return output;
}

test('stats counts leaves by first appearance and containers separately', async () => {
  const output = await run([
    'init', 'create g outer', 'create rect r1 0 0 1 1 in outer',
    'create circle c1 1 1 1 in outer', 'create g inner in outer',
    'create text t1 0 0 label in inner', 'create rect r2 2 2 1 1',
    'stats', 'undo', 'tree', 'help',
  ], [new StatsPlugin()]);
  assert.match(output, /rect: 2  circle: 1  text: 1  \(total 4, containers 2\)/);
  assert.match(output, /undid: rect#r2 created/);
  assert.match(output, /\nstats\n/);
});

test('stats reports an empty document and is absent when its plugin is disabled', async () => {
  const enabled = await run(['init', 'stats'], [new StatsPlugin()]);
  assert.match(enabled, /\(total 0, containers 0\)/);
  const disabled = await run(['init', 'stats'], []);
  assert.match(disabled, /error: unknown command: stats/);
});

test('plugin package manifests match their runtime contribution manifests', () => {
  const cases = [
    ['../src/plugins/stats/package.json', new StatsPlugin().manifest],
    ['../src/plugins/dir/package.json', new DirPlugin({ currentDirectory: () => '.', read: () => [] }).manifest],
  ];
  for (const [path, manifest] of cases) {
    const metadata = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
    assert.deepEqual(metadata.contributes, manifest.contributes);
  }
});

test('dir command uses its directory port for stable mixed-entry output', () => {
  const directories = {
    currentDirectory: () => '/fixed',
    read: () => [
      { name: 'z-dir', kind: 'directory' }, { name: 'b.txt', kind: 'file' },
      { name: '.cache', kind: 'directory' }, { name: '.env', kind: 'file' },
      { name: 'shortcut', kind: 'other' },
    ],
  };
  assert.equal(commandOutput(new DirCommand(directories)),
    '[DIR]  .cache\n[DIR]  z-dir\n[FILE]  .env\n[FILE]  b.txt\n[OTHER]  shortcut\n');
});

test('dir command handles an empty directory and normalizes read failures', () => {
  const empty = { currentDirectory: () => '/empty', read: () => [] };
  assert.equal(commandOutput(new DirCommand(empty)), '(empty directory)\n');
  const failed = { currentDirectory: () => '/blocked', read: () => { throw new Error('denied'); } };
  assert.throws(() => commandOutput(new DirCommand(failed)), /cannot read directory: \/blocked/);
  assert.throws(() => new DirCommand(empty).execute({ write() {} }, ['extra']), /usage: dir/);
});

test('dir works before init and does not alter undo history after success or failure', async () => {
  const available = { currentDirectory: () => '/fixed', read: () => [{ name: 'a.svg', kind: 'file' }] };
  const success = await run(['dir', 'init', 'create rect r 0 0 1 1', 'dir', 'undo', 'tree'],
    [new DirPlugin(available)]);
  assert.equal((success.match(/\[FILE\]  a\.svg/g) ?? []).length, 2);
  assert.match(success, /undid: rect#r created/);
  assert.ok(success.endsWith('svg (800x600)\n'));

  const unavailable = { currentDirectory: () => '/blocked', read: () => { throw new Error('denied'); } };
  const failure = await run(['init', 'create rect r 0 0 1 1', 'dir', 'undo', 'tree'],
    [new DirPlugin(unavailable)]);
  assert.match(failure, /error: cannot read directory: \/blocked/);
  assert.match(failure, /undid: rect#r created/);
});

test('NodeDirectoryAdapter reads real files, directories, and hidden entries', t => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-dir-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, 'z-dir'));
  mkdirSync(join(directory, '.hidden-dir'));
  writeFileSync(join(directory, 'b.svg'), '');
  writeFileSync(join(directory, '.env'), '');
  const output = commandOutput(new DirCommand(new NodeDirectoryAdapter(() => directory)));
  assert.equal(output,
    '[DIR]  .hidden-dir\n[DIR]  z-dir\n[FILE]  .env\n[FILE]  b.svg\n');
});

test('code and configuration composition produce byte-identical dir output', t => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-compose-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const working = join(directory, 'working');
  mkdirSync(working);
  mkdirSync(join(working, 'docs'));
  mkdirSync(join(working, 'plugins'));
  writeFileSync(join(working, 'demo.svg'), '');
  writeFileSync(join(working, 'package.json'), '{}');

  const main = resolve('dist/main.js');
  const config = join(directory, 'plugins.config.json');
  writeFileSync(config, JSON.stringify({ plugins: [
    { module: resolve('dist/plugins/stats/index.js') },
    { module: resolve('dist/plugins/dir/index.js') },
  ] }));
  const options = { cwd: working, input: 'init\nstats\ndir\n', encoding: 'utf8' };
  const code = spawnSync(process.execPath, [main], options);
  const configured = spawnSync(process.execPath, [main, '--config', config], options);
  assert.equal(code.status, 0, code.stderr);
  assert.equal(configured.status, 0, configured.stderr);
  assert.equal(code.stderr, '');
  assert.equal(configured.stderr, '');
  assert.equal(configured.stdout, code.stdout);
  assert.match(code.stdout, /\(total 0, containers 0\)/);
  assert.match(code.stdout, /\[DIR\]  docs[\s\S]*\[DIR\]  plugins[\s\S]*\[FILE\]  demo\.svg[\s\S]*\[FILE\]  package\.json/);
});

test('stats and dir transcript matches the recorded output byte for byte', () => {
  const main = resolve('dist/main.js');
  const input = readFileSync(resolve('doc/transcript/cli-plugins.txt'), 'utf8');
  const expected = readFileSync(resolve('doc/transcript/cli-plugins.expected.out'), 'utf8');
  const result = spawnSync(process.execPath, [main], {
    cwd: resolve('test/fixtures/dir'), input, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const output = result.stdout.endsWith('svg> ') ? result.stdout.slice(0, -1) : result.stdout;
  assert.equal(`${output}\n`, expected);
});
