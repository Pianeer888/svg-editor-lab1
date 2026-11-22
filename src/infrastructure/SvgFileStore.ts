import { readFileSync, writeFileSync } from 'node:fs';
import type { DocumentStore } from '../application/DocumentStore.js';
import type { SvgDocument } from '../model/SvgDocument.js';
import { SvgCodec } from './SvgCodec.js';
import type { ExtensionRegistry } from '../extensions/ExtensionRegistry.js';
import { createDefaultExtensions } from '../extensions/DefaultExtensions.js';

export class SvgFileStore implements DocumentStore {
  constructor(private readonly extensions: ExtensionRegistry = createDefaultExtensions()) {}

  load(path: string): { document: SvgDocument; warnings: string[] } {
    let content: string;
    try { content = readFileSync(path, 'utf8'); }
    catch { throw new Error(`cannot read file: ${path}`); }
    return SvgCodec.parse(content, this.extensions);
  }

  save(path: string, document: SvgDocument): void {
    const content = SvgCodec.serialize(document, this.extensions);
    try { writeFileSync(path, content, 'utf8'); }
    catch { throw new Error(`cannot write file: ${path}`); }
  }
}
