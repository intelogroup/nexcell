# 🌐 NexCell Codebase Access Guide

This document provides all methods for accessing the NexCell codebase programmatically, ideal for AI assistants like Claude.

## ✅ Repository Status
- **Repository**: [intelogroup/nexcell](https://github.com/intelogroup/nexcell)
- **Visibility**: **PUBLIC** ✅
- **Default Branch**: `main`
- **Language**: TypeScript

---

## 🔗 Access Methods

### 1. GitHub Raw URLs (Direct File Access)
Access any file directly via raw content URLs:

**Format:**
```
https://raw.githubusercontent.com/intelogroup/nexcell/main/[file-path]
```

**Examples:**
```
# Root files
https://raw.githubusercontent.com/intelogroup/nexcell/main/package.json
https://raw.githubusercontent.com/intelogroup/nexcell/main/README.md

# Backend files
https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/backend/src/index.ts
https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/backend/package.json
https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/backend/prisma/schema.prisma

# Frontend files
https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/frontend/src/App.tsx
https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/frontend/package.json
https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/frontend/src/hooks/useChat.ts

# Documentation
https://raw.githubusercontent.com/intelogroup/nexcell/main/docs/SDS.md
https://raw.githubusercontent.com/intelogroup/nexcell/main/docs/PRD.md
https://raw.githubusercontent.com/intelogroup/nexcell/main/docs/TRD.md

# Repomix compressed codebase
https://raw.githubusercontent.com/intelogroup/nexcell/main/repomix/nexcell-codebase.xml
```

---

### 2. GitHub API (Programmatic Access)

#### Get Repository Information
```bash
curl https://api.github.com/repos/intelogroup/nexcell
```

#### List All Files (Recursive Tree)
```bash
curl https://api.github.com/repos/intelogroup/nexcell/git/trees/main?recursive=1
```

#### Get Single File Content
```bash
curl https://api.github.com/repos/intelogroup/nexcell/contents/package.json
```

**Response includes:**
- `content`: Base64 encoded file content
- `download_url`: Direct raw file URL
- `sha`: Git SHA hash
- `size`: File size in bytes

#### Get Directory Contents
```bash
curl https://api.github.com/repos/intelogroup/nexcell/contents/apps/backend/src
```

---

### 3. Git Clone (Full Codebase)
```bash
# HTTPS
git clone https://github.com/intelogroup/nexcell.git

# SSH
git clone git@github.com:intelogroup/nexcell.git
```

---

## 📦 Compressed Codebase

### Repomix XML (Recommended for AI)
The entire codebase is compressed into a single XML file optimized for AI consumption:

**URL:**
```
https://raw.githubusercontent.com/intelogroup/nexcell/main/repomix/nexcell-codebase.xml
```

**Stats:**
- 124 files
- 184,681 tokens
- 753,609 characters
- Includes all source code, docs, and configs

**Usage in Claude:**
1. Reference the URL in your prompt
2. Claude can fetch and analyze the entire codebase
3. Ideal for context-aware code generation and analysis

---

## 🎯 Quick Access by Section

### Backend
```
Base: https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/backend/

- src/index.ts (entry point)
- src/config/index.ts (configuration)
- src/routes/ (API endpoints)
- src/services/ (business logic)
- src/middleware/ (auth, credits)
- prisma/schema.prisma (database schema)
```

### Frontend
```
Base: https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/frontend/

- src/App.tsx (main app)
- src/main.tsx (entry point)
- src/components/ (UI components)
- src/hooks/ (React hooks)
- src/pages/ (page components)
- src/stores/ (state management)
- src/services/ (API clients)
```

### Documentation
```
Base: https://raw.githubusercontent.com/intelogroup/nexcell/main/docs/

- PRD.md (Product Requirements)
- SDS.md (System Design Specification)
- TRD.md (Technical Requirements)
- FRD.md (Functional Requirements)
- IMPLEMENTATION_PLAN.md (Implementation roadmap)
```

---

## 💡 Tips for AI Assistants

### For Claude/ChatGPT
1. **Single File**: Use GitHub raw URLs
   ```
   Analyze this file: https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/backend/src/index.ts
   ```

2. **Full Codebase**: Use repomix XML
   ```
   Review the entire codebase: https://raw.githubusercontent.com/intelogroup/nexcell/main/repomix/nexcell-codebase.xml
   ```

3. **Multiple Files**: List specific URLs
   ```
   Compare these files:
   - https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/backend/package.json
   - https://raw.githubusercontent.com/intelogroup/nexcell/main/apps/frontend/package.json
   ```

### Rate Limits
- **Authenticated**: 5,000 requests/hour
- **Unauthenticated**: 60 requests/hour
- **Raw content**: No rate limits for public repos

---

## 🚀 Next Steps

### Optional Enhancements
1. **GitHub Pages**: Enable for browsable HTML interface
2. **Vercel Deployment**: Deploy with custom domain and search
3. **Documentation Site**: Auto-generated docs with Docusaurus
4. **API Endpoint**: Custom REST API for file access

---

## 📊 Repository Statistics

- **Total Files**: 127
- **Total Lines**: 31,848
- **Languages**: TypeScript, JavaScript, Markdown
- **Framework**: React (Frontend), Hono (Backend)
- **Database**: PostgreSQL with Prisma
- **Auth**: Clerk

---

## 🔐 Access Control

Current status: **Public** (no authentication required)

To restrict access:
1. Make repository private
2. Use Personal Access Tokens (PAT)
3. Set up GitHub Apps with custom permissions

---

## 📝 Maintenance

This document is automatically updated when:
- New files are added
- Codebase structure changes
- Repomix XML is regenerated

Last updated: October 13, 2025
