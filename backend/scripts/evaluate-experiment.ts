import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GeminiConnector } from '../src/connectors/llm-connectors/gemini-connector.ts';
import { OpenRouterConnector } from '../src/connectors/llm-connectors/openrouter-connector.ts';
import { OpenRouterDecisionConnector } from '../src/connectors/openrouter-decision-connector.ts';
import { caseTags, createExperimentReport, runExperiment, validateExperiment, prepareExperiment, plannedCalls, type ExperimentDefinition, type ExperimentReport } from '../src/evaluation/experiments.ts';
import { createReview, evaluateGates, validateStoredReport, type ReviewArtifact } from '../src/evaluation/experiment-review.ts';
import { executionFingerprint, loadSuite } from './lib/evaluation-files.ts';
import { CALIBRATION_CONTROLS } from '../evaluations/calibration-cases.ts';
import { evaluateWithJev } from '../src/evaluation/jev-evaluator.ts';
import { publishExperiment, publishCalibration, type Publication } from './lib/langfuse-export.ts';
import { fingerprintPrompt } from '../src/services/prompt-builder.ts';

const args = process.argv.slice(2);
const allowed = ['experiment', 'suite', 'reuse', 'case', 'tag', 'repeat', 'baseline', 'report', 'review', 'output', 'dry-run', 'publish', 'help', 'calibrate', 'judge-controls'];
for (const arg of args) if (!arg.startsWith('--') || !allowed.includes(arg.slice(2).split('=')[0])) throw new Error(`Unknown argument: ${arg}`);
const flags = ['dry-run', 'publish', 'help', 'calibrate', 'judge-controls'];
for (const arg of args) {
  const name = arg.slice(2).split('=')[0];
  if (flags.includes(name) ? arg.includes('=') : !arg.includes('=')) throw new Error(`Invalid argument syntax: ${arg}`);
  if (!['tag', 'reuse'].includes(name) && args.filter(a => a.slice(2).split('=')[0] === name).length > 1) throw new Error(`Duplicate argument: ${name}`);
}
const option = (name: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => args.includes(`--${name}`);
const load = async <T>(path: string): Promise<T> => JSON.parse(await readFile(resolve(path), 'utf8')) as T;
const save = async (path: string, value: unknown) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`); };
async function loadReport(path: string): Promise<ExperimentReport> {
  const report = await load<ExperimentReport>(path);
  const journal = await readFile(resolve(dirname(path), 'attempts.jsonl'), 'utf8').catch(error => {
    if (error.code === 'ENOENT') return ''; throw error;
  });
  if (journal) report.records = journal.trim().split('\n').map(line => JSON.parse(line));
  return report;
}
async function publish(report: ExperimentReport, path: string) {
  const publicationPath = resolve(dirname(path), 'publication.json');
  const existing = await load<Publication>(publicationPath).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
  if (existing?.status === 'complete') {
    if (existing.reportHash !== await fingerprintPrompt(JSON.stringify(report))) throw new Error('Published report changed; use a new comparison rather than overwriting its publication');
    for (const [id, run] of Object.entries(existing.runs)) console.log(`${id}: ${run.url ?? run.id}`);
    return;
  }
  const result = await publishExperiment(report, p => save(publicationPath, p));
  await save(publicationPath, result);
  for (const [id, run] of Object.entries(result.runs)) console.log(`${id}: ${run.url ?? run.id}`);
  if (result.status === 'error') { console.error(`Publication failed; local results retained: ${result.error}`); process.exitCode = 1; }
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `\nLangfuse publication: ${result.status}\n\n${Object.entries(result.runs).map(([id, run]) => `- ${id}: ${run.url ? `[experiment](${run.url})` : run.id}`).join('\n')}\n`);
}

if (flag('help')) {
  console.log('eval:compare --experiment=evaluations/experiments/models.ts [--suite=base|all|development] [--reuse=saved-report.json] [--dry-run] [--case=substring] [--tag=tag] [--repeat=1] [--baseline=approved.json] [--publish]\neval:publish --report=evaluation-results/<comparison>/report.json\neval:review --report=... --review=review-input.json --output=evaluations/baselines/<name>.json\neval:calibrate [--judge-controls] [--output=evaluation-results/calibration.json]');
} else if (flag('calibrate')) {
  if (flag('judge-controls') && !process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY required for paid calibration');
  const connector = process.env.OPENROUTER_API_KEY ? new OpenRouterDecisionConnector(process.env.OPENROUTER_API_KEY) : null;
  const reviewSet = [];
  for (const control of CALIBRATION_CONTROLS) {
    const judge = flag('judge-controls') ? await evaluateWithJev(control.fixture, control.output, connector!) : null;
    reviewSet.push({ ...control, humanLabels: Object.fromEntries(Object.keys(control.proposedLabels).map(k => [k, null])), judge });
    if (judge?.status === 'error') process.exitCode = 1;
  }
  const path = resolve(option('output') ?? 'evaluation-results/calibration-review.json');
  await save(path, reviewSet); console.log(`${reviewSet.length} proposed controls with blank human labels: ${path}`);
  if (flag('publish')) { const publication = await publishCalibration(reviewSet);
    await save(resolve(dirname(path), 'calibration-publication.json'), publication); console.log(publication.url ?? publication.id); }
} else if (option('report')) {
  const path = resolve(option('report')!);
  const report = await loadReport(path);
  await validateStoredReport(report);
  if (option('review')) {
    const input = await load<Parameters<typeof createReview>[1]>(option('review')!);
    const publication = await load<Publication>(resolve(dirname(path), 'publication.json')).catch(error => {
      if (input.decision === 'rejected' && error.code === 'ENOENT') return { status: 'error', runs: {} } as Publication;
      throw error;
    });
    if (input.decision === 'approved' && publication.status !== 'complete') throw new Error('Publication must complete before approval');
    if (input.decision === 'approved' && publication.reportHash !== await fingerprintPrompt(JSON.stringify(report))) throw new Error('Publication does not match the reviewed report');
    input.runIds = Object.fromEntries(Object.entries(publication.runs).map(([id, run]) => [id, run.id]));
    const review = await createReview(report, input, option('baseline') ? await load<ReviewArtifact>(option('baseline')!) : undefined);
    if (!option('output')) throw new Error('--output is required for review; existing baselines are never replaced automatically');
    const target = resolve(option('output')!);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(review, null, 2)}\n`, { flag: 'wx' });
    console.log(`Review decision saved: ${target}`);
  } else if (flag('publish')) await publish(report, path);
  else throw new Error('--report requires --publish or --review');
} else {
  const modulePath = resolve(option('experiment') ?? 'evaluations/experiments/models.ts');
  const trustedDirectory = `${resolve('evaluations/experiments')}/`;
  if (!modulePath.startsWith(trustedDirectory) || !modulePath.endsWith('.ts')) throw new Error('Experiment must be a trusted local TypeScript module under evaluations/experiments/');
  const definition: ExperimentDefinition = (await import(pathToFileURL(modulePath).href)).default;
  const overrides: Record<string, unknown> = {};
  if (option('suite')) { definition.suite = option('suite') as ExperimentDefinition['suite']; overrides.suite = definition.suite; }
  if (definition.suite !== undefined && !['base', 'all', 'acceptance', 'development'].includes(definition.suite)) throw new Error('Unknown suite');
  if (option('repeat')) { definition.repetitions = Number(option('repeat')); overrides.repetitions = definition.repetitions; }
  const allCases = await loadSuite(definition.suite);
  const tags = args.filter(arg => arg.startsWith('--tag=')).map(arg => arg.slice(6));
  const cases = allCases.filter(item => (!option('case') || item.id.includes(option('case')!)) && tags.every(tag => caseTags(item).includes(tag)));
  validateExperiment(definition, cases);
  const report = await createExperimentReport(definition, cases, {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0,
  });
  report.executionHash = await executionFingerprint();
  const sources: ExperimentReport[] = [];
  for (const arg of args.filter(a => a.startsWith('--reuse='))) {
    const source = await loadReport(arg.slice(8));
    await validateStoredReport(source);
    // Older clean reports can be fingerprinted from their exact committed code.
    // Dirty/unavailable historical code cannot be reconstructed safely.
    if (!source.executionHash && !source.git.dirty) {
      try { source.executionHash = await executionFingerprint(source.git.revision); }
      catch { console.warn(`Cannot reconstruct production code for ${source.comparisonId}; no results will be reused.`); }
    }
    sources.push(source);
  }
  const prepared = await prepareExperiment(definition, report, sources);
  const calls = plannedCalls(report, prepared);
  console.log(`${definition.id} (${definition.suite ?? 'base'}): ${cases.length} cases, ${report.definition.repetitions} repetitions; at most ${calls.generations} new generation + ${calls.judgments} new judge calls, plus ${calls.catalogChecks} catalog checks. Reuse: ${calls.reusedGenerations} generations + ${calls.reusedJudgments} judgments. Publication adds 0 AI calls.`);
  const promptErrors = prepared.filter(p => p.record.error);
  if (promptErrors.length) throw new Error(`Prompt preparation failed before paid calls: ${promptErrors.map(p => `${p.record.candidateId}/${p.record.caseId}: ${p.record.error!.message}`).join('; ')}`);
  if (!flag('dry-run')) {
    report.partialSuite = cases.length !== allCases.length;
    report.overrides = { ...overrides, filters: { case: option('case') ?? null, tags }, generation: definition.settings ?? {},
      candidateGeneration: [definition.baseline, definition.candidate].map(c => ({ id: c.id, overrides: c.settings ?? {} })),
      reuseSources: sources.map(s => ({ comparisonId: s.comparisonId, git: s.git })), plannedCalls: calls };
    const path = resolve('evaluation-results', report.comparisonId, 'report.json');
    await save(path, report);
    const approved = option('baseline') ? await load<ReviewArtifact>(option('baseline')!) : undefined;
    if (approved) {
      const mismatches = evaluateGates(report, approved).failures.filter(f => f.startsWith('Approved baseline') || f.startsWith('Experiment baseline'));
      if (mismatches.length) throw new Error(mismatches.join('; '));
    }
    const keys = { openrouter: process.env.OPENROUTER_API_KEY, gemini: process.env.GEMINI_API_KEY };
    try { await runExperiment(definition, report, { keys, prepared, connectors: {
      ...(keys.openrouter ? { openrouter: new OpenRouterConnector(keys.openrouter) } : {}),
      ...(keys.gemini ? { gemini: new GeminiConnector(keys.gemini) } : {}),
    }, judge: keys.openrouter ? new OpenRouterDecisionConnector(keys.openrouter, report.definition.judge.timeoutMs) : undefined,
    onRecord: async record => { await appendFile(resolve(dirname(path), 'attempts.jsonl'), `${JSON.stringify(record)}\n`);
      // The append-only journal checkpoints each result without rewriting a
      // growing full report thousands of times. One snapshot retains preflights.
      if (report.records.length === 1) await save(path, report);
      console.log(`${record.candidateId}/${record.caseId}/${record.attempt}: ${record.error?.stage ?? 'complete'}${record.reuse ? ` (reused generation${record.reuse.judge ? ' + judge' : ''})` : ''}`); } }); }
    finally { await save(path, report); }
    const gate = evaluateGates(report, approved);
    await save(resolve(dirname(path), 'summary.json'), gate);
    console.log(JSON.stringify(gate, null, 2)); console.log(`Report: ${path}`);
    if (!gate.eligible) process.exitCode = 1;
    if (flag('publish')) await publish(report, path);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `\nComparison ${report.comparisonId}: ${gate.eligible ? 'hard gates passed' : 'hard gates failed'}; semantic gates ${gate.semanticGates}.\n\n${gate.failures.map(f => `- ${f}`).join('\n')}\n`);
  }
}
