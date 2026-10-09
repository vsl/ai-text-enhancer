import { pathToFileURL } from 'node:url';

function modelUrl(id) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(id)) {
    throw new Error('Model IDs must use author/slug format, optionally with a variant suffix.');
  }
  return `https://openrouter.ai/api/v1/model/${id.split('/').map(encodeURIComponent).join('/')}`;
}

export async function inspectModels(ids, { apiKey = process.env.OPENROUTER_API_KEY, fetchImpl = fetch } = {}) {
  if (!ids.length) throw new Error('Provide at least one OpenRouter model ID.');
  const requests = [...new Set(ids)].map(id => ({ id, url: modelUrl(id) }));
  if (!apiKey?.trim()) throw new Error('OPENROUTER_API_KEY is missing; load an existing private env file or set the environment variable.');
  return Promise.all(requests.map(async ({ id, url }) => {
    const base = { requestedModel: id, sourceUrl: url, verifiedAt: new Date().toISOString() };
    try {
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return { ...base, status: response.status === 404 ? 'unavailable' : 'error', httpStatus: response.status };
      const { data } = await response.json();
      if (!data || typeof data.id !== 'string' || Array.isArray(data)) return { ...base, status: 'error', error: 'Unexpected model response format.' };
      return { ...base, status: 'available', resolvedModel: data.id,
        contextLength: data.context_length ?? null,
        supportedParameters: data.supported_parameters ?? null,
        reasoning: data.reasoning ?? null,
        defaultParameters: data.default_parameters ?? null,
        topProvider: data.top_provider ?? null,
        pricing: data.pricing ?? null,
      };
    } catch {
      // Avoid logging response bodies or exception details containing credentials.
      return { ...base, status: 'error', error: 'Model lookup failed (network, timeout, redirect or invalid JSON).' };
    }
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const results = await inspectModels(process.argv.slice(2));
    console.log(JSON.stringify(results, null, 2));
    if (results.some(result => result.status !== 'available')) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
