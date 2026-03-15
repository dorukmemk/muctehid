let pipeline: ((task: string, model: string, options?: Record<string, unknown>) => Promise<{ data: Float32Array }[]>) | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

const MODEL = 'Xenova/all-MiniLM-L6-v2';

async function loadModel(): Promise<void> {
  if (pipeline) return;
  if (isLoading && loadPromise) return loadPromise;
  isLoading = true;
  loadPromise = (async () => {
    try {
      // Dynamic import to allow bm25-only mode without loading model
      const { pipeline: p } = await import('@xenova/transformers');
      pipeline = p as unknown as typeof pipeline;
    } catch (e) {
      isLoading = false;
      throw new Error(`Failed to load embedding model: ${e}`);
    }
  })();
  return loadPromise;
}

export async function embed(text: string): Promise<number[]> {
  await loadModel();
  if (!pipeline) throw new Error('Embedder not initialized');
  const result = await pipeline('feature-extraction', MODEL, {
    inputs: text.slice(0, 512),
    pooling: 'mean',
    normalize: true,
  });
  return Array.from(result[0].data);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}

export function isModelLoaded(): boolean {
  return pipeline !== null;
}
