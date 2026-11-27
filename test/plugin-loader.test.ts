import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultExtensions } from '../dist/extensions/DefaultExtensions.js';
import { PluginLoader } from '../dist/composition/PluginLoader.js';
import type { Command } from '../dist/extensions/Command.js';
import type { Plugin, PluginContributions } from '../dist/extensions/Plugin.js';
import type { ShapeProvider } from '../dist/extensions/ShapeProvider.js';

function command(name: string): Command {
  return { name, usage: name, help: name, execute() {} };
}

function plugin(id: string, contributes: PluginContributions, activate: Plugin['activate']): Plugin {
  return { manifest: { id, apiVersion: 1, contributes }, activate };
}

test('code composition commits valid plugins in order', () => {
  const extensions = createDefaultExtensions();
  const loader = new PluginLoader(extensions);
  const results = loader.loadCode([
    plugin('sample.first', { commands: ['first'] }, registrar => registrar.registerCommand(command('first'))),
    plugin('sample.second', { commands: ['second'] }, registrar => registrar.registerCommand(command('second'))),
  ]);
  assert.deepEqual(results.map(result => [result.pluginId, result.status]), [
    ['sample.first', 'loaded'], ['sample.second', 'loaded'],
  ]);
  assert.deepEqual(extensions.commands().map(entry => entry.name), ['first', 'second']);
});

test('activation failure rolls back staged registrations and loading continues', () => {
  const extensions = createDefaultExtensions();
  const loader = new PluginLoader(extensions);
  const results = loader.loadCode([
    plugin('sample.broken', { commands: ['temporary'] }, registrar => {
      registrar.registerCommand(command('temporary'));
      throw new Error('activation stopped');
    }),
    plugin('sample.after', { commands: ['after'] }, registrar => registrar.registerCommand(command('after'))),
  ]);
  assert.deepEqual(results.map(result => result.status), ['failed', 'loaded']);
  assert.match(results[0].error ?? '', /activation stopped/);
  assert.equal(extensions.command('temporary'), undefined);
  assert.ok(extensions.command('after'));
});

test('manifest mismatch rejects all staged contributions', () => {
  const extensions = createDefaultExtensions();
  const loader = new PluginLoader(extensions);
  const [result] = loader.loadCode([
    plugin('sample.mismatch', { commands: ['declared'] }, registrar => {
      registrar.registerCommand(command('registered'));
    }),
  ]);
  assert.equal(result.status, 'failed');
  assert.match(result.error ?? '', /manifest mismatch/);
  assert.equal(extensions.command('declared'), undefined);
  assert.equal(extensions.command('registered'), undefined);
});

test('registry collision makes the whole plugin commit atomic', () => {
  const extensions = createDefaultExtensions();
  const loader = new PluginLoader(extensions);
  const ghostProvider: ShapeProvider = {
    type: 'ghost', create() { throw new Error('unused'); }, matchSvg() { return false; },
    fromSvg() { throw new Error('unused'); }, supports() { return false; }, toSvg() { throw new Error('unused'); },
  };
  const results = loader.loadCode([
    plugin('sample.owner', { commands: ['same'] }, registrar => registrar.registerCommand(command('same'))),
    plugin('sample.collision', { shapes: ['ghost'], commands: ['same'] }, registrar => {
      registrar.registerShape(ghostProvider);
      registrar.registerCommand(command('same'));
    }),
  ]);
  assert.deepEqual(results.map(result => result.status), ['loaded', 'failed']);
  assert.match(results[1].error ?? '', /duplicate registration: commands\/same/);
  assert.throws(() => extensions.createShape('ghost', 'x', []), /unknown shape type/);
});

test('duplicates inside activation use the registration error and publish nothing', () => {
  const extensions = createDefaultExtensions();
  const results = new PluginLoader(extensions).loadCode([
    plugin('sample.duplicate', { commands: ['same'] }, registrar => {
      registrar.registerCommand(command('same'));
      registrar.registerCommand(command('same'));
    }),
    plugin('sample.after', { commands: ['same'] }, registrar => registrar.registerCommand(command('same'))),
  ]);
  assert.equal(results[0].error, 'duplicate registration: commands/same');
  assert.equal(results[1].status, 'loaded');
  assert.deepEqual(extensions.commands().map(entry => entry.name), ['same']);
});

test('invalid manifest and duplicate plugin id fail without replacing the loaded plugin', () => {
  const extensions = createDefaultExtensions();
  const loader = new PluginLoader(extensions);
  const results = loader.loadCode([
    { manifest: { id: 'Bad Id', apiVersion: 1, contributes: {} }, activate() {} },
    // @ts-expect-error Exercise runtime rejection of an unsupported API version.
    { manifest: { id: 'sample.old', apiVersion: 0, contributes: {} }, activate() {} },
    plugin('sample.unique', { commands: ['original'] }, registrar => registrar.registerCommand(command('original'))),
    plugin('sample.unique', { commands: ['replacement'] }, registrar => registrar.registerCommand(command('replacement'))),
  ]);
  assert.deepEqual(results.map(result => result.status), ['failed', 'failed', 'loaded', 'failed']);
  assert.match(results[0].error ?? '', /invalid plugin id/);
  assert.match(results[1].error ?? '', /unsupported plugin API version/);
  assert.match(results[3].error ?? '', /duplicate registration: plugins\/sample.unique/);
  assert.ok(extensions.command('original'));
  assert.equal(extensions.command('replacement'), undefined);
});

test('configuration composition reports import failure and loads later modules', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-plugins-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const configPath = join(directory, 'plugins.json');
  writeFileSync(configPath, JSON.stringify({
    plugins: [
      { module: './disabled.mjs', enabled: false },
      { module: './missing.mjs' },
      { module: './no-default.mjs' },
      { module: './missing-dependency.mjs' },
      { module: './configured.mjs', options: { command: 'configured' } },
    ],
  }));
  writeFileSync(join(directory, 'no-default.mjs'), 'export const value = 1;');
  writeFileSync(join(directory, 'missing-dependency.mjs'), "import './absent-dependency.mjs'; export default {};");
  writeFileSync(join(directory, 'configured.mjs'), `
    export default options => ({
      manifest: { id: 'sample.configured', apiVersion: 1, contributes: { commands: [options.command] } },
      activate(registrar) {
        registrar.registerCommand({ name: options.command, usage: options.command, help: options.command, execute() {} });
      }
    });
  `);
  const extensions = createDefaultExtensions();
  const results = await new PluginLoader(extensions).loadConfig(configPath);
  assert.deepEqual(results.map(result => result.status), ['failed', 'failed', 'failed', 'loaded']);
  assert.equal(results[0].error, 'plugin not found: ./missing.mjs');
  assert.equal(results[1].error, 'plugin has no default export: ./no-default.mjs');
  assert.match(results[2].error ?? '', /^plugin failed to activate: \.\/missing-dependency\.mjs .*absent-dependency\.mjs/);
  assert.ok(extensions.command('configured'));
});

test('invalid configuration returns a failure without changing the registry', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-plugins-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const configPath = join(directory, 'plugins.json');
  writeFileSync(configPath, '{"plugins":"not-an-array"}');
  const extensions = createDefaultExtensions();
  const results = await new PluginLoader(extensions).loadConfig(configPath);
  assert.equal(results.length, 1);
  assert.equal(results[0].status, 'failed');
  assert.equal(results[0].error, 'invalid plugin config');
  assert.deepEqual(extensions.commands(), []);
});

test('configured package declarations are checked before staged contributions take effect', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'svg-manifest-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const config = join(directory, 'plugins.json');
  const modules = ['./wrong/index.mjs', './right/index.mjs'];
  writeFileSync(config, JSON.stringify({ plugins: modules.map(module => ({ module })) }));
  for (const [folder, declares] of [['wrong', 'declared'], ['right', 'actual']]) {
    const packageDir = join(directory, folder);
    mkdirSync(packageDir);
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({
      name: folder, contributes: { commands: [declares] },
    }));
    writeFileSync(join(packageDir, 'index.mjs'), `
      export default {
        manifest: { id: '${folder}', apiVersion: 1, contributes: { commands: ['actual'] } },
        activate(registrar) {
          registrar.registerCommand({ name: 'actual', usage: 'actual', help: 'actual', execute() {} });
        },
      };
    `);
  }
  const extensions = createDefaultExtensions();
  const results = await new PluginLoader(extensions).loadConfig(config);
  assert.deepEqual(results.map(result => result.status), ['failed', 'loaded']);
  assert.match(results[0].error ?? '', /^plugin manifest mismatch: wrong /);
  assert.deepEqual(extensions.commands().map(entry => entry.name), ['actual']);
});
