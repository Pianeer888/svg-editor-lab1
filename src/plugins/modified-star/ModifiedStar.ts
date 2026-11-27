import type { TreeDecorator } from '../../extensions/TreeDecorator.js';
import type { Shape } from '../../model/Shape.js';
import type { SvgDocument } from '../../model/SvgDocument.js';

export class ModifiedStar implements TreeDecorator {
  readonly name = 'modified-star';
  private readonly baselines = new WeakMap<SvgDocument, ReadonlyMap<string, string>>();

  markClean(document: SvgDocument): void {
    const snapshot = new Map<string, string>();
    for (const shape of document.walk()) {
      snapshot.set(shape.id, this.signature(shape, document));
    }
    this.baselines.set(document, snapshot);
  }

  decorate(shape: Shape, document: SvgDocument): string {
    const saved = this.baselines.get(document)?.get(shape.id);
    return saved === this.signature(shape, document) ? '' : '*';
  }

  private signature(shape: Shape, document: SvgDocument): string {
    const siblings = shape.parent?.children ?? document.children;
    return JSON.stringify([shape.type, shape.parent?.id ?? null, siblings.indexOf(shape), shape.captureState()]);
  }
}
