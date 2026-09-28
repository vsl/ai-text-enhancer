import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BOUNDARY_CASES } from '../evaluations/boundary-cases.ts';
import { JevResultSelector, JEV_POLICY_VERSION } from '../src/services/jev-result-selector.ts';
import { OpenRouterDecisionConnector } from '../src/connectors/openrouter-decision-connector.ts';

if (process.argv.includes('--help')) {
  console.log('Usage: npm run eval:jev -- [--repeat=3] [--case=substring]');
  process.exit(0);
}
const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error('OPENROUTER_API_KEY is required');
const repetitions = Number(process.argv.find(arg => arg.startsWith('--repeat='))?.slice(9) ?? '1');
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100) throw new Error('--repeat must be 1 to 100');
const filter = process.argv.find(arg => arg.startsWith('--case='))?.slice(7) ?? '';
const cases = BOUNDARY_CASES.filter(item => item.id.includes(filter));
if (!cases.length) throw new Error('No cases match --case');
const connector = new OpenRouterDecisionConnector(key);
let decisions: unknown[] = [];
const selector = new JevResultSelector({ decide: async request => {
  const response = await connector.decide(request);
  decisions.push(response);
  return response;
} }, process.env.JEV_MODEL_ID);
const results = [];
const summary = { correct: 0, lowGoodScores: 0, highBadScores: 0, weakSeparation: 0, errors: 0 };
for (const item of cases) {
  for (let attempt = 1; attempt <= repetitions; attempt++) {
    // Singles reveal absolute scores; mixed orders reveal ranking and order effects.
    for (const labels of [['good'], ['bad'], ['good', 'bad'], ['bad', 'good']] as const) {
      decisions = [];
      try {
        const assistants = labels.map(label => ({
          id: label, model: 'evaluation-fixture', aiRoleId: item.roleId,
          userText: item.userText, contextText: item.contextText, options: item.options,
        }));
        const selection = await selector.select({ assistants }, labels.map(label => ({
          id: label, status: 'success' as const, enhancedText: item[label], total_tokens: 0,
        })), `calibration-${item.id}`);
        const checks = labels.map(label => {
          const score = selection.scores[label];
          const passed = label === 'good' ? score >= 0.6 : score <= 0.25;
          if (passed) summary.correct++;
          else if (label === 'good') summary.lowGoodScores++;
          else summary.highBadScores++;
          return { label, score, passed };
        });
        const separated = labels.length === 1 || (selection.selectedResultId === 'good'
          && selection.scores.good - selection.scores.bad >= 0.35);
        if (!separated) summary.weakSeparation++;
        const passed = checks.every(check => check.passed) && separated;
        results.push({ caseId: item.id, reason: item.reason, attempt, labels, passed, separated, checks, selection, decisions });
        console.log(`${item.id} ${labels.join('+')} #${attempt}: ${passed ? 'PASS' : 'FAIL'}`);
      } catch (error) {
        summary.errors++;
        results.push({ caseId: item.id, attempt, labels, passed: false, error: (error as Error).message, decisions });
        console.log(`${item.id} ${labels.join('+')} #${attempt}: ERROR`);
      }
    }
  }
}
const generatedAt = new Date().toISOString();
const directory = resolve('evaluation-results');
await mkdir(directory, { recursive: true });
const path = resolve(directory, `jev-${generatedAt.replaceAll(':', '-')}.json`);
await writeFile(path, JSON.stringify({ judgePolicyVersion: JEV_POLICY_VERSION, generatedAt, summary, results }, null, 2) + '\n');
console.log(JSON.stringify(summary));
console.log(`Report: ${path}`);
process.exitCode = summary.lowGoodScores + summary.highBadScores + summary.weakSeparation + summary.errors === 0 ? 0 : 1;
