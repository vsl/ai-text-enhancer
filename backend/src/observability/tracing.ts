import { Client } from 'npm:langsmith@0.10.5';
import { getCurrentRunTree, traceable } from 'npm:langsmith@0.10.5/traceable';

type TraceRunType = 'chain' | 'llm' | 'parser';
type TraceValue = Record<string, unknown>;

const DEFAULT_ENDPOINT = 'https://api.smith.langchain.com';
const SAFE_KEY = /^(requestId|environment|release|deploymentId|userTier|assistantId|role|model|requestedModel|requestedPublicModel|providerModel|resolvedModel|resolvedProvider|provider|promptRevision|promptFingerprint|elapsedMs|latencyMs|inputTokens|outputTokens|totalTokens|reasoningTokens|cachedTokens|tokensUsed|finishReason|nativeFinishReason|failureCode|httpStatus|candidateCount|candidateIds|selectedResultId|probabilities|confidence|improve|fixMistakes|format|shorten|lengthen|addEmojis|avoidCommonAiSymbols|formality|tone|languageLevel|translateTo|judge|generationId|status|method|cost|isByok)$/;
const SECRET_KEY = /(^key$|authorization|cookie|set-cookie|api[-_]?key|service[-_]?role[-_]?key|password|secret)/i;

let client: Client | null | undefined;

export function isContentCaptureEnabled(): boolean {
  return process.env.LANGSMITH_CAPTURE_CONTENT === 'true';
}

export function isTracingEnabled(): boolean {
  return process.env.LANGSMITH_TRACING === 'true' && Boolean(process.env.LANGSMITH_API_KEY);
}

function getClient(): Client | null {
  if (client !== undefined) return client;
  client = isTracingEnabled()
    ? new Client({
        apiKey: process.env.LANGSMITH_API_KEY,
        apiUrl: process.env.LANGSMITH_ENDPOINT || DEFAULT_ENDPOINT,
      })
    : null;
  return client;
}

export function deploymentMetadata(): TraceValue {
  return {
    environment: process.env.APP_ENV || 'local',
    release: process.env.APP_RELEASE || 'local',
    deploymentId: process.env.DENO_DEPLOYMENT_ID || 'local',
  };
}

export function sanitizeTraceValue(value: unknown, captureContent = isContentCaptureEnabled()): unknown {
  if (Array.isArray(value)) return value.map(item => sanitizeTraceValue(item, captureContent));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
      key,
      SECRET_KEY.test(key) ? '[REDACTED]' :
        !captureContent && /^(assistantId|selectedResultId|candidateIds|generationId)$/.test(key) && !safeIdentifier(nested)
          ? '[CONTENT OMITTED]' :
        !captureContent && !SAFE_KEY.test(key) && (nested === null || typeof nested !== 'object')
          ? '[CONTENT OMITTED]' : sanitizeTraceValue(nested, captureContent),
    ]));
  }
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      for (const key of url.searchParams.keys()) {
        if (SECRET_KEY.test(key)) url.searchParams.set(key, '[REDACTED]');
      }
      return redactSecretStrings(url.toString());
    } catch {
      return redactSecretStrings(value);
    }
  }
  return typeof value === 'string' ? redactSecretStrings(value) : value;
}

function redactSecretStrings(value: string): string {
  return [process.env.OPENROUTER_API_KEY, process.env.APP_SUPABASE_SERVICE_ROLE_KEY, process.env.LANGSMITH_API_KEY]
    .filter((secret): secret is string => Boolean(secret && secret.length >= 8))
    .reduce((redacted, secret) => redacted.replaceAll(secret, '[REDACTED]'), value);
}

function safeIdentifier(value: unknown): boolean {
  return (typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)) ||
    (typeof value === 'number' && Number.isSafeInteger(value)) ||
    (Array.isArray(value) && value.every(safeIdentifier));
}

export async function traceRun<TInput extends TraceValue, TOutput>(options: {
  name: string;
  runType: TraceRunType;
  inputs: TInput;
  metadata?: TraceValue;
  operation: () => Promise<TOutput>;
}): Promise<TOutput> {
  const tracingClient = getClient();
  const captureContent = isContentCaptureEnabled();
  if (!tracingClient) return options.operation();

  let operationStarted = false;
  let operationCompleted = false;
  let operationResult: TOutput;

  const wrapped = traceable(
    async (_inputs: TInput) => {
      operationStarted = true;
      try {
        operationResult = await options.operation();
        operationCompleted = true;
        return operationResult;
      } catch (error) {
        const diagnostic = error as { code?: string; statusCode?: number };
        addTraceMetadata({
          ...(diagnostic.code && { failureCode: diagnostic.code }),
          ...(diagnostic.statusCode && { httpStatus: diagnostic.statusCode }),
        });
        throw error;
      }
    },
    {
      name: options.name,
      run_type: options.runType,
      client: tracingClient,
      project_name: process.env.LANGSMITH_PROJECT,
      metadata: sanitizeTraceValue({ ...deploymentMetadata(), ...options.metadata }, captureContent) as TraceValue,
      processInputs: inputs => sanitizeTraceValue(inputs, captureContent) as TraceValue,
      processOutputs: outputs => sanitizeTraceValue(outputs, captureContent) as TraceValue,
      on_end: run => { if (!captureContent && run.error) run.error = "[ERROR DETAILS OMITTED]"; },
    },
  );

  try {
    return await (wrapped as unknown as (inputs: TInput) => Promise<TOutput>)(options.inputs);
  } catch (error) {
    if (operationCompleted) {
      console.warn('[TRACING] Trace export failed');
      return operationResult!;
    }
    if (!operationStarted) {
      console.warn('[TRACING] Trace setup failed');
      return options.operation();
    }
    throw error;
  }
}

export function addTraceMetadata(metadata: TraceValue): void {
  let run;
  try {
    run = getCurrentRunTree();
  } catch {
    return;
  }
  if (!run) return;
  run.extra.metadata = {
    ...(run.extra.metadata ?? {}),
    ...(sanitizeTraceValue(metadata, isContentCaptureEnabled()) as TraceValue),
  };
}

export async function flushTraces(): Promise<void> {
  try {
    await getClient()?.awaitPendingTraceBatches();
  } catch (error) {
    console.warn('[TRACING] Failed to flush traces');
  }
}

export function resetTracingForTests(): void {
  client = undefined;
}

export function setTracingClientForTests(testClient: Client | null): void {
  client = testClient;
}
