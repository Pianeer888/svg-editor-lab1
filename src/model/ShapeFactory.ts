import type { Shape } from './Shape.js';
import type { ExtensionRegistry } from '../extensions/ExtensionRegistry.js';
import { createDefaultExtensions } from '../extensions/DefaultExtensions.js';
import type { SvgShapeInput } from '../extensions/ShapeProvider.js';

export class ShapeFactory {
  constructor(private readonly extensions: ExtensionRegistry = createDefaultExtensions()) {}

  fromSvg(input: SvgShapeInput): Shape {
    return this.extensions.readShape(input);
  }

  create(type: string, id: string, args: readonly string[]): Shape {
    return this.extensions.createShape(type, id, args);
  }
}
