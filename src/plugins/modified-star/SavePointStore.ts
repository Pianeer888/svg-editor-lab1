import type { DocumentStore } from '../../application/DocumentStore.js';
import type { SvgDocument } from '../../model/SvgDocument.js';

export class SavePointStore implements DocumentStore {
  constructor(
    private readonly store: DocumentStore,
    private readonly markClean: (document: SvgDocument) => void,
  ) {}

  load(path: string): ReturnType<DocumentStore['load']> {
    const result = this.store.load(path);
    this.markClean(result.document);
    return result;
  }

  save(path: string, document: SvgDocument): void {
    this.store.save(path, document);
    this.markClean(document);
  }
}
