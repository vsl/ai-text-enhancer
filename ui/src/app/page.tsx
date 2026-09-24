import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12 space-y-16">
      <section className="max-w-4xl mx-auto text-center space-y-6">
        <p className="text-secondary font-medium">AI Text Enhancer</p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Stop rewriting the same prompt every time.</h1>
        <p className="text-lg md:text-xl text-muted-foreground">
          Improve emails, messages, translations, and everyday writing with reusable AI assistants. Run the same text through different models and configurations, compare the results, and reuse the workflows that work for you.
        </p>
        <Link href="/text-ai-assistants" className="inline-flex items-center gap-2 px-7 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary-hover">
          Try AI Text Enhancer <ArrowRight className="h-5 w-5" />
        </Link>
        <p className="text-sm text-muted-foreground">No traditional signup · weekly demo allowance</p>
      </section>

      <section className="max-w-4xl mx-auto space-y-4" aria-labelledby="purpose-heading">
        <h2 id="purpose-heading" className="text-3xl font-semibold">Keep the setup. Change the text.</h2>
        <p className="text-muted-foreground text-lg">General-purpose chats often make you restate the tone, style, reference context, transformations, and number of alternatives for recurring writing tasks. A workflow saves the assistant setup so you can start with your text next time.</p>
      </section>

      <section className="grid md:grid-cols-2 gap-5" aria-label="Product capabilities">
        <article className="p-6 bg-card border border-border rounded-xl space-y-2"><h2 className="text-xl font-semibold">Reusable workflows</h2><p className="text-muted-foreground">Save a combination of assistants and settings for a recurring task, such as Formal Email, and switch back to it later in this browser.</p></article>
        <article className="p-6 bg-card border border-border rounded-xl space-y-2"><h2 className="text-xl font-semibold">Multiple AI models</h2><p className="text-muted-foreground">Try the demo’s available models through one interface. Assistants in a workflow run in parallel, and each result stays available for comparison.</p></article>
        <article className="p-6 bg-card border border-border rounded-xl space-y-2"><h2 className="text-xl font-semibold">Specialized assistants</h2><p className="text-muted-foreground">Choose a General Assistant, Summarizer Assistant, or Professional Email Assistant. Each has a distinct writing task.</p></article>
        <article className="p-6 bg-card border border-border rounded-xl space-y-2"><h2 className="text-xl font-semibold">Context and transformations</h2><p className="text-muted-foreground">Keep source text separate from optional reference context. Configure edits, length, formatting, formality, tone, language level, translation, and emojis.</p></article>
      </section>

      <section className="rounded-2xl border border-secondary/50 bg-secondary/10 p-7 md:p-10 space-y-4" aria-labelledby="jev-heading">
        <p className="text-secondary text-sm font-semibold uppercase tracking-wide">Compare alternatives</p>
        <h2 id="jev-heading" className="text-3xl font-semibold">Results evaluated with Jev</h2>
        <p className="text-muted-foreground max-w-3xl">When at least two assistants return valid results, Jev evaluates them and returns a selected candidate with relative probabilities. Every generated result remains available, so you can make the final choice.</p>
        <Link href="/text-ai-assistants" className="inline-flex items-center gap-2 text-secondary font-semibold hover:underline">Try a workflow <ArrowRight className="h-4 w-4" /></Link>
      </section>
    </div>
  );
}
