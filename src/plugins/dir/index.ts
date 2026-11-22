import type { Plugin } from '../../extensions/Plugin.js';
import { DirPlugin } from './DirPlugin.js';
import { NodeDirectoryAdapter } from './NodeDirectoryAdapter.js';

export function createDirPlugin(): Plugin { return new DirPlugin(new NodeDirectoryAdapter()); }

export default function createConfiguredDirPlugin(_options: unknown): Plugin {
  return createDirPlugin();
}
