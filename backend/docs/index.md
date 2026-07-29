# AI Text Enhancer Backend - Documentation

> **Complete documentation hub** for the AI Text Enhancer Backend. This serverless backend abstracts prompt engineering complexity, manages user quotas, controls tier-based access, and processes batches of enhancement requests in parallel across multiple LLM providers.

**Last Updated:** January 2025
**Project Status:** Active Development

---

## Quick Navigation

### Getting Started
Start here if you're new to the project or setting up your development environment.

- **[Getting Started](./getting-started.md)** - Quick setup guide, prerequisites, first API call
- **[Configuration](./configuration.md)** - Environment variables, Supabase setup, config modules
- **[Testing](./testing.md)** - Unit tests, test users, testing scenarios, coverage

### Core Documentation
Deep-dive into the system architecture and design.

- **[Architecture](./architecture.md)** - Two-layer design, request flow, key patterns, portability
- **[Project Structure](./project-structure.md)** - Complete code organization, packages, file purposes
- **[API Reference](./api-reference.md)** - Complete API specification, schemas, error codes, examples

### Developer Resources
Guides for implementing features and extending the system.

- **[Developer Guides](./developer-guides.md)** - How to add models, roles, providers, and features
- **[Payment System](./payment.md)** - Stripe integration, token purchases, webhook handling
- **[Deployment](./deployment.md)** - Local and production deployment, GitHub Actions CI/CD
- **[Known Issues](./known-issues.md)** - Technical debt, limitations, future improvements

### Platform Migration
Guides for migrating to different cloud platforms.

- **[Migration Overview](./migration/OVERVIEW.md)** - Migration strategy and timeline
- **[AWS Lambda](./migration/AWS_LAMBDA.md)** - AWS Lambda migration guide (4-8 hours)
- **[Cloudflare Workers](./migration/CLOUDFLARE_WORKERS.md)** - Cloudflare Workers migration guide (6-10 hours)

---

## What Makes This Project Different

This is **not a simple LLM wrapper**—it's an intelligent engine designed with **platform portability** as the core principle:

- **Two-Layer Architecture** - 36-line handler + platform-agnostic core logic
- **4-8 Hour Migration** - Switch to AWS Lambda, Cloudflare Workers, or other platforms by rewriting only the thin handler layer
- **Intelligent Batch Processing** - Process 1-10 enhancement requests in parallel with partial success pattern
- **Tier-Based Access Control** - Free, Plus, and Premium tiers with different limits
- **Token-Based Quotas** - Wallet/credits model instead of daily limits
- **Anonymous User Support** - Start using without email/password signup

---

## Documentation Map

### 1. [Getting Started](./getting-started.md)
**For:** New developers, first-time setup
**Time:** 15-20 minutes
**Contents:**
- Prerequisites (Node.js, Supabase CLI, API keys)
- Quick setup (5-10 steps to first API call)
- Project overview and key concepts
- Next steps and learning path

### 2. [Project Structure](./project-structure.md)
**For:** Understanding code organization
**Time:** 30 minutes
**Contents:**
- Visual project tree
- Folder-by-folder breakdown (src/, supabase/functions/, tests/)
- File purposes and responsibilities
- Package descriptions (services, connectors, repositories, config, etc.)
- Import/export patterns

### 3. [Configuration](./configuration.md)
**For:** Environment setup and configuration management
**Time:** 20 minutes
**Structure:** Tiered (Quick Reference + Deep Dive)
**Contents:**
- **Quick Reference**: Environment variables table, Supabase credentials, setup commands
- **Deep Dive**: Configuration modules (models, roles, quota), adding new models/roles, platform-specific configs

### 4. [Testing](./testing.md)
**For:** Running tests and manual testing
**Time:** 25 minutes
**Structure:** Tiered (Quick Reference + Deep Dive)
**Contents:**
- **Quick Reference**: Common test commands, running specific tests
- **Deep Dive**: Setup (bootstrap users, credentials), test users with passwords, testing scenarios (auth, quota, tier, admin), writing new tests

### 5. [Deployment](./deployment.md)
**For:** Deploying to local or production environments
**Time:** 30 minutes
**Structure:** Tiered (Quick Reference + Deep Dive)
**Contents:**
- **Quick Reference**: Prerequisites checklist, 5-step deployment, verification commands
- **Deep Dive**: Database migrations, GitHub Actions CI/CD setup, production bootstrap, troubleshooting, monitoring

### 6. [API Reference](./api-reference.md)
**For:** Client/frontend developers, API integration
**Time:** 40 minutes
**Contents:**
- API overview and capabilities
- Authentication (Bearer tokens, user tiers, anonymous users)
- Complete endpoint specifications (POST /enhance, GET /me, Admin endpoints)
- Request/response schemas with field descriptions
- Error codes reference (all 19+ error codes)
- Request/response examples (8+ scenarios)
- Available models and AI roles
- UI integration guides (Next.js, React, etc.)

### 7. [Architecture](./architecture.md)
**For:** Understanding system design and patterns
**Time:** 40 minutes
**Contents:**
- Two-layer architecture (handler vs. core logic)
- Request flow (10-step pipeline with examples)
- Key services and their responsibilities (11 services)
- Key patterns (partial success, timeouts, error handling, quotas)
- Platform portability principles
- Technology stack

### 8. [Developer Guides](./developer-guides.md)
**For:** Implementing features and following conventions
**Time:** 30 minutes
**Contents:**
- How to add new models
- How to add new AI roles
- How to add new LLM providers
- Coding conventions and import patterns
- Error handling patterns
- Testing strategies
- Common development tasks

### 9. [Known Issues](./known-issues.md)
**For:** Understanding limitations and future work
**Time:** 15 minutes
**Contents:**
- Current limitations (token counting, rate limiting, retry logic)
- Technical debt with priority levels
- Future improvements and estimates
- Workarounds for known issues

### 10. [Payment System](./payment.md)
**For:** Understanding token purchases and Stripe integration
**Time:** 35 minutes
**Contents:**
- Payment architecture and flows (two-layer design)
- Token packages configuration (pricing, packages, currencies)
- Stripe Checkout and webhook handling
- Anonymous user restrictions (registered users only)
- Security and idempotency (signature verification, duplicate events)
- Testing strategy (Stripe CLI, test cards, unit tests)
- Deployment checklist (Stripe Dashboard, environment variables)
- Database schema usage (token_purchases table)
- Error handling and refund processing

---

## How to Use This Documentation

### For New Developers
1. Start with [Getting Started](./getting-started.md) to set up your environment
2. Read [Project Structure](./project-structure.md) to understand the codebase
3. Browse [Architecture](./architecture.md) to understand the design
4. Refer to [Developer Guides](./developer-guides.md) when implementing features

### For Frontend/Client Developers
1. Read [API Reference](./api-reference.md) - Sections on authentication and endpoints
2. Review [Payment System](./payment.md) - Token purchase integration and Stripe Checkout
3. Check [Getting Started](./getting-started.md) for local testing setup
4. Review [Known Issues](./known-issues.md) for API limitations
5. Use [Testing](./testing.md) for manual testing with curl examples

### For Backend Developers
1. Read [Architecture](./architecture.md) completely
2. Review [Project Structure](./project-structure.md) to navigate the codebase
3. Follow [Developer Guides](./developer-guides.md) for implementation patterns
4. Review [Payment System](./payment.md) for Stripe integration architecture
5. Check [Known Issues](./known-issues.md) for TODOs and technical debt

### For DevOps/Platform Engineers
1. Read [Architecture](./architecture.md) - Focus on portability and two-layer design
2. Follow [Deployment](./deployment.md) for deployment processes
3. Review [Configuration](./configuration.md) for environment variables
4. Check migration guides for platform-specific instructions

### For AI Assistants (Claude, ChatGPT, etc.)
- Start with [Project Structure](./project-structure.md) and [Architecture](./architecture.md) for comprehensive context
- Refer to [Developer Guides](./developer-guides.md) for coding conventions
- Check [API Reference](./api-reference.md) for complete API contracts
- Review [Known Issues](./known-issues.md) before suggesting improvements
- **Note:** See [CLAUDE.md](../CLAUDE.md) in the root directory for AI-specific instructions

---

## Key Concepts

### Two-Layer Architecture
- **Layer 1 (Handler)**: Platform-specific request/response handling (<100 lines)
- **Layer 2 (Core Logic)**: Platform-agnostic business logic (100% of functionality)
- **Migration Impact**: Rewrite Layer 1 (~4-8 hours), Layer 2 remains unchanged

### User Tiers
- **Free**: 50k tokens welcome bonus, 500 chars userText, 800 chars contextText, 5 batch size
- **Plus**: 500k starting tokens, 2k chars userText, 3k chars contextText, 10 batch size
- **Premium**: 5M starting tokens, 10k chars userText, 15k chars contextText, 10 batch size

### Authentication Methods
- **Email/Password**: Standard authentication with email verification
- **OAuth Providers**: Google, GitHub, Apple, Facebook, Twitter, Azure
- **Anonymous**: No email required, 50k welcome tokens, same free tier limits

### Token Quota System
- Wallet/credits model (not daily limits)
- Pre-flight estimation + post-flight deduction
- Atomic database transactions for balance updates
- Admin API for manual adjustments

---

## Contributing to Documentation

### Standards
- Use Markdown with proper headings (H1 = #, H2 = ##, etc.)
- Include table of contents for docs >200 lines
- Use code fences with language tags (```typescript, ```bash, ```json)
- Keep lines ≤120 characters
- Use **bold** for emphasis, `code` for inline code

### File Naming
- Use kebab-case: `api-reference.md`, `getting-started.md`
- Use descriptive names: `architecture.md` not `arch.md`
- Use .md extension (not .markdown)

### Cross-References
- Use relative paths: `[Architecture](./architecture.md)`
- Always check links work after moving/renaming files
- Reference specific sections: `[Request Flow](./architecture.md#request-flow)`

### When to Update Documentation
- **Code changes**: Update [Architecture](./architecture.md) and [Project Structure](./project-structure.md)
- **API changes**: Update [API Reference](./api-reference.md)
- **New features**: Update [Developer Guides](./developer-guides.md)
- **Bug fixes**: Update [Known Issues](./known-issues.md)
- **Configuration changes**: Update [Configuration](./configuration.md)

---

## Need Help?

- **Quick setup**: Check [Getting Started](./getting-started.md)
- **Commands**: Check [Testing](./testing.md) or [Deployment](./deployment.md)
- **Architecture questions**: Check [Architecture](./architecture.md)
- **API questions**: Check [API Reference](./api-reference.md)
- **Known issues**: Check [Known Issues](./known-issues.md)
- **AI instructions**: Check [CLAUDE.md](../CLAUDE.md)

---

**Project Repository:** [GitHub](https://github.com/your-org/ai-text-enhancer-backend)
**Documentation Issues:** [GitHub Issues](https://github.com/your-org/ai-text-enhancer-backend/issues)
**Last Documentation Audit:** January 2025
