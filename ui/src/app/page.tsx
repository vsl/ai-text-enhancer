import Link from "next/link";
import { ArrowRight, Bot, Layers3, SlidersHorizontal, Cpu } from "lucide-react";

const examples = [
  { model: "GPT-5 Nano", percentage: 54, text: "Thank you for the update. I’ve reviewed the revised timeline and it works well on our end — we’re happy to proceed with Thursday’s delivery." },
  { model: "Qwen3 30B", percentage: 31, text: "Thanks for the update — the new timeline looks good to us. We’ll move forward with Thursday’s delivery and share final assets Wednesday." },
  { model: "OpenRouter Free", percentage: 15, text: "Appreciate the update. The adjusted timeline is fine. We’ll deliver on Thursday and send assets Wednesday for review." },
];

function PreferenceRow({ model, percentage, text, compact = false }: {
  model: string;
  percentage: number;
  text?: string;
  compact?: boolean;
}) {
  const chosen = percentage === 54;
  return (
    <div className={chosen
      ? "rounded-xl border border-violet-border bg-violet-surface/65 p-4"
      : "rounded-xl border border-border bg-surface p-4"}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {chosen && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Chosen by Jev</span>}
          <span className={chosen ? "font-medium text-foreground" : "text-muted-foreground"}>{model}</span>
        </div>
        <span className={chosen ? "font-medium text-primary" : "text-tertiary"}>{percentage}%</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-border-strong">
        <div className={chosen ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-tertiary/40"} style={{ width: percentage + "%" }} />
      </div>
      {!compact && text && <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>}
    </div>
  );
}

const capabilities = [
  { title: "Reusable workflows", body: "Save a combination of assistants and settings for a recurring task, such as Formal Email, and return to it later.", icon: Layers3 },
  { title: "Multiple AI models", body: "Try the demo’s available models through one interface. Assistants in a workflow run in parallel and stay available for comparison.", icon: Cpu },
  { title: "Specialized assistants", body: "Choose a General Assistant, Summarizer Assistant, or Professional Email Assistant. Each has a distinct writing task.", icon: Bot },
  { title: "Context & transformations", body: "Keep source text separate from reference context. Configure edits, length, formality, tone, language level, and translation.", icon: SlidersHorizontal },
];

export default function Home() {
  return (
    <div>
      <section className="content-grid grid items-center gap-10 py-20 lg:grid-cols-[1.08fr_1fr] lg:gap-12 lg:py-24">
        <div>
          <span className="inline-flex rounded-full border border-border-strong bg-card px-3 py-1 text-xs font-medium text-muted-foreground">AI Text Enhancer</span>
          <h1 className="mt-7 max-w-[630px] text-[clamp(2rem,4vw,3.375rem)] font-semibold leading-[1.1] tracking-tight">
            Stop repeating the same instructions to AI.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Turn recurring writing tasks into reusable workflows. Run multiple AI models, compare their results, and let Jev evaluate the alternatives.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/text-ai-assistants" className="inline-flex items-center gap-3 rounded-lg bg-primary px-5 py-3 font-medium text-white transition-colors hover:bg-primary-hover">
              Try AI Text Enhancer <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <span className="text-sm text-tertiary">No traditional signup · weekly demo allowance</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border-strong bg-card p-5" aria-label="Illustrative Jev evaluation preview">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4 text-sm text-muted-foreground">
            <span>Formal Email · 3 assistants</span>
            <span className="rounded-full bg-surface-hover px-2.5 py-1 text-xs">Jev</span>
          </div>
          <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wider text-tertiary">Evaluated alternatives</p>
          <div className="space-y-2.5">{examples.map((example) => <PreferenceRow key={example.model} {...example} compact />)}</div>
          <p className="mt-4 text-xs text-tertiary">Illustrative preview · relative preference, not confidence</p>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="content-grid grid items-center gap-10 py-18 md:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Keep the setup. Change the text.</h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              General-purpose chats make you restate the same details for every recurring writing task. A workflow saves that setup once so next time you only bring the text.
            </p>
          </div>
          <div className="rounded-2xl border border-border-strong bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-tertiary">Every time, you re-explain</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Tone", "Style", "Context", "Transformations", "Number of alternatives"].map((item) =>
                <span key={item} className="rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-sm text-muted-foreground">{item}</span>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
              <span className="rounded-full bg-violet-surface px-3 py-1 font-medium text-primary">With a workflow</span>
              <span>The setup is saved. You start with your text.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="content-grid py-18">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Capabilities</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Everything a recurring writing task needs</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {capabilities.map(({ title, body, icon: Icon }) => (
              <article key={title} className="rounded-2xl border border-border-strong bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-lg bg-violet-surface text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                <h3 className="mt-5 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </article>
            ))}
          </div>
          <article className="mt-4 rounded-2xl border border-violet-border bg-violet-surface/65 p-6">
            <h3 className="text-base font-semibold">Avoid common AI symbols</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Prefer simpler punctuation and more natural phrasing without repeatedly asking the model to remove em dashes, semicolons, unnecessary formatting, and other common AI-writing patterns.
            </p>
          </article>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="content-grid grid items-center gap-10 py-20 md:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Compare alternatives</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Results evaluated with Jev</h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              When at least two assistants return valid results, Jev evaluates the alternatives and returns a selected candidate with relative probabilities. Every result remains available, so you still make the final choice.
            </p>
            <Link href="/text-ai-assistants" className="mt-6 inline-flex items-center gap-2 font-medium text-primary hover:text-primary-hover">
              Try a workflow <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="space-y-2.5 rounded-2xl border border-border-strong bg-card p-5" aria-label="Illustrative Jev result examples">
            {examples.map((example) => <PreferenceRow key={example.model} {...example} />)}
            <p className="pt-1 text-xs text-tertiary">Illustrative examples · relative preference, not confidence</p>
          </div>
        </div>
      </section>
    </div>
  );
}
