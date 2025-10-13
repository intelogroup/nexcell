# 🧠 Nexcel - AI Spreadsheet Assistant

An AI-powered spreadsheet application that enables users to edit and analyze spreadsheets through natural language chat interactions.

## 🚀 Features

- **Natural Language Interface**: Chat with your spreadsheet using plain English
- **Real-time Calculations**: Powered by HyperFormula engine
- **AI-Driven Actions**: Intelligent suggestions and automated operations
- **Secure Authentication**: Clerk-based user management
- **Modern UI**: React + Vite with virtualized grid rendering

## 🏗️ Architecture

This is a monorepo containing:

- **Frontend** (`apps/frontend`): React + Vite + TypeScript
- **Backend** (`apps/backend`): Fastify API server
- **Shared** (`packages/shared`): Common types and utilities

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL database (Neon recommended)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nexcell
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
pnpm db:generate
pnpm db:push
```

5. Start development servers:
```bash
pnpm dev
```

## 📦 Scripts

- `pnpm dev` - Start all development servers
- `pnpm build` - Build all packages
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all packages
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:push` - Push database schema
- `pnpm db:studio` - Open Prisma Studio

## 🔧 Tech Stack

### Frontend
- React 18
- Vite
- TypeScript
- TanStack Virtual (grid virtualization)
- Zustand (state management)
- Tailwind CSS + shadcn/ui

### Backend
- Fastify
- Prisma ORM
- Neon PostgreSQL
- Clerk Authentication
- HyperFormula (spreadsheet engine)

### AI Integration
- OpenAI GPT / Anthropic Claude
- Server-Sent Events for streaming
- Intent classification and validation

## 🎯 Current Status

**✅ Phase 1 Complete** - Core functionality implemented and verified (Oct 12, 2025)

### What Works Now
- ✅ User authentication (Clerk + DB sync)
- ✅ Workbook CRUD operations (Create, Read, Update, Delete)
- ✅ Spreadsheet grid with virtualization (5000 rows × 100 cols)
- ✅ Formula support via HyperFormula engine
- ✅ Real-time formula bar editing
- ✅ Auto-save with unsaved changes protection
- ✅ Template system (5 official templates)
- ✅ Credits tracking for AI usage

### What's Next (Phase 2)
- [ ] Comprehensive error handling & user feedback
- [ ] Backend health checks & monitoring
- [ ] Automated testing (unit + E2E)
- [ ] CI/CD pipeline
- [ ] AI natural language integration
- [ ] Credit audit logging
- [ ] Performance optimization

See [EXPERT_REVIEW_REPORT.md](./docs/EXPERT_REVIEW_REPORT.md) for detailed implementation status.

## 📋 Development Phases

- [x] **Phase 1**: Foundation Setup ✅
- [x] **Phase 2**: Core Data Layer ✅
- [x] **Phase 3**: HyperFormula Integration ✅
- [x] **Phase 4**: Basic UI Components ✅
- [ ] **Phase 5**: AI Integration (In Progress)
- [ ] **Phase 6**: Action System
- [ ] **Phase 7**: Performance & Security
- [ ] **Phase 8**: Testing & Deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details