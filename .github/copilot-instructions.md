# BrandForge - Copilot Instructions

BrandForge is an AI-powered marketing content and visual asset engine that generates campaign-driven copy and renders it as high-resolution PNG images using HTML/CSS templates.

## Build, Test, and Run Commands

### Full Stack (Docker)

**Start all services:**
```bash

```

**Stop services:**
```bash
docker compose down
```

**Full reset (removes volumes):**
```bash
docker compose down -v
```

**View logs:**
```bash
docker compose logs -f backend    # Backend logs
docker compose logs -f frontend   # Frontend logs
```

### Backend (NestJS)

**Development:**
```bash
cd backend
npm run start:dev          # Watch mode
npm run start:debug        # Debug mode
```

**Build:**
```bash
npm run build
```

**Production:**
```bash
npm run start:prod
```

**Database migrations:**
```bash
npm run migration:generate -- src/database/migrations/MigrationName
npm run migration:run
npm run migration:revert
```

### Frontend (React + Vite)

**Development:**
```bash
cd frontend
npm run dev                # Dev server at localhost:5173
```

**Build:**
```bash
npm run build              # TypeScript compilation + Vite build
```

**Preview:**
```bash
npm run preview            # Preview production build
```

## Architecture

BrandForge is a multi-tier Docker application with:

### Services

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS (port 5173)
- **Backend**: NestJS 10 + TypeScript + TypeORM (port 3000)
- **PostgreSQL**: Data persistence (port 5432)
- **Redis**: Queue infrastructure with BullMQ (port 6379)

### Backend Module Structure

The backend is organized into feature modules:

1. **campaigns/** - Campaign CRUD, campaign-level metadata (objective, audience, industry, brand voice)
2. **content/** - Post CRUD, version history, favorites, version restore
3. **generation/** - OpenAI integration for content generation and refinement
4. **render/** - Puppeteer-based HTML → PNG rendering pipeline
5. **templates/** - Template registry with platform/dimension metadata
6. **brand-assets/** - Logo uploads, global brand configuration (colors, fonts, design presets)

### Frontend Structure

```
frontend/src/
  pages/          # Route-level components (Dashboard, Campaign, Generate, etc.)
  components/     # Reusable UI components
  api/            # Axios API client functions
  types.ts        # Shared TypeScript types
```

### Data Flow

1. User creates campaign with strategic context (objective, audience, value proposition)
2. User generates content variants via `/generation/generate` (1-5 variants per request)
3. OpenAI returns structured JSON content (hook, headline, body, CTA, caption, etc.)
4. Backend saves ContentPost + ContentVersion snapshot
5. User refines content with natural language instructions via `/generation/refine`
6. User previews HTML by selecting a template
7. User exports PNG via Puppeteer rendering with injected brand tokens
8. Browser downloads final high-res image

## Key Conventions

### TypeORM Entities

- **Campaign** → ContentPost (one-to-many via `campaignId`)
- **ContentPost** → ContentVersion (one-to-many, tracks refinement history)
- **BrandConfig** (single global row) → BrandAsset (one-to-many for logos/fonts)

All entities use UUID primary keys except BrandConfig (uses integer for singleton pattern).

### Content Structure

Every `ContentPost` includes these fields:

- **Platform**: `instagram_feed_1x1`, `instagram_feed_4x5`, `linkedin_post`
- **MarketingAngle**: `educational`, `storytelling`, `direct_sale`, `authority`, `social_proof`, `pain_agitate_solve`
- **Content slots**: `hook`, `headline`, `subheadline`, `body`, `cta`, `caption`, `painPoint`, `valueProposition`, `tone`
- **Version tracking**: `currentVersion` (integer), `versions` (relation to ContentVersion snapshots)

### Template System

Templates live in `/templates/{platform}/` as standalone HTML files.

The render pipeline:

1. Reads template HTML file
2. Injects Google Fonts links for `headingFont` and `bodyFont`
3. Injects CSS design tokens via `<style>` block (colors, fonts, design preset variables)
4. Replaces content slots: `{{hook}}`, `{{headline}}`, `{{body}}`, `{{cta}}`, `{{logo}}`, etc.
5. Escapes HTML content before slot insertion (security)
6. Renders in headless Chromium with viewport matching template dimensions
7. Saves PNG to `rendered/` volume
8. Returns URL for browser download

**Design presets** (`minimal`, `bold`, `corporate`, `creative`, `elegant`, `modern`) alter CSS tokens like border radius, shadows, gradients, glassmorphism, and spacing scale.

### Validation and DTOs

- Backend uses `ValidationPipe({ whitelist: true, transform: true })` globally
- DTOs use `class-validator` decorators (`@IsNotEmpty`, `@IsEnum`, `@IsOptional`, etc.)
- Multipart uploads use Multer with size limit 10MB
- Supported image formats: PNG, JPG, SVG, WEBP

### Environment Variables

Required for backend:

- `OPENAI_API_KEY` - Must be valid or generation/refinement fails
- `OPENAI_MODEL` - Defaults to `gpt-4o`
- `POSTGRES_*` - Database connection (defaults work with Docker Compose)
- `REDIS_*` - Queue connection (defaults work with Docker Compose)
- `RENDER_CONCURRENCY` - Puppeteer job concurrency (default: 3)

Frontend needs:

- `VITE_API_URL` - Backend API base URL (default: `http://localhost:3000/api`)

### Development Volumes

Docker Compose mounts these volumes for hot-reload:

- `./backend/src` → `/app/src`
- `./frontend/src` → `/app/src`
- `./templates` → `/app/templates`
- `uploads/` (Docker volume)
- `rendered/` (Docker volume)

Changes to source files or templates reflect immediately without rebuilding images.

### API Documentation

- **Swagger UI**: `http://localhost:3000/api/docs`
- **Base URL**: `http://localhost:3000/api`

Main route groups: `/campaigns`, `/content`, `/generation`, `/templates`, `/render`, `/brand-assets`

## Generation Behavior

### Marketing Angle Selection

If no `marketingAngle` is forced in the generation request, the backend selects one automatically based on campaign `objective`:

- `awareness` → `educational` or `storytelling`
- `lead_generation` → `pain_agitate_solve` or `authority`
- `conversion` → `direct_sale` or `social_proof`
- `engagement` → `storytelling` or `social_proof`

### Refinement Chat Loop

`POST /generation/refine` accepts:

- `postId` (UUID)
- `instruction` (natural language prompt like "Make it more urgent")

The backend:

1. Loads current post version
2. Composes refinement prompt with campaign context + current content + user instruction
3. Calls OpenAI structured output
4. Increments `currentVersion`
5. Creates new ContentVersion snapshot
6. Updates ContentPost fields
7. Returns updated post

History is preserved and can be restored via `POST /content/:id/versions/:versionNumber/restore`.

## Common Pitfalls

- **Generation fails**: Check `OPENAI_API_KEY` is set and valid. Check backend logs for rate limit errors.
- **PNG export downloads empty file**: Verify backend is healthy and Puppeteer dependencies installed. Rebuild backend image if needed.
- **Templates not updating**: Templates are volume-mounted; changes should reflect immediately. If not, restart backend container.
- **Port conflicts**: Default ports are 3000 (backend), 5173 (frontend), 5432 (postgres), 6379 (redis). Change in `.env` and `docker-compose.yml` if conflicts occur.
- **Database schema drift**: TypeORM runs with `synchronize: true` in development. For production or complex schema changes, use migrations.

## Tech Stack Reference

### Backend Dependencies

- **NestJS 10**: Framework
- **TypeORM 0.3**: ORM with PostgreSQL
- **BullMQ 5**: Redis-based job queues
- **OpenAI SDK 4**: AI content generation
- **Puppeteer Core 23**: Headless Chromium rendering
- **Class Validator/Transformer**: DTO validation
- **Multer**: File upload handling
- **Swagger**: API documentation

### Frontend Dependencies

- **React 18**: UI framework
- **React Router 6**: Client-side routing
- **Axios**: HTTP client
- **Tailwind CSS 3**: Utility-first styling
- **Lucide React**: Icon library
- **Vite 5**: Build tool and dev server

## Useful File Paths

```
backend/src/
  campaigns/entities/campaign.entity.ts       # Campaign data model
  content/entities/content-post.entity.ts     # Post data model
  content/entities/content-version.entity.ts  # Version snapshot model
  brand-assets/entities/brand-config.entity.ts # Global brand config
  generation/openai.service.ts                 # OpenAI integration
  render/render.service.ts                     # Puppeteer PNG rendering

frontend/src/
  pages/Dashboard.tsx                          # Campaign list page
  pages/Campaign.tsx                           # Post grid for campaign
  pages/Generate.tsx                           # Content generation form
  pages/PostDetail.tsx                         # Refinement chat + preview
  pages/BrandKit.tsx                           # Global brand editor
  api/                                         # Axios API wrappers

templates/
  instagram-feed-1x1/                          # 1080x1080 templates
  instagram-feed-4x5/                          # 1080x1350 templates
  linkedin-horizontal/                         # 1200x628 templates
```
