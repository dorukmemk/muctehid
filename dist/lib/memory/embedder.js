"use strict";
/**
 * Embedder — @xenova/transformers wrapper
 *
 * ÖNEMLI: MCP stdio transport'ta stdout = JSON-RPC protokol kanalıdır.
 * @xenova/transformers model yüklerken stdout'a progress yazıyor.
 * Bu protokolü bozar ve LLM askıda kalır.
 *
 * Çözüm:
 *  1. progress_callback: () => {}  → indirme/yükleme çıktısını sustur
 *  2. loadModel() sırasında stdout → stderr yönlendir (kalan edge-case'ler için)
 *  3. Pipeline instance'ını bir kez oluştur, her embed'de yeniden yaratma
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.embed = embed;
exports.embedBatch = embedBatch;
exports.isModelLoaded = isModelLoaded;
let pipelineInstance = null;
let isLoading = false;
let loadPromise = null;
const MODEL = 'Xenova/all-MiniLM-L6-v2';
async function loadModel() {
    if (pipelineInstance)
        return;
    if (isLoading && loadPromise)
        return loadPromise;
    isLoading = true;
    loadPromise = (async () => {
        // Stdout → stderr köprüsü: model loader'ın stdout'a yazdığı
        // her şeyi stderr'e yönlendir (MCP protokolünü korur)
        const origWrite = process.stdout.write.bind(process.stdout);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.stdout.write = (chunk, ...rest) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            process.stderr.write(chunk, ...rest);
            return true;
        };
        try {
            const { pipeline } = await Promise.resolve().then(() => __importStar(require('@xenova/transformers')));
            // progress_callback: () => {} → indirme/yükleme loglarını sustur
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pipelineInstance = (await pipeline('feature-extraction', MODEL, { progress_callback: () => { } }));
        }
        catch (e) {
            isLoading = false;
            loadPromise = null;
            throw new Error(`Failed to load embedding model: ${e}`);
        }
        finally {
            // Her durumda stdout'u geri al
            process.stdout.write = origWrite;
        }
    })();
    return loadPromise;
}
async function embed(text) {
    await loadModel();
    if (!pipelineInstance)
        throw new Error('Embedder not initialized');
    // pooling:'mean' → result.data = Float32Array[384]  (düz, [0] değil)
    const result = await pipelineInstance(text.slice(0, 512), {
        pooling: 'mean',
        normalize: true,
    });
    return Array.from(result.data);
}
async function embedBatch(texts) {
    const results = [];
    for (const text of texts) {
        results.push(await embed(text));
    }
    return results;
}
function isModelLoaded() {
    return pipelineInstance !== null;
}
//# sourceMappingURL=embedder.js.map