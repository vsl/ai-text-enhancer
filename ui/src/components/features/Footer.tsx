import { SITE_CONFIG } from '@/config/site.config';
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="content-grid flex items-center justify-between gap-4 py-6">
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          © {currentYear} AI Text Enhancer
        </p>
        <a
          href={SITE_CONFIG.repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
