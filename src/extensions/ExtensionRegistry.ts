import type { AttributeHandler } from './AttributeHandler.js';
import type { Command } from './Command.js';
import type { ShapeProvider, SvgShapeInput } from './ShapeProvider.js';
import type { TreeDecorator } from './TreeDecorator.js';
import type { Shape } from '../model/Shape.js';
import type { ExtensionContributions } from './Plugin.js';

export class ExtensionRegistry {
  private readonly commandEntries = new Map<string, Command>();
  private readonly shapeEntries = new Map<string, ShapeProvider>();
  private readonly decoratorEntries = new Map<string, TreeDecorator>();
  private readonly attributeEntries = new Map<string, AttributeHandler>();

  registerCommand(command: Command): void {
    if (this.commandEntries.has(command.name)) throw new Error(`command already registered: ${command.name}`);
    this.commandEntries.set(command.name, command);
  }

  command(name: string): Command | undefined { return this.commandEntries.get(name); }
  commands(): readonly Command[] { return [...this.commandEntries.values()]; }

  registerShape(provider: ShapeProvider): void {
    if (this.shapeEntries.has(provider.type)) throw new Error(`shape provider already registered: ${provider.type}`);
    this.shapeEntries.set(provider.type, provider);
  }

  createShape(type: string, id: string, args: readonly string[]): Shape {
    const provider = this.shapeEntries.get(type);
    if (!provider) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return provider.create(id, args);
  }

  readShape(input: SvgShapeInput): Shape {
    const exact = [...this.shapeEntries.values()].filter(provider => provider.matchSvg(input) === 'exact');
    const fallback = [...this.shapeEntries.values()].filter(provider => provider.matchSvg(input) === 'fallback');
    const matches = exact.length > 0 ? exact : fallback;
    if (matches.length === 0) throw new Error(`unsupported SVG element: ${input.element}`);
    if (matches.length > 1) throw new Error(`conflicting shape providers for SVG element: ${input.element}`);
    const children = input.children.map(child => this.readShape(child));
    const shape = matches[0]!.fromSvg(input, children);
    if (shape.id !== input.id) throw new Error(`shape provider returned wrong id: ${shape.id}`);
    return shape;
  }

  writeShape(shape: Shape) {
    const matches = [...this.shapeEntries.values()].filter(provider => provider.supports(shape));
    if (matches.length === 0) throw new Error(`no shape provider for: ${shape.type}`);
    if (matches.length > 1) throw new Error(`conflicting shape providers for: ${shape.type}`);
    return matches[0]!.toSvg(shape);
  }

  registerTreeDecorator(decorator: TreeDecorator): void {
    if (this.decoratorEntries.has(decorator.name)) throw new Error(`tree decorator already registered: ${decorator.name}`);
    this.decoratorEntries.set(decorator.name, decorator);
  }
  treeDecorators(): readonly TreeDecorator[] { return [...this.decoratorEntries.values()]; }

  registerAttributeHandler(handler: AttributeHandler): void {
    if (this.attributeEntries.has(handler.name)) throw new Error(`attribute handler already registered: ${handler.name}`);
    this.attributeEntries.set(handler.name, handler);
  }
  attributeHandlers(shape: Shape, attribute: string): readonly AttributeHandler[] {
    return [...this.attributeEntries.values()].filter(handler => handler.supports(shape, attribute));
  }

  commit(contributions: ExtensionContributions): void {
    this.checkNames(this.shapeEntries, contributions.shapes.map(provider => provider.type), 'shape provider');
    this.checkNames(this.commandEntries, contributions.commands.map(command => command.name), 'command');
    this.checkNames(this.decoratorEntries, contributions.treeDecorators.map(decorator => decorator.name), 'tree decorator');
    this.checkNames(this.attributeEntries, contributions.attributeHandlers.map(handler => handler.name), 'attribute handler');
    for (const provider of contributions.shapes) this.shapeEntries.set(provider.type, provider);
    for (const command of contributions.commands) this.commandEntries.set(command.name, command);
    for (const decorator of contributions.treeDecorators) this.decoratorEntries.set(decorator.name, decorator);
    for (const handler of contributions.attributeHandlers) this.attributeEntries.set(handler.name, handler);
  }

  private checkNames<T>(current: ReadonlyMap<string, T>, incoming: readonly string[], kind: string): void {
    const names = new Set(current.keys());
    for (const name of incoming) {
      if (names.has(name)) throw new Error(`${kind} already registered: ${name}`);
      names.add(name);
    }
  }
}
