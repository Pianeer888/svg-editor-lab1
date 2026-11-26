import { PLUGIN_API_VERSION, type ExtensionRegistrar, type Plugin, type PluginManifest } from '../../extensions/Plugin.js';
import { BoxAttributes } from './BoxAttributes.js';
import { BoxProvider } from './BoxProvider.js';

export class BoxPlugin implements Plugin {
  readonly manifest: PluginManifest = {
    id: 'box',
    apiVersion: PLUGIN_API_VERSION,
    contributes: { shapes: ['box'], attributes: ['box-attributes'] },
  };

  activate(registrar: ExtensionRegistrar): void {
    registrar.registerShape(new BoxProvider());
    registrar.registerAttributeHandler(new BoxAttributes());
  }
}
