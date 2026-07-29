export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center md:text-left" suppressHydrationWarning>
            © {currentYear} AI Text Enhancer. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="/about"
              className="hover:text-foreground transition-colors"
            >
              About
            </a>
            {/* <a
              href="/contact"
              className="hover:text-foreground transition-colors"
            >
              Contact
            </a> */}
          </div>
        </div>
      </div>
    </footer>
  );
}
