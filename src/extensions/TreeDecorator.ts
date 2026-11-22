import type { Shape } from '../model/Shape.js';
import type { SvgDocument } from '../model/SvgDocument.js';

export interface TreeDecorator {
  decorate(shape: Shape, document: SvgDocument): string;
}
