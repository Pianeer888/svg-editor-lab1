import type { Shape } from '../model/Shape.js';

export type SvgShapeInput = {
  readonly id: string;
  readonly element: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly content: string;
  readonly children: readonly SvgShapeInput[];
};

export type SvgShapeOutput = {
  readonly element: string;
  readonly attributes: Readonly<Record<string, string | number>>;
  readonly content?: string;
};

export interface ShapeProvider {
  readonly type: string;
  create(id: string, args: readonly string[]): Shape;
  matchSvg(input: SvgShapeInput): 'exact' | 'fallback' | false;
  fromSvg(input: SvgShapeInput, children: readonly Shape[]): Shape;
  supports(shape: Shape): boolean;
  toSvg(shape: Shape): SvgShapeOutput;
}
