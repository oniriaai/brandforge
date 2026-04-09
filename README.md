# BrandForge

BrandForge is an AI-powered marketing content and visual asset engine.

It is designed for teams that need to move from a campaign idea to production-ready social media creatives fast, while keeping copy quality high and brand identity consistent.

At its core, BrandForge combines:

- AI copy generation and refinement
- Structured campaign context
- Versioned content lifecycle
- HTML/CSS template rendering to high-resolution PNGs
- A global visual Brand Kit (colors, typography, logo, and design style presets)

---

## Table of Contents

- [Core Product Vision](#core-product-vision)
- [What BrandForge Does (All Levels)](#what-brandforge-does-all-levels)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [How the Full Workflow Works](#how-the-full-workflow-works)
- [Templates and Rendering Engine](#templates-and-rendering-engine)
- [Global Brand Kit](#global-brand-kit)
- [API Overview](#api-overview)
- [Run with Docker (Windows, macOS, Linux)](#run-with-docker-windows-macos-linux)
- [Environment Variables](#environment-variables)
- [Development Notes](#development-notes)
- [Troubleshooting](#troubleshooting)
- [Roadmap Ideas](#roadmap-ideas)
- [License](#license)

---

## Core Product Vision

BrandForge is not just a content generator.

The **core of the product** is the compilation of modern branded images from structured copy using HTML/CSS templates rendered by Chromium.

That means BrandForge solves two high-value problems together:

1. **Message quality**: persuasive, objective-driven copy variants and refinements
2. **Visual execution**: design-system-based renders with repeatable quality and consistent brand identity

This gives marketing teams a system where strategy, copy, design tokens, and final export are all connected.

---

## What BrandForge Does (All Levels)

### 1. Campaign-level strategy

You define campaign metadata such as:

- Objective
- Target audience
- Industry
- Value proposition
- Brand voice

This context is reused by the generation pipeline, so output is not generic.

### 2. Multi-variant content generation

BrandForge uses OpenAI to generate multiple post variants per request.

Each variant includes:

- Hook
- Headline
- Subheadline
- Body copy
- CTA
- Caption
- Pain point
- Value proposition
- Tone
- Marketing angle

If a marketing angle is not forced manually, BrandForge selects one based on campaign objective.

### 3. Refinement chat loop

Every post can be iteratively improved with natural language instructions.

Examples:

- "Make it more direct"
- "Use a stronger sales tone"
- "Add urgency"

Refinements produce new versions and preserve history.

### 4. Version control for content

BrandForge snapshots post content as versions and supports restore operations.

This gives teams:

- Experimentation safety
- Fast rollback
- Better editing confidence

### 5. Template-driven visual rendering

A post can be rendered into an image by selecting a template and exporting as PNG.

The rendering pipeline:

- Builds final HTML from a template
- Injects brand tokens and slot data
- Uses headless Chromium (Puppeteer)
- Captures a high-resolution PNG
- Stores and serves the exported image

### 6. Live HTML preview before export

Users can preview the final HTML output before rendering, including selected dimensions.

### 7. Global Brand Kit

A dedicated Brand Kit page lets users centrally configure visual identity for all templates:

- Primary/secondary/accent/background/text colors
- Heading and body fonts
- Logo upload and automatic use
- Design style preset

### 8. Design style presets

BrandForge includes six visual presets that alter layout personality through CSS tokens:

- minimal
- bold
- corporate
- creative
- elegant
- modern

### 9. Favorites and campaign filtering

Posts can be starred/favorited and filtered for content curation workflows.

---

## System Architecture

BrandForge runs as a multi-container Docker application:

- Frontend (React + Vite)
- Backend API (NestJS)
- PostgreSQL (data persistence)
- Redis (queue infrastructure)

High-level flow:

1. UI sends generation request
2. Backend composes campaign + brand context
3. OpenAI returns structured JSON content
4. Backend saves content post + version snapshot
5. User refines content via chat instructions
6. User selects template and previews HTML
7. Backend renders PNG with Chromium
8. Browser downloads final image

---

## Technology Stack

### Backend

- NestJS 10
- TypeScript
- TypeORM
- PostgreSQL
- Redis + BullMQ
- OpenAI Node SDK
- Class Validator + Class Transformer
- Multer for file uploads
- Puppeteer Core + Chromium
- Swagger docs (`/api/docs`)

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Axios
- Tailwind CSS
- Lucide React icons

### Infrastructure

- Docker + Docker Compose
- Volume-mounted template and source folders for development

---

## Project Structure

```text
content-engine/
  backend/
    src/
      campaigns/
      content/
      generation/
      render/
      templates/
      brand-assets/
  frontend/
    src/
      pages/
      components/
      api/
  templates/
    instagram-feed-1x1/
    instagram-feed-4x5/
    linkedin-horizontal/
  docker-compose.yml
  .env.example
```

---

## How the Full Workflow Works

### Step 1: Create campaign

From Dashboard, create a campaign with strategic context (objective, audience, value proposition, etc.).

### Step 2: Generate variants

Use the Generate page to choose:

- Platform (Instagram 1:1, Instagram 4:5, LinkedIn)
- Objective
- Optional fixed angle
- Topic
- Optional audience override
- Additional context
- Variant count (1 to 5)

### Step 3: Review and curate posts

In Campaign view:

- Review generated cards
- Favorite high-potential variants
- Delete low-quality variants

### Step 4: Refine a selected post

In Post Detail:

- Use refinement chat
- Apply quick prompts
- Save improved versions automatically
- Inspect version history
- Restore previous snapshots when needed

### Step 5: Preview template output

Select a template and click Preview to inspect generated HTML with dimensions.

### Step 6: Export PNG

Click Export PNG to render via Chromium and automatically download the image.

---

## Templates and Rendering Engine

BrandForge includes a template registry with dimensions and platform metadata:

- Instagram 1:1 templates
- Instagram 4:5 templates
- LinkedIn horizontal templates

Render pipeline internals:

1. Resolve template by ID
2. Read template HTML file from `templates/`
3. Inject Google Fonts links
4. Inject CSS design tokens from global brand config + style preset
5. Inject content slots (`hook`, `headline`, `body`, `cta`, etc.)
6. Inject logo URL when available
7. Render HTML in headless Chromium
8. Save screenshot in `rendered/`
9. Return image URL for serving and download

Security and resilience details:

- HTML content is escaped before slot insertion
- Template existence is validated
- Safe filename handling when serving rendered assets
- Type validation on render DTOs

---

## Global Brand Kit

Brand configuration is global (single default config) and applies across all campaigns.

Config fields:

- `primaryColor`
- `secondaryColor`
- `accentColor`
- `backgroundColor`
- `textColor`
- `headingFont`
- `bodyFont`
- `logoAssetId`
- `designStyle`

Asset pipeline:

- Logo upload via multipart endpoint
- Supported files: PNG, JPG, SVG, WEBP (and font MIME types)
- Max upload size: 10MB
- New logo auto-links to global config

Design presets influence structural tokens such as:

- Border radii
- Shadows
- Gradient angle
- Overlay/decorator opacity
- Glassmorphism blur/background
- Spacing scale

This makes the same template system adapt to very different visual personalities.

---

## API Overview

Base URL:

- `http://localhost:3000/api`

Swagger docs:

- `http://localhost:3000/api/docs`

Main route groups:

- `campaigns`
- `content`
- `generation`
- `templates`
- `render`
- `brand-assets`

Key capabilities by group:

### Campaigns

- Create/list/get/update/archive/delete campaigns

### Content

- Create/get/update/delete posts
- Favorite toggle
- Version history retrieval
- Version restore

### Generation

- Generate content variants
- Refine existing content

### Templates

- List templates
- Filter templates by platform
- Get template metadata by ID

### Render

- Preview generated HTML
- Render PNG
- Serve rendered PNG by filename

### Brand Assets

- Upload logo/assets
- List assets
- Remove assets
- Read/update global brand config
- Serve active global logo

---

## Run with Docker (Windows, macOS, Linux)

### Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine + Compose plugin (Linux)
- Git
- OpenAI API key

### 1. Clone repository

```bash
git clone https://github.com/oniriaai/brandforge.git
cd brandforge
```

### 2. Create environment file

```bash
cp .env.example .env
```

Then edit `.env` and set your real OpenAI API key.

### 3. Start all services

```bash
docker compose up -d --build
```

### 4. Access services

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

### 5. Stop services

```bash
docker compose down
```

### 6. Stop and remove volumes (full reset)

```bash
docker compose down -v
```

---

## OS-specific Docker Notes

### Windows (Docker Desktop)

- Use Docker Desktop with WSL2 backend enabled (recommended)
- If you clone under OneDrive, ensure file sync does not lock Docker bind mounts
- If file watch is slow, prefer cloning under a non-synced folder (optional)

### macOS (Docker Desktop)

- Ensure file sharing includes your project directory
- First run may take longer while images build and dependencies install

### Linux (Docker Engine)

- Install Docker Engine and Compose plugin
- Ensure your user can run Docker without sudo (optional but recommended)

Example commands:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## Environment Variables

Default template (`.env.example`):

```env
# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=contentengine
POSTGRES_PASSWORD=changeme_secure_password
POSTGRES_DB=contentengine

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# OpenAI
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o

# Backend
BACKEND_PORT=3000
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3000/api

# Puppeteer Render
RENDER_CONCURRENCY=3

# Standalone AI Image Agent (used when backend runs outside Docker)
AI_IMAGE_AGENT_URL=http://localhost:4100
```

Important:

- `OPENAI_API_KEY` must be valid or generation/refinement will fail
- In Docker, frontend proxies `/api` to `http://backend:3000` via Vite config
- In Docker Compose, backend uses `http://ai-image-agent:4100` internally (service DNS)

---

## Development Notes

- Backend uses `ValidationPipe({ whitelist: true, transform: true })`
- TypeORM runs with `synchronize` in development mode
- Template files are mounted as volume, so edits are reflected without rebuilding images
- Rendered images are stored in `rendered/` volume
- Uploaded brand assets are stored in `uploads/` volume

---

## Troubleshooting

### 1. API generation fails

Possible causes:

- Missing/invalid `OPENAI_API_KEY`
- OpenAI rate limits

Check:

```bash
docker compose logs -f backend
```

### 2. Export PNG does not download

Ensure backend is running and `/api/render/image/:filename` is reachable. Also verify browser is not blocking automatic download.

### 3. Campaigns do not appear

If you recently changed relations/entities, rebuild backend:

```bash
docker compose up -d --build backend
```

### 4. Port conflicts

If `3000`, `5173`, `5432`, or `6379` are busy, free those ports or update compose/env mappings.

### 5. Chromium/Puppeteer issues

Rendering depends on Chromium binaries in the backend container. Rebuild backend image if rendering fails after dependency changes.

---

## Roadmap Ideas

- Multi-user auth and role-based access
- Brand kits per workspace/tenant (in addition to global)
- Queue-based async rendering and bulk export
- Template editor UI with live token inspection
- Batch generation with approval workflow
- Analytics layer (CTR assumptions, angle performance tracking)
- Cloud object storage for rendered assets

---

## License

No license file is currently included. Add a license (MIT, Apache-2.0, or proprietary) according to your distribution plan.
