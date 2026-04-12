# AI Image Generator (BrandForge)

FastAPI service that generates branded social images from post text and exposes a **compatibility API** used by BrandForge backend/frontend.

## What it provides

- HTML/CSS generation with OpenAI
- PNG rendering with Playwright
- Vision-based scoring with OpenAI
- Job lifecycle compatible with existing endpoints:
  - `POST /v1/posts/:postId/images/generate`
  - `GET /v1/posts/:postId/images`
  - `GET /v1/posts/:postId/images/:jobId`
  - `GET /v1/posts/:postId/images/:jobId/component-spec`
  - `POST /v1/posts/:postId/images/:jobId/suggest`
  - `POST /v1/posts/:postId/images/:jobId/select-variant`
  - `GET /v1/posts/:postId/approvals/pending`
  - `POST /v1/posts/:postId/approvals/:jobId/approve`
  - `POST /v1/posts/:postId/approvals/:jobId/reject`
  - `GET /v1/posts/:postId/images/:jobId/deliver`

It also keeps native endpoints for direct use:

- `POST /generate`
- `POST /resume`

## Contract mapping (compatibility-first)

| BrandForge contract | Internal/native mapping |
| --- | --- |
| `inputText` | `base_text` |
| `designGuidelines` | `guidelines.hierarchy_notes` (+ parsed objective/angle/audience/tone) |
| `platform` | `format` (`instagram_feed_1x1` → `1080x1080`, `instagram_feed_4x5` → `1080x1350`) |
| `brandKit.primaryColor` | `brand_kit.colors.primary` |
| `brandKit.secondaryColor` | `brand_kit.colors.secondary` |
| `brandKit.accentColor` | `brand_kit.colors.accent` |
| `brandKit.backgroundColor` | `brand_kit.colors.bg` |
| `brandKit.textColor` | `brand_kit.colors.text` |
| `brandKit.headingFont` | `brand_kit.fonts.heading` |
| `brandKit.bodyFont` | `brand_kit.fonts.body` |
| `brandKit.logoUrl` | `brand_kit.logo_url` |
| `variantCount` | `num_variants` |
| `jobId` | persisted generated job id (also used as native `thread_id`) |
| `pending_approval/approved/rejected/delivered` | persisted compatibility status lifecycle |

## Run locally

```bash
cp .env.example .env
docker compose up --build
```

Service runs on `http://localhost:4100`.

Generated assets are served from `/output/*`.

## Environment variables

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (default `gpt-4o`)
- `PORT` (default `4100`)
- `RENDER_OUTPUT_DIR` (default `output`)
- `AGENT_STATE_FILE` (default `output/jobs-state.json`)
- `DELIVERY_BASE_URL` (default `http://localhost:4100`)
- `DEFAULT_VARIANT_COUNT` (default `3`)
- `MAX_VARIANT_COUNT` (default `5`)
