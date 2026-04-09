import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiImageAgentService {
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get('AI_IMAGE_AGENT_URL', 'http://localhost:4100');
  }

  generate(payload: unknown) {
    return this.request('/v1/images/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getJob(jobId: string) {
    return this.request(`/v1/images/${jobId}`, { method: 'GET' });
  }

  getPendingApprovals() {
    return this.request('/v1/approvals/pending', { method: 'GET' });
  }

  approve(jobId: string, payload: unknown) {
    return this.request(`/v1/approvals/${jobId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  reject(jobId: string, payload: unknown) {
    return this.request(`/v1/approvals/${jobId}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  deliver(jobId: string) {
    return this.request(`/v1/images/${jobId}/deliver`, { method: 'GET' });
  }

  private async request(path: string, init: RequestInit) {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
    } catch {
      throw new HttpException(
        'AI image agent is unreachable. Check AI_IMAGE_AGENT_URL and service availability.',
        502,
      );
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message =
        typeof body === 'object' && body && 'message' in body
          ? String((body as { message?: string }).message)
          : typeof body === 'string'
            ? body
            : 'AI image agent request failed';
      throw new HttpException(message, response.status);
    }

    return body;
  }
}
