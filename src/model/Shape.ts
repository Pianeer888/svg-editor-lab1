import type { Group } from './Group.js';

export abstract class Shape {
  private parentShape: Group | null = null;
  private fillValue?: string;
  private strokeValue?: string;
  private strokeWidthValue?: number;

  protected constructor(public readonly id: string, public readonly type: string) {
    if (!id.trim()) throw new Error('shape id must not be empty');
  }

  get parent(): Group | null { return this.parentShape; }
  get fill(): string | undefined { return this.fillValue; }
  get stroke(): string | undefined { return this.strokeValue; }
  get strokeWidth(): number | undefined { return this.strokeWidthValue; }

  /** Called by the document when a shape is attached or detached. */
  setParent(parent: Group | null): void { this.parentShape = parent; }

  set(attribute: string, value: string): void {
    switch (attribute) {
      case 'fill': this.fillValue = value; return;
      case 'stroke': this.strokeValue = value; return;
      case 'stroke-width': this.strokeWidthValue = Shape.nonNegative(value, attribute); return;
      default: this.setSpecific(attribute, value);
    }
  }

  protected abstract setSpecific(attribute: string, value: string): void;
  abstract move(dx: number, dy: number): void;
  abstract scale(factor: number): void;
  abstract geometry(): Readonly<Record<string, number | string>>;

  protected static finite(value: string, attribute: string): number {
    if (value.trim() === '') throw new Error(`invalid ${attribute}: ${value}`);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`invalid ${attribute}: ${value}`);
    return parsed;
  }

  protected static nonNegative(value: string, attribute: string): number {
    const parsed = Shape.finite(value, attribute);
    if (parsed < 0) throw new Error(`${attribute} must be non-negative`);
    return parsed;
  }

  protected static positiveFactor(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) throw new Error('scale factor must be positive');
  }

  protected static validOffset(dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('move offset must be finite');
  }

  protected unknownAttribute(attribute: string): never {
    throw new Error(`unknown attribute: ${attribute}`);
  }
}
