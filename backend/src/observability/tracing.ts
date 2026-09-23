import { Client } from 'langsmith';
import { getCurrentRunTree, traceable } from 'langsmith/traceable';

type TraceRunType = 'chain' | 'llm' | 'parser';
type TraceValue = Record<string, unknown>;

const DEFAULT_ENDPOINT = 'https://api.smith.langchain.com';
const SECRET_KEY = /(authorization|cookie|set-cookie|api[-_]?key|service[-_]?role[-_]?key|password|secret)/i;

let client: Client | null | undefined;

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

export function sanitizeTraceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeTraceValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
      key,
      SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeTraceValue(nested),
    ]));
  }
  if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.searchParams.has('key')) url.searchParams.set('key', '[REDACTED]');
      return url.toString();
    } catch {
      return value;
    }
  }
  return value;
}

export async function traceRun<TInput extends TraceValue, TOutput>(options: {
  name: string;
  runType: TraceRunType;
  inputs: TInput;
  metadata?: TraceValue;
  operation: () => Promise<TOutput>;
}): Promise<TOutput> {
  const tracingClient = getClient();
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
      metadata: sanitizeTraceValue({ ...deploymentMetadata(), ...options.metadata }) as TraceValue,
      processInputs: inputs => sanitizeTraceValue(inputs) as TraceValue,
      processOutputs: outputs => sanitizeTraceValue(outputs) as TraceValue,
    },
  );

  try {
    return await (wrapped as unknown as (inputs: TInput) => Promise<TOutput>)(options.inputs);
  } catch (error) {
    if (operationCompleted) {
      console.warn('[TRACING] Trace export failed:', (error as Error).message);
      return operationResult!;
    }
    if (!operationStarted) {
      console.warn('[TRACING] Trace setup failed:', (error as Error).message);
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
    ...(sanitizeTraceValue(metadata) as TraceValue),
  };
}

export async function flushTraces(): Promise<void> {
  try {
    await getClient()?.awaitPendingTraceBatches();
  } catch (error) {
    console.warn('[TRACING] Failed to flush traces:', (error as Error).message);
  }
}

export function resetTracingForTests(): void {
  client = undefined;
}

export function setTracingClientForTests(testClient: Client | null): void {
  client = testClient;
}
