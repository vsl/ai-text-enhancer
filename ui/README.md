# AI Text Enhancer

A modern, full-featured AI text enhancement application that helps you improve, rewrite, and optimize text using multiple AI assistants with customizable configurations.

## 🚀 Live Demo

The application is deployed from the monorepo root to Cloudflare Pages.

## ✨ Features

### Core Functionality
- **Multi-Assistant Text Enhancement**: Process text through multiple AI assistants simultaneously
- **Customizable Workflows**: Create, manage, and switch between different workflow configurations
- **Real-time Configuration**: Add, edit, duplicate, and remove AI assistants on the fly
- **Multiple AI Models**: Support for GPT-4, Claude, and more
- **Flexible Enhancement Options**:
  - Improve text quality
  - Fix grammar and spelling mistakes
  - Format and structure text
  - Shorten or lengthen content
  - Add emojis
  - Adjust tone and formality
  - Translate to different languages

### User Experience
- **Dark/Light Theme**: Built-in theme switcher with persistent preference
- **Responsive Design**: Fully optimized for desktop, tablet, and mobile devices
- **Real-time Results**: See AI-generated results as they complete
- **Copy to Clipboard**: Quickly copy enhanced text with one click
- **Iterative Improvement**: Use any result as input for further enhancement
- **Persistent State**: Automatic localStorage persistence for workflows and configurations

### UI/UX Highlights
- Clean, modern interface with intuitive controls
- Visual config summary tags with emoji indicators
- Loading states and error handling
- Smooth animations and transitions
- Accessible components built with Radix UI primitives

## Technology Stack

### Core Technologies
- **Framework**: [Next.js 15.5.4](https://nextjs.org/) with App Router
- **React**: Version 19.1.0
- **TypeScript**: Version 5
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)

### UI & Components
- **Component Library**: [shadcn/ui](https://ui.shadcn.com/) (New York style, Neutral theme)
- **UI Primitives**: Radix UI
- **Icons**: [Lucide React](https://lucide.dev/)
- **Theming**: [next-themes](https://github.com/pacocoursey/next-themes)

### Testing
- **Unit Testing**: [Jest](https://jestjs.io/) + [React Testing Library](https://testing-library.com/react)
- **E2E Testing**: [Playwright](https://playwright.dev/)
- **Test Coverage**: >90% for critical paths

### Development Tools
- **Build Tool**: Turbopack (development mode)
- **Package Manager**: npm
- **Linting**: TypeScript strict mode
- **Version Control**: Git

### Development Tools
- **Build Tool**: Turbopack (development mode)
- **Package Manager**: npm
- **Linting**: TypeScript strict mode
- **Version Control**: Git

## 📦 Installation

### Prerequisites
- Node.js 22.x
- npm 10.x or later

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone git@github-personal:vsl/ai-text-enhancer.git
   cd ai-text-enhancer/ui
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Playwright browsers** (for E2E tests)
   ```bash
   npx playwright install --with-deps
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Environment Variables

### Local Development

For local development, create a `.env.local` file in the root directory with your Supabase credentials:

```bash
NEXT_PUBLIC_APP_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_APP_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_API_BASE_URL=https://your-project.supabase.co/functions/v1
```

**Note**: The `.env.local` file is git-ignored for security. See `.env.local.example` for reference.

### Cloudflare Pages

Configure these variables for both Production and Preview in Cloudflare Pages.
Production uses production Supabase values; Preview uses staging Supabase
values:

- `NEXT_PUBLIC_APP_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_APP_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `NEXT_PUBLIC_API_BASE_URL` - Your Supabase Functions URL

See [docs/deployment.md](docs/deployment.md) for the complete Pages settings.

## 📝 Available Scripts

### Development
```bash
npm run dev          # Start development server with Turbopack
```

### Building
```bash
npm run build        # Create optimized production build (static export)
npm run start        # Start production server (not used for static export)
```

### Testing
```bash
# Unit Tests
npm run test              # Run all unit tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report

# E2E Tests
npm run test:e2e          # Run Playwright tests (headless)
npm run test:e2e:ui       # Run tests in Playwright UI mode
npm run test:e2e:headed   # Run tests with browser visible
```

## 🧪 Testing

### Unit Tests
- Location: `__tests__/unit/`
- Framework: Jest + React Testing Library
- Coverage: >90% for core logic
- Run: `npm run test`

### Integration Tests
- Location: `__tests__/integration/`
- Focus: Component interactions and modals
- Run: `npm run test`

### E2E Tests
- Location: `e2e/`
- Framework: Playwright
- Coverage: Full user journeys
- Browsers: Chromium, Firefox, WebKit
- Run: `npm run test:e2e`

### Test Coverage
Generate a detailed coverage report:
```bash
npm run test:coverage
```
Open `coverage/lcov-report/index.html` to view the report.

## 📁 Project Structure

```
ui/
├── src/                          # All source code
│   ├── app/                      # Next.js App Router pages
│   │   ├── contact/              # Contact page
│   │   ├── text-ai-assistants/   # Main application page
│   │   ├── layout.tsx            # Root layout with theme provider
│   │   ├── page.tsx              # Home page
│   │   └── globals.css           # Global styles
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui primitives
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── select.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── textarea.tsx
│   │   │   └── tooltip.tsx
│   │   └── features/             # Business logic components
│   │       ├── ConfigEditorModal.tsx     # Assistant configuration editor
│   │       ├── ConfigSummaryTags.tsx     # Display active config options
│   │       ├── ConfirmationModal.tsx     # Delete confirmation dialog
│   │       ├── CreateWorkflowModal.tsx   # New workflow creation
│   │       ├── Footer.tsx                # Footer component
│   │       ├── Header.tsx                # Header with navigation
│   │       ├── InfoTooltip.tsx           # Info icon with tooltip
│   │       ├── LoadingSpinner.tsx        # Loading animation
│   │       ├── ResultTextarea.tsx        # Auto-resizing textarea
│   │       ├── ThemeProvider.tsx         # Theme context provider
│   │       ├── ToggleSwitch.tsx          # Toggle switch component
│   │       └── index.ts                  # Component exports
│   ├── context/                  # React Context
│   │   └── WorkflowContext.tsx   # Global state management
│   ├── hooks/                    # Custom React hooks
│   │   └── useLocalStorage.ts    # SSR-safe localStorage hook
│   └── lib/                      # Utilities and constants
│       ├── constants.ts          # App-wide constants
│       ├── types.ts              # TypeScript type definitions
│       └── utils.ts              # Utility functions
├── __tests__/                    # Test suites
│   ├── unit/                     # Unit tests
│   └── integration/              # Integration tests
├── e2e/                          # End-to-end tests
│   ├── assistant-config.spec.ts
│   ├── enhancement-flow.spec.ts
│   ├── navigation.spec.ts
│   ├── theme-toggle.spec.ts
│   └── workflow-management.spec.ts
├── public/                       # Static assets
├── jest.config.js                # Jest configuration
├── playwright.config.ts          # Playwright configuration
├── next.config.ts                # Next.js configuration
└── tsconfig.json                 # TypeScript configuration
```

**Import Convention**: All imports use the `@/` alias which maps to `src/`
- Example: `import { Button } from '@/components/ui/button'`
- Example: `import { useWorkflow } from '@/context/WorkflowContext'`

## 🚀 Deployment

### Cloudflare Pages

Cloudflare Pages builds this directory from the monorepo `main` branch.

**Deployment Process**:
1. Push a UI change to `main`
2. GitHub Actions runs the UI test and build checks
3. Cloudflare runs `npm run build` in `ui/`
4. Cloudflare publishes `ui/out/`

Set the Cloudflare build-watch include path to `ui/*` and exclude path to
`ui/*.md` so backend and documentation changes do not trigger deployments.

**Manual Deployment**:
```bash
# Build the static site
npm run build

# The output will be in the `out/` directory
# Deploy the `out/` directory to any static hosting service
```

### Other Hosting Options

The static export in the `out/` directory can be deployed to:
- **Netlify**: Drag and drop the `out/` folder
- **Vercel**: Connect your GitHub repo
- **AWS S3**: Upload to an S3 bucket
- **Cloudflare Pages**: Connect your GitHub repo
- **Any static hosting service**

## Build Configuration

### Static Export
The project is configured for static export in `next.config.ts`:

```typescript
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
};
```

This generates a fully static site in the `out/` directory that can be served by any static hosting service.

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run test && npm run test:e2e`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Standards
- Follow TypeScript strict mode
- Use Tailwind CSS for styling (no custom CSS)
- Write tests for new features
- Maintain >90% test coverage
- Use meaningful commit messages
- Document complex logic

### Pull Request Guidelines
- Describe your changes clearly
- Include screenshots for UI changes
- Ensure all tests pass
- Update documentation if needed
- Keep changes focused and atomic

## 📄 License

This project is private and not licensed for public use.

## 🙏 Acknowledgments

- **Original Application**: Migrated from a single-page React application
- **UI Framework**: Built with [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: Provided by [Lucide](https://lucide.dev/)
- **Hosting**: Cloudflare Pages static export.
