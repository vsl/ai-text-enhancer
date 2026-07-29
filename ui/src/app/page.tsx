import Link from "next/link";
import { ArrowRight, Sparkles, Zap, Shield } from "lucide-react";

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          <span>Powered by Advanced AI</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
          AI Text Enhancer
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
          Transform your text with powerful AI assistants. Summarize, translate, 
          correct grammar, and enhance your writing with cutting-edge technology.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/text-ai-assistants"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
          >
            Get Started
            <ArrowRight className="h-5 w-5" />
          </Link>
          
          <Link
            href="/about"
            className="inline-flex items-center gap-2 px-8 py-4 bg-card hover:bg-muted border border-border text-foreground font-semibold rounded-lg transition-colors"
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
          <p className="text-muted-foreground">
            Get instant results with our optimized AI models. Process your text in seconds.
          </p>
        </div>

        <div className="p-6 bg-card border border-border rounded-lg hover:border-secondary/50 transition-colors">
          <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-secondary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Multiple AI Tools</h3>
          <p className="text-muted-foreground">
            Access 8+ AI assistants: summarize, translate, grammar check, and more.
          </p>
        </div>

        <div className="p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Privacy Focused</h3>
          <p className="text-muted-foreground">
            Your data is secure. We process your text with enterprise-grade security.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-border rounded-2xl p-12 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Ready to enhance your text?
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Join thousands of users who trust AI Text Enhancer for their writing needs.
        </p>
        <Link
          href="/text-ai-assistants"
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary-hover text-primary-foreground font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg"
        >
          Try It Now
          <ArrowRight className="h-5 w-5" />
        </Link>
      </section>
    </div>
  );
}

