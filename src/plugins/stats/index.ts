import type { Plugin } from '../../extensions/Plugin.js';
import { StatsPlugin } from './StatsPlugin.js';

export function createStatsPlugin(): Plugin { return new StatsPlugin(); }

export default function createConfiguredStatsPlugin(_options: unknown): Plugin {
  return createStatsPlugin();
}
