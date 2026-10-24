import type { SvgDocument } from '../model/SvgDocument.js';

/** Storage boundary used by the CLI; implementations own file and SVG details. */
export interface DocumentStore {
  load(path: string): { document: SvgDocument; warnings: string[] };
  save(path: string, document: SvgDocument): void;
}
