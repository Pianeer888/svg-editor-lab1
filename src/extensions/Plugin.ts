import type { AttributeHandler } from './AttributeHandler.js';
import type { Command } from './Command.js';
import type { ShapeProvider } from './ShapeProvider.js';
import type { TreeDecorator } from './TreeDecorator.js';

export const PLUGIN_API_VERSION = 1 as const;

export type PluginContributions = {
  readonly shapes?: readonly string[];
  readonly commands?: readonly string[];
  readonly decorators?: readonly string[];
  readonly attributes?: readonly string[];
};

export type ExtensionContributions = {
  readonly shapes: readonly ShapeProvider[];
  readonly commands: readonly Command[];
  readonly treeDecorators: readonly TreeDecorator[];
  readonly attributeHandlers: readonly AttributeHandler[];
};

export type PluginManifest = {
  readonly id: string;
  readonly apiVersion: typeof PLUGIN_API_VERSION;
  readonly contributes: PluginContributions;
};

export interface ExtensionRegistrar {
  registerShape(provider: ShapeProvider): void;
  registerCommand(command: Command): void;
  registerTreeDecorator(decorator: TreeDecorator): void;
  registerAttributeHandler(handler: AttributeHandler): void;
}

export interface Plugin {
  readonly manifest: PluginManifest;
  activate(registrar: ExtensionRegistrar): void;
}

export type PluginFactory = (options: unknown) => Plugin;
