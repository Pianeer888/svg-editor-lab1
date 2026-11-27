import type { Shape } from '../model/Shape.js';

export interface AttributeHandler {
  readonly name: string;
  /** Match the target and attribute without modifying the document. */
  supports(shape: Shape, attribute: string): boolean;
  /** Edit geometry or style within the target subtree and preserve its membership and order. */
  set(shape: Shape, attribute: string, value: string): void;
}
