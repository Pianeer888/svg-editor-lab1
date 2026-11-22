import type { Shape } from '../model/Shape.js';
import type { SvgDocument } from '../model/SvgDocument.js';

export interface TreeDecorator {
  readonly name: string;
  decorate(shape: Shape, document: SvgDocument): string;
}
