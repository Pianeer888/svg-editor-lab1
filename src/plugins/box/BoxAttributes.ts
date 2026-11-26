import type { AttributeHandler } from '../../extensions/AttributeHandler.js';
import type { Shape } from '../../model/Shape.js';
import { Box } from './Box.js';

export class BoxAttributes implements AttributeHandler {
  readonly name = 'box-attributes';

  supports(shape: Shape, attribute: string): boolean {
    return shape instanceof Box && (attribute === 'fill' || attribute === 'label');
  }

  set(shape: Shape, attribute: string, value: string): void {
    if (shape instanceof Box) {
      if (attribute === 'fill') { shape.setFrameFill(value); return; }
      if (attribute === 'label') { shape.setLabel(value); return; }
    }
    throw new Error(`unsupported box attribute: ${attribute}`);
  }
}
