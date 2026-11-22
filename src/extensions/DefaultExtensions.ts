import { ExtensionRegistry } from './ExtensionRegistry.js';
import { registerBuiltInShapes } from './BuiltInShapeProvider.js';

export function createDefaultExtensions(): ExtensionRegistry {
  const extensions = new ExtensionRegistry();
  registerBuiltInShapes(provider => extensions.registerShape(provider));
  return extensions;
}
