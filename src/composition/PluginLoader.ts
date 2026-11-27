import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ExtensionRegistry } from '../extensions/ExtensionRegistry.js';
import {
  PLUGIN_API_VERSION, type Plugin, type PluginContributions, type PluginFactory, type PluginManifest,
} from '../extensions/Plugin.js';
import { StagedExtensions } from './StagedExtensions.js';

export type PluginLoadResult = {
  readonly source: string;
  readonly pluginId?: string;
  readonly status: 'loaded' | 'failed';
  readonly error?: string;
};

type PluginConfigEntry = {
  readonly module: string;
  readonly options?: unknown;
  readonly enabled?: boolean;
};

const contributionKinds = ['shapes', 'commands', 'decorators', 'attributes'] as const;
type ContributionKind = typeof contributionKinds[number];

export class PluginLoader {
  private readonly loadedIds = new Set<string>();

  constructor(private readonly extensions: ExtensionRegistry) {}

  loadCode(plugins: readonly Plugin[]): PluginLoadResult[] {
    return plugins.map((plugin, index) => this.loadOne(plugin, `code[${index}]`));
  }

  async loadConfig(path: string): Promise<PluginLoadResult[]> {
    let entries: PluginConfigEntry[];
    try {
      entries = this.configEntries(JSON.parse(await readFile(path, 'utf8')) as unknown);
    } catch {
      return [this.failed(path, 'invalid plugin config')];
    }

    const results: PluginLoadResult[] = [];
    for (const entry of entries) {
      if (entry.enabled === false) continue;
      results.push(await this.loadConfigured(entry, path));
    }
    return results;
  }

  private async loadConfigured(entry: PluginConfigEntry, configPath: string): Promise<PluginLoadResult> {
    let moduleUrl: string;
    try {
      moduleUrl = await this.resolveModule(entry.module, configPath);
    } catch {
      return this.failed(entry.module, `plugin not found: ${entry.module}`);
    }

    let loaded: unknown;
    try { loaded = await import(moduleUrl); }
    catch (error) {
      return this.failed(entry.module, `plugin failed to activate: ${entry.module} (${this.message(error)})`);
    }
    if (typeof loaded !== 'object' || loaded === null || !('default' in loaded)) {
      return this.failed(entry.module, `plugin has no default export: ${entry.module}`);
    }

    try {
      const exported = (loaded as { default: unknown }).default;
      const candidate = typeof exported === 'function'
        ? (exported as PluginFactory)(entry.options)
        : this.withoutOptions(exported, entry);
      const packageManifest = await this.readPackageManifest(moduleUrl);
      return this.loadOne(candidate, entry.module, packageManifest);
    } catch (error) {
      return this.failed(entry.module, `plugin failed to activate: ${entry.module} (${this.message(error)})`);
    }
  }

  private loadOne(candidate: unknown, source: string, packageManifest?: unknown): PluginLoadResult {
    let pluginId: string | undefined;
    try {
      const plugin = this.plugin(candidate);
      const manifest = this.manifest(plugin.manifest);
      pluginId = manifest.id;
      if (this.loadedIds.has(pluginId)) throw new Error(`duplicate registration: plugins/${pluginId}`);
      const declared = this.packageContributions(packageManifest, pluginId);

      const staged = new StagedExtensions();
      plugin.activate(staged);
      const actual = staged.names();
      if (declared) this.validateContributions(pluginId, declared, actual);
      this.validateContributions(pluginId, manifest.contributes, actual);
      this.extensions.commit(staged.contributions());
      this.loadedIds.add(pluginId);
      return { source, pluginId, status: 'loaded' };
    } catch (error) {
      const message = this.duplicateMessage(this.message(error));
      const formatted = message.startsWith('plugin manifest mismatch:') ||
        message.startsWith('plugin failed to activate:') || message.startsWith('duplicate registration:')
        ? message
        : `plugin failed to activate: ${pluginId ?? source} (${message})`;
      return this.failed(source, formatted, pluginId);
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
    pluginId: string,
    expected: PluginContributions,
    actual: Record<ContributionKind, readonly string[]>,
  ): void {
    for (const kind of contributionKinds) {
      const declared = [...(expected[kind] ?? [])].sort();
      const registered = [...actual[kind]].sort();
      if (declared.length !== registered.length || declared.some((name, index) => name !== registered[index])) {
        const declaredText = this.contributionSummary(expected);
        const registeredText = this.contributionSummary(actual);
        throw new Error(`plugin manifest mismatch: ${pluginId} (declared: ${declaredText}, registered: ${registeredText})`);
      }
    }
  }

  private packageContributions(value: unknown, pluginId: string): PluginContributions | undefined {
    if (value === undefined) return undefined;
    try {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid package manifest');
      const candidate = (value as { contributes?: unknown }).contributes;
      const contributes = candidate === undefined ? {} : candidate;
      this.expectedNames(contributes);
      return contributes;
    } catch (error) {
      throw new Error(`plugin manifest mismatch: ${pluginId} (declared: invalid package.json contributes (${this.message(error)}), registered: none)`);
    }
  }

  private expectedNames(value: unknown): asserts value is PluginContributions {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('plugin contributions required');
    const contributions = value as Record<string, unknown>;
    for (const key of Object.keys(contributions)) {
      if (!(contributionKinds as readonly string[]).includes(key)) throw new Error(`unknown contribution category: ${key}`);
    }
    for (const kind of contributionKinds) {
      const names = contributions[kind];
      if (names === undefined) continue;
      if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !name.trim())) {
        throw new Error(`invalid ${kind} manifest`);
      }
      if (new Set(names).size !== names.length) throw new Error(`duplicate ${kind} manifest entry`);
    }
  }

  private configEntries(value: unknown): PluginConfigEntry[] {
    if (typeof value !== 'object' || value === null || !Array.isArray((value as { plugins?: unknown }).plugins)) {
      throw new Error('invalid config');
    }
    return (value as { plugins: unknown[] }).plugins.map(raw => {
      if (typeof raw !== 'object' || raw === null) throw new Error('invalid entry');
      const entry = raw as Partial<PluginConfigEntry>;
      if (typeof entry.module !== 'string' || !entry.module.trim()) throw new Error('invalid module');
      if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') throw new Error('invalid enabled');
      return { module: entry.module, ...(entry.options === undefined ? {} : { options: entry.options }),
        ...(entry.enabled === undefined ? {} : { enabled: entry.enabled }) };
    });
  }

  private async resolveModule(specifier: string, configPath: string): Promise<string> {
    const requireFromConfig = createRequire(pathToFileURL(resolve(configPath)));
    return pathToFileURL(requireFromConfig.resolve(specifier)).href;
  }

  private async readPackageManifest(moduleUrl: string): Promise<unknown> {
    let directory = dirname(fileURLToPath(moduleUrl));
    for (;;) {
      try { return JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as unknown; }
      catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      const parent = dirname(directory);
      if (parent === directory) return undefined;
      directory = parent;
    }
  }

  private withoutOptions(exported: unknown, entry: PluginConfigEntry): unknown {
    if (entry.options !== undefined) throw new Error('plugin options require a default factory');
    return exported;
  }

  private contributionSummary(contributions: PluginContributions | Record<ContributionKind, readonly string[]>): string {
    return contributionKinds.map(kind => `${kind}=[${(contributions[kind] ?? []).join(', ')}]`).join('; ');
  }

  private message(error: unknown): string { return error instanceof Error ? error.message : String(error); }

  private duplicateMessage(message: string): string {
    const match = /^(shape provider|command|tree decorator|attribute handler) already registered: (.+)$/.exec(message);
    if (!match) return message;
    const categories: Record<string, string> = {
      'shape provider': 'shapes', command: 'commands', 'tree decorator': 'decorators', 'attribute handler': 'attributes',
    };
    return `duplicate registration: ${categories[match[1]!]}/${match[2]}`;
  }

  private failed(source: string, error: string, pluginId?: string): PluginLoadResult {
    return { source, ...(pluginId === undefined ? {} : { pluginId }), status: 'failed', error };
  }
}
