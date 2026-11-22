import type { Shape } from '../model/Shape.js';

export interface AttributeHandler {
  readonly name: string;
  supports(shape: Shape, attribute: string): boolean;
  set(shape: Shape, attribute: string, value: string): void;
}
