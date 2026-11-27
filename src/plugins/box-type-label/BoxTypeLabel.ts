import type { TreeDecorator } from '../../extensions/TreeDecorator.js';
import type { Shape } from '../../model/Shape.js';

export class BoxTypeLabel implements TreeDecorator {
  readonly name = 'box-type-label';

  decorate(shape: Shape): string {
    return shape.type === 'box' ? '(box)' : '';
  }
}
