import { readFileSync, writeFileSync } from 'node:fs';
import type { DocumentStore } from '../application/DocumentStore.js';
import type { SvgDocument } from '../model/SvgDocument.js';
import { SvgCodec } from './SvgCodec.js';

export class SvgFileStore implements DocumentStore {
  load(path: string): { document: SvgDocument; warnings: string[] } {
    let content: string;
    try { content = readFileSync(path, 'utf8'); }
    catch { throw new Error(`cannot read file: ${path}`); }
    return SvgCodec.parse(content);
  }

  save(path: string, document: SvgDocument): void {
    const content = SvgCodec.serialize(document);
    try { writeFileSync(path, content, 'utf8'); }
    catch { throw new Error(`cannot write file: ${path}`); }
  }
}
