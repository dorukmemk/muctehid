"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginRegistry = void 0;
const loader_js_1 = require("./loader.js");
class PluginRegistry {
    plugins = new Map();
    async load(packageNames, repoRoot) {
        for (const name of packageNames) {
            try {
                const plugin = await (0, loader_js_1.loadPlugin)(name, repoRoot);
                if (plugin) {
                    this.plugins.set(plugin.name, plugin);
                    console.error(`[code-audit] Plugin loaded: ${plugin.name} v${plugin.version}`);
                }
            }
            catch (e) {
                console.error(`[code-audit] Failed to load plugin ${name}: ${e}`);
            }
        }
    }
    getAllTools() {
        const tools = [];
        for (const plugin of this.plugins.values()) {
            if (plugin.tools)
                tools.push(...plugin.tools);
        }
        return tools;
    }
    list() {
        return Array.from(this.plugins.values());
    }
}
exports.PluginRegistry = PluginRegistry;
//# sourceMappingURL=registry.js.map