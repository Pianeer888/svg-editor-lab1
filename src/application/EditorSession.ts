import { SvgDocument } from '../model/SvgDocument.js';
import { CommandHistory } from './CommandHistory.js';
import type { DocumentStore } from './DocumentStore.js';
import type { EditCommand } from './EditCommand.js';

/** Owns the open document, its file path, and the history for that document. */
export class EditorSession {
  private document: SvgDocument | null = null;
  private filePath: string | null = null;
  private readonly history = new CommandHistory();

  constructor(private readonly store: DocumentStore) {}

  requireDocument(): SvgDocument {
    if (this.document === null) throw new Error("no document. use 'init' or 'read' first");
    return this.document;
  }

  initialize(width?: number, height?: number): SvgDocument {
    const document = new SvgDocument(width, height);
    this.open(document, null);
    return document;
  }

  read(path: string): ReturnType<DocumentStore['load']> {
    const result = this.store.load(path);
    this.open(result.document, path);
    return result;
  }

  save(requestedPath?: string): { path: string; document: SvgDocument } {
    const document = this.requireDocument();
    const path = requestedPath ?? this.filePath;
    if (path === null) throw new Error("no file path. use 'save <file.svg>' first");
    this.store.save(path, document);
    this.filePath = path;
    this.history.blockAfterIo();
    return { path, document };
  }

  resize(width: number, height: number): void {
    this.requireDocument().resize(width, height);
    this.history.blockAfterIo();
  }

  execute(command: EditCommand): void { this.history.execute(command); }

  undo(): string {
    this.requireDocument();
    return this.history.undo();
  }

  redo(): string {
    this.requireDocument();
    return this.history.redo();
  }

  private open(document: SvgDocument, path: string | null): void {
    this.document = document;
    this.filePath = path;
    this.history.blockAfterIo();
  }
}
