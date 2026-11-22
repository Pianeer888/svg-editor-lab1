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
    this.add(this.shapes, provider.type, provider, 'shapes');
  }

  registerCommand(command: Command): void {
    this.add(this.commands, command.name, command, 'commands');
  }

  registerTreeDecorator(decorator: TreeDecorator): void {
    this.add(this.decorators, decorator.name, decorator, 'decorators');
  }

  registerAttributeHandler(handler: AttributeHandler): void {
    this.add(this.handlers, handler.name, handler, 'attributes');
  }

  contributions(): ExtensionContributions {
    return {
      shapes: [...this.shapes.values()], commands: [...this.commands.values()],
      treeDecorators: [...this.decorators.values()], attributeHandlers: [...this.handlers.values()],
    };
  }

  names(): Record<'shapes' | 'commands' | 'decorators' | 'attributes', readonly string[]> {
    return {
      shapes: [...this.shapes.keys()], commands: [...this.commands.keys()],
      decorators: [...this.decorators.keys()], attributes: [...this.handlers.keys()],
    };
  }

  private add<T>(entries: Map<string, T>, name: string, value: T, category: string): void {
    if (!name.trim()) throw new Error(`${category} name must not be empty`);
    if (entries.has(name)) throw new Error(`duplicate registration: ${category}/${name}`);
    entries.set(name, value);
  }
}
