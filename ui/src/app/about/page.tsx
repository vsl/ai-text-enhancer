import { Sparkles, Target, Users, Zap } from "lucide-react";

export default function About() {
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">About AI Text Enhancer</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Empowering writers and professionals with cutting-edge AI technology
        </p>
      </div>

      {/* Mission Section */}
      <section className="mb-16">
        <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-3xl font-bold">Our Mission</h2>
          </div>
          <p className="text-lg text-muted-foreground leading-relaxed">
            We believe that everyone deserves access to powerful writing tools. AI Text Enhancer 
            was created to democratize access to advanced AI language models, making it easy for 
            anyone to improve their writing, communicate more effectively, and save time on 
            text-related tasks.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid md:grid-cols-2 gap-8 mb-16">
        <div className="bg-card border border-border rounded-xl p-8">
          <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-secondary" />
          </div>
          <h3 className="text-2xl font-semibold mb-3">Advanced AI Models</h3>
          <p className="text-muted-foreground">
            We leverage state-of-the-art AI language models to provide accurate, 
            context-aware text enhancements across multiple languages and use cases.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-2xl font-semibold mb-3">Lightning Fast</h3>
          <p className="text-muted-foreground">
            Our optimized infrastructure ensures you get results in seconds, 
            not minutes. No more waiting around for your text to be processed.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8">
          <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-secondary" />
          </div>
          <h3 className="text-2xl font-semibold mb-3">User-Centric Design</h3>
          <p className="text-muted-foreground">
            Built with simplicity in mind. Our intuitive interface makes it easy 
            for anyone to enhance their text, regardless of technical expertise.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-2xl font-semibold mb-3">Versatile Tools</h3>
          <p className="text-muted-foreground">
            From summarization to translation, grammar correction to paraphrasing - 
            we offer a comprehensive suite of AI assistants for all your needs.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-border rounded-2xl p-12 text-center">
        <h2 className="text-3xl font-bold mb-8">Trusted by Users Worldwide</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="text-4xl font-bold text-primary mb-2">1M+</div>
            <div className="text-muted-foreground">Texts Enhanced</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-secondary mb-2">50+</div>
            <div className="text-muted-foreground">Languages Supported</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
            <div className="text-muted-foreground">Accuracy Rate</div>
          </div>
        </div>
      </section>
    </div>
  );
}
