import type { Plugin } from '../../extensions/Plugin.js';
import { BoxPlugin } from './BoxPlugin.js';

export default function createBoxPlugin(): Plugin { return new BoxPlugin(); }
