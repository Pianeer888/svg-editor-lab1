import { readdirSync } from 'node:fs';
import type { DirectoryAccess, DirectoryEntry } from './DirectoryAccess.js';

export class NodeDirectoryAdapter implements DirectoryAccess {
  constructor(private readonly cwd: () => string = process.cwd) {}

  currentDirectory(): string { return this.cwd(); }

  read(path: string): readonly DirectoryEntry[] {
    return readdirSync(path, { withFileTypes: true }).map(entry => ({
      name: entry.name,
      kind: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
    }));
  }
}
