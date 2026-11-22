import type { AttributeHandler } from './AttributeHandler.js';
import type { Command } from './Command.js';
import type { ShapeProvider, SvgShapeInput } from './ShapeProvider.js';
import type { TreeDecorator } from './TreeDecorator.js';
import type { Shape } from '../model/Shape.js';

export class ExtensionRegistry {
  private readonly commandEntries = new Map<string, Command>();
  private readonly shapeEntries = new Map<string, ShapeProvider>();
  private readonly decoratorEntries: TreeDecorator[] = [];
  private readonly attributeEntries: AttributeHandler[] = [];

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

  registerTreeDecorator(decorator: TreeDecorator): void { this.decoratorEntries.push(decorator); }
  treeDecorators(): readonly TreeDecorator[] { return [...this.decoratorEntries]; }

  registerAttributeHandler(handler: AttributeHandler): void { this.attributeEntries.push(handler); }
  attributeHandlers(shape: Shape, attribute: string): readonly AttributeHandler[] {
    return this.attributeEntries.filter(handler => handler.supports(shape, attribute));
  }
}
