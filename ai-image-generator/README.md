# AI Image Generator (BrandForge)

FastAPI service that generates branded social images from post text and exposes a **compatibility API** used by BrandForge backend/frontend.

## What it provides

- HTML/CSS generation with OpenAI
- PNG rendering with Playwright
- Vision-based scoring with OpenAI
- Curated visual assets in generated layouts (Lucide icons + unDraw illustrations)
- Expanded curated asset libraries for broader campaign coverage (20+ icons, 20+ illustrations)
- Semantic asset selection using campaign/objective keyword signals
- Variable-font creative rotation with brand-font override support
- Deterministic procedural SVG backgrounds (svgwrite + OpenSimplex) used in final PNG renders and component-spec previews
- Judge rubric with normalized sub-scores, defect tags, repair hints, and confidence
- Structured design-spec stage before HTML generation (layout/hierarchy/spacing/CTA strategy)
- Automatic repair iterations driven by judge defects/hints and render validations
- Weighted variant recommendation (judge subscores + validation penalties + confidence)
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

## Quality baseline

Generate an initial KPI baseline report:

```bash
python3 baseline.py --state-file state/jobs-state.json --report-file output/quality-baseline.json --use-samples-if-empty
```

The report includes:

- Mean overall judge score
- CTA pass rate
- Supporting visual pass rate (logo or illustration)
- Text overflow pass rate
- Safe-zone pass rate
- Contrast pass rate
- File size warning rate

Quality baseline logs are also emitted by the generator with event `quality_baseline` for both `generation_input` and `generation_output` stages.

## Procedural backgrounds

- Each variant receives a deterministic procedural background generated from brand colors and a stable seed (`postId + variantIndex + revision context`).
- The pipeline stores procedural metadata in `background` and decorative overlays in `decorativeLayers`.
- Final PNG rendering injects the generated SVG texture in the browser render pass, keeping output visuals aligned with component-spec previews.

## Environment variables

- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (default `gpt-4o`)
- `OPENAI_MODEL_SPEC` (optional stage override for design-spec and copy compression)
- `OPENAI_MODEL_LAYOUT` (optional stage override for HTML layout generation)
- `OPENAI_MODEL_JUDGE` (optional stage override for vision scoring/judging)
- `PORT` (default `4100`)
- `RENDER_OUTPUT_DIR` (default `output`)
- `AGENT_STATE_FILE` (default `state/jobs-state.json`)
- `DELIVERY_BASE_URL` (default `http://localhost:4100`)
- `DEFAULT_VARIANT_COUNT` (default `3`)
- `MAX_VARIANT_COUNT` (default `5`)
- `REPAIR_MAX_PASSES` (default `2`)
- `RENDER_CONCURRENCY` (default `3`)
- `JUDGE_CONCURRENCY` (default `3`)
- `OPENAI_TIMEOUT_SECONDS` (default `90`)
- `OPENAI_MAX_RETRIES` (default `2`)
