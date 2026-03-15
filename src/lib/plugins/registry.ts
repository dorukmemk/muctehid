import { PluginDefinition, PluginToolDef } from '../../types/index.js';
import { loadPlugin } from './loader.js';

export class PluginRegistry {
  private plugins: Map<string, PluginDefinition> = new Map();

  async load(packageNames: string[], repoRoot: string): Promise<void> {
    for (const name of packageNames) {
      try {
        const plugin = await loadPlugin(name, repoRoot);
        if (plugin) {
          this.plugins.set(plugin.name, plugin);
          console.error(`[code-audit] Plugin loaded: ${plugin.name} v${plugin.version}`);
        }
      } catch (e) {
        console.error(`[code-audit] Failed to load plugin ${name}: ${e}`);
      }
    }
  }

  getAllTools(): PluginToolDef[] {
    const tools: PluginToolDef[] = [];
    for (const plugin of this.plugins.values()) {
      if (plugin.tools) tools.push(...plugin.tools);
    }
    return tools;
  }

  list(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }
}
