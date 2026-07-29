# Documentation Index

Welcome to the AI Text Enhancer documentation. This index provides quick navigation to all project documentation, optimized for both developers and AI assistants.

## Quick Links

- **[Architecture](./architecture.md)** - Project structure, state management patterns, component hierarchy, and file organization
- **[Development Guide](./development-guide.md)** - Setup instructions, available commands, common patterns, and coding conventions
- **[API Integration](./api-integration.md)** - Backend API endpoints, authentication, request/response formats, and integration guide
- **[Testing](./testing.md)** - Testing strategy, commands, organization, and best practices
- **[Deployment](./deployment.md)** - Cloudflare Pages deployment guide

## Documentation Overview

### For Developers

**Getting Started:**
1. Start with [Development Guide](./development-guide.md) for setup and commands
2. Read [Architecture](./architecture.md) to understand the codebase structure
3. Review [Testing](./testing.md) for testing practices

**Building Features:**
1. Understand state management patterns in [Architecture](./architecture.md)
2. Follow common patterns in [Development Guide](./development-guide.md)
3. Integrate with backend using [API Integration](./api-integration.md)

**Deployment:**
1. Follow [Deployment](./deployment.md) for Cloudflare Pages deployment

### For AI Assistants

**Context Hierarchy** (load in this order for optimal token usage):
1. **[Development Guide](./development-guide.md)** - Commands and common patterns (lightweight)
2. **[Architecture](./architecture.md)** - Structure and state management (moderate)
3. **[API Integration](./api-integration.md)** - Backend integration details (moderate)
4. **[Testing](./testing.md)** - Testing approach (lightweight)

**Quick Reference:**
- File locations and purposes → [Architecture](./architecture.md)
- State management and patterns → [Architecture](./architecture.md)
- Adding features → [Development Guide](./development-guide.md)
- API endpoints and auth → [API Integration](./api-integration.md)
- Running tests → [Testing](./testing.md)

## Document Descriptions

### architecture.md
Comprehensive overview of the project structure including:
- Folder organization and purpose of each package
- Key files and their responsibilities
- State management pattern (Context + localStorage)
- Component hierarchy and data flow
- Authentication system architecture
- Type system and configuration constants

### development-guide.md
Practical guide for daily development:
- Environment setup and prerequisites
- Available npm commands (dev, build, test)
- Import path conventions (@/ alias)
- Styling guidelines (Tailwind CSS)
- Common patterns (adding features, modifying state)
- Code organization best practices

### api-integration.md
Backend integration documentation:
- Authentication flow (JWT, OAuth, anonymous users)
- Tier system and quota limits
- API endpoints and request/response formats
- Error handling and error codes
- Environment variables
- Quick start guide with code examples

### testing.md
Testing strategy and practices:
- Test organization (unit, integration, e2e)
- Running tests (commands and options)
- Writing tests (patterns and best practices)
- Coverage targets and requirements
- Test data attributes and selectors

### deployment.md
Production deployment instructions:
- GitHub Actions workflow
- Environment variable configuration
- Build and deployment process
- Verification steps

## Related Documentation

- **[Main README](../README.md)** - User-facing project overview, features, and quick start
- **[CLAUDE.md](../CLAUDE.md)** - AI assistant instructions and project context (references this index)

## Active Task Lists

Task tracking files are located in the `planning/` folder:
- `planning/ui-ux-improvements.md` - UI/UX enhancement tasks
- `planning/me-endpoint-migration.md` - Backend migration tasks
- `planning/anonymous-users.md` - Anonymous user feature implementation
