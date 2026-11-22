import type { AttributeHandler } from '../extensions/AttributeHandler.js';
import type { Command } from '../extensions/Command.js';
import type { ExtensionContributions, ExtensionRegistrar } from '../extensions/Plugin.js';
import type { ShapeProvider } from '../extensions/ShapeProvider.js';
import type { TreeDecorator } from '../extensions/TreeDecorator.js';

export class StagedExtensions implements ExtensionRegistrar {
  private readonly shapes = new Map<string, ShapeProvider>();
  private readonly commands = new Map<string, Command>();
  private readonly decorators = new Map<string, TreeDecorator>();
  private readonly handlers = new Map<string, AttributeHandler>();

  registerShape(provider: ShapeProvider): void {
    this.add(this.shapes, provider.type, provider, 'shape provider');
  }

  registerCommand(command: Command): void {
    this.add(this.commands, command.name, command, 'command');
  }

  registerTreeDecorator(decorator: TreeDecorator): void {
    this.add(this.decorators, decorator.name, decorator, 'tree decorator');
  }

  registerAttributeHandler(handler: AttributeHandler): void {
    this.add(this.handlers, handler.name, handler, 'attribute handler');
  }

  contributions(): ExtensionContributions {
    return {
      shapes: [...this.shapes.values()], commands: [...this.commands.values()],
      treeDecorators: [...this.decorators.values()], attributeHandlers: [...this.handlers.values()],
    };
  }

  names(): Record<keyof ExtensionContributions, readonly string[]> {
    return {
      shapes: [...this.shapes.keys()], commands: [...this.commands.keys()],
      treeDecorators: [...this.decorators.keys()], attributeHandlers: [...this.handlers.keys()],
    };
  }

  private add<T>(entries: Map<string, T>, name: string, value: T, kind: string): void {
    if (!name.trim()) throw new Error(`${kind} name must not be empty`);
    if (entries.has(name)) throw new Error(`${kind} registered twice by plugin: ${name}`);
    entries.set(name, value);
  }
}
