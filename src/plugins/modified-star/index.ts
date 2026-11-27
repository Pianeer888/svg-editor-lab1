import { PLUGIN_API_VERSION, type Plugin } from '../../extensions/Plugin.js';
import { ModifiedStar } from './ModifiedStar.js';

export default function createModifiedStarPlugin(): Plugin {
  return {
    manifest: {
      id: 'modified-star',
      apiVersion: PLUGIN_API_VERSION,
      contributes: { decorators: ['modified-star'] },
    },
    activate(registrar) { registrar.registerTreeDecorator(new ModifiedStar()); },
  };
}
