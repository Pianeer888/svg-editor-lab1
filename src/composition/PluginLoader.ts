import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ExtensionRegistry } from '../extensions/ExtensionRegistry.js';
import { PLUGIN_API_VERSION, type Plugin, type PluginContributions, type PluginManifest } from '../extensions/Plugin.js';
import { StagedExtensions } from './StagedExtensions.js';

export type PluginLoadResult = {
  readonly source: string;
  readonly pluginId?: string;
  readonly status: 'loaded' | 'failed';
  readonly error?: string;
};

export class PluginLoader {
  private readonly loadedIds = new Set<string>();

  constructor(private readonly extensions: ExtensionRegistry) {}

  loadCode(plugins: readonly Plugin[]): PluginLoadResult[] {
    return plugins.map((plugin, index) => this.loadOne(plugin, `code[${index}]`));
  }

  async loadConfig(path: string): Promise<PluginLoadResult[]> {
    let entries: string[];
    try {
      const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
      entries = this.configEntries(parsed);
    } catch (error) {
      return [this.failed(path, error)];
    }

    const results: PluginLoadResult[] = [];
    for (const entry of entries) {
      const modulePath = resolve(dirname(path), entry);
      try {
        const loaded: unknown = await import(pathToFileURL(modulePath).href);
        const plugin = this.modulePlugin(loaded);
        results.push(this.loadOne(plugin, entry));
      } catch (error) {
        results.push(this.failed(entry, error));
      }
    }
    return results;
  }

  private loadOne(candidate: unknown, source: string): PluginLoadResult {
    let pluginId: string | undefined;
    try {
      const plugin = this.plugin(candidate);
      const manifest = this.manifest(plugin.manifest);
      pluginId = manifest.id;
      if (this.loadedIds.has(pluginId)) throw new Error(`plugin already loaded: ${pluginId}`);

      const staged = new StagedExtensions();
      plugin.activate(staged);
      this.validateContributions(manifest.contributes, staged.names());
      this.extensions.commit(staged.contributions());
      this.loadedIds.add(pluginId);
      return { source, pluginId, status: 'loaded' };
    } catch (error) {
      return this.failed(source, error, pluginId);
    }
  }

  private plugin(value: unknown): Plugin {
    if (typeof value !== 'object' || value === null) throw new Error('plugin must be an object');
    const candidate = value as Partial<Plugin>;
    if (typeof candidate.activate !== 'function') throw new Error('plugin activate function required');
    return candidate as Plugin;
  }

  private manifest(value: unknown): PluginManifest {
    if (typeof value !== 'object' || value === null) throw new Error('plugin manifest required');
    const manifest = value as Partial<PluginManifest>;
    if (typeof manifest.id !== 'string' || !/^[a-z][a-z0-9.-]*$/.test(manifest.id)) {
      throw new Error('invalid plugin id');
    }
    if (manifest.apiVersion !== PLUGIN_API_VERSION) {
      throw new Error(`unsupported plugin API version: ${String(manifest.apiVersion)}`);
    }
    this.expectedNames(manifest.contributes);
    return manifest as PluginManifest;
  }

  private validateContributions(
    expected: PluginContributions,
    actual: Record<'shapes' | 'commands' | 'treeDecorators' | 'attributeHandlers', readonly string[]>,
  ): void {
    for (const kind of ['shapes', 'commands', 'treeDecorators', 'attributeHandlers'] as const) {
      const declared = [...(expected[kind] ?? [])].sort();
      const registered = [...actual[kind]].sort();
      if (declared.length !== registered.length || declared.some((name, index) => name !== registered[index])) {
        throw new Error(`${kind} manifest mismatch: declared [${declared.join(', ')}], registered [${registered.join(', ')}]`);
      }
    }
  }

  private expectedNames(value: unknown): void {
    if (typeof value !== 'object' || value === null) throw new Error('plugin contributions required');
    const contributions = value as Record<string, unknown>;
    const kinds = ['shapes', 'commands', 'treeDecorators', 'attributeHandlers'];
    for (const key of Object.keys(contributions)) {
      if (!kinds.includes(key)) throw new Error(`unknown contribution category: ${key}`);
    }
    for (const kind of kinds) {
      const names = contributions[kind];
      if (names === undefined) continue;
      if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !name.trim())) {
        throw new Error(`invalid ${kind} manifest`);
      }
      if (new Set(names).size !== names.length) throw new Error(`duplicate ${kind} manifest entry`);
    }
  }

  private configEntries(value: unknown): string[] {
    if (typeof value !== 'object' || value === null || !Array.isArray((value as { plugins?: unknown }).plugins)) {
      throw new Error('config must contain a plugins array');
    }
    const entries = (value as { plugins: unknown[] }).plugins;
    if (entries.some(entry => typeof entry !== 'string' || !entry.trim())) {
      throw new Error('plugin paths must be non-empty strings');
    }
    return entries as string[];
  }

  private modulePlugin(value: unknown): unknown {
    if (typeof value !== 'object' || value === null || !('default' in value)) {
      throw new Error('plugin module must have a default export');
    }
    return (value as { default: unknown }).default;
  }

  private failed(source: string, error: unknown, pluginId?: string): PluginLoadResult {
    return {
      source, ...(pluginId === undefined ? {} : { pluginId }), status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
