# AI Image Agent

Standalone service for branded Instagram image generation using:

- LangChain subagents (content analysis, background selection, layout generation)
- Satori JSX-to-image rendering
- Human approval gate before delivery

## Endpoints

- `POST /v1/images/generate`
- `GET /v1/images/:jobId`
- `GET /v1/approvals/pending`
- `POST /v1/approvals/:jobId/approve`
- `POST /v1/approvals/:jobId/reject`
- `GET /v1/images/:jobId/deliver`
- `GET /v1/assets/:filename`

## Local run

```bash
cd ai-image-agent
npm install
npm run dev
```
