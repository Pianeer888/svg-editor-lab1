import type { SvgDocument } from '../model/SvgDocument.js';

/** Storage boundary used by the editor session. Implementations own file and SVG details. */
export interface DocumentStore {
  load(path: string): { document: SvgDocument; warnings: string[] };
  save(path: string, document: SvgDocument): void;
}
