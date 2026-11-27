import { PLUGIN_API_VERSION, type Plugin } from '../../extensions/Plugin.js';
import { BoxTypeLabel } from './BoxTypeLabel.js';

export default function createBoxTypeLabelPlugin(): Plugin {
  return {
    manifest: {
      id: 'box-type-label',
      apiVersion: PLUGIN_API_VERSION,
      contributes: { decorators: ['box-type-label'] },
    },
    activate(registrar) { registrar.registerTreeDecorator(new BoxTypeLabel()); },
  };
}
