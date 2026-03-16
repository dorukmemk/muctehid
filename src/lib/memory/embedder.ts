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

type PipelineInstance = (
  text: string,
  options: { pooling: string; normalize: boolean }
) => Promise<{ data: Float32Array }>;

let pipelineInstance: PipelineInstance | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

const MODEL = 'Xenova/all-MiniLM-L6-v2';

async function loadModel(): Promise<void> {
  if (pipelineInstance) return;
  if (isLoading && loadPromise) return loadPromise;
  isLoading = true;

  loadPromise = (async () => {
    // Stdout → stderr köprüsü: model loader'ın stdout'a yazdığı
    // her şeyi stderr'e yönlendir (MCP protokolünü korur)
    const origWrite = process.stdout.write.bind(process.stdout);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stdout as any).write = (chunk: any, ...rest: any[]): boolean => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.stderr as any).write(chunk, ...rest);
      return true;
    };

    try {
      const { pipeline } = await import('@xenova/transformers');

      // progress_callback: () => {} → indirme/yükleme loglarını sustur
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pipelineInstance = (await (pipeline as any)(
        'feature-extraction',
        MODEL,
        { progress_callback: () => {} },
      )) as PipelineInstance;
    } catch (e) {
      isLoading = false;
      loadPromise = null;
      throw new Error(`Failed to load embedding model: ${e}`);
    } finally {
      // Her durumda stdout'u geri al
      process.stdout.write = origWrite;
    }
  })();

  return loadPromise;
}

export async function embed(text: string): Promise<number[]> {
  await loadModel();
  if (!pipelineInstance) throw new Error('Embedder not initialized');

  // pooling:'mean' → result.data = Float32Array[384]  (düz, [0] değil)
  const result = await pipelineInstance(text.slice(0, 512), {
    pooling: 'mean',
    normalize: true,
  });

  return Array.from(result.data);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}

export function isModelLoaded(): boolean {
  return pipelineInstance !== null;
}
