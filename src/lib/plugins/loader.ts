import * as path from 'path';
import { PluginDefinition } from '../../types/index.js';

export async function loadPlugin(packageName: string, repoRoot: string): Promise<PluginDefinition | null> {
  const candidates = [
    path.join(repoRoot, 'node_modules', packageName),
    path.join(repoRoot, packageName),
  ];

  for (const candidate of candidates) {
    try {
      const mod = await import(candidate);
      const plugin = mod.default ?? mod;
      if (plugin && plugin.name && plugin.version) {
        return plugin as PluginDefinition;
      }
    } catch { /* try next */ }
  }

  return null;
}

export function definePlugin(def: PluginDefinition): PluginDefinition {
  return def;
}
