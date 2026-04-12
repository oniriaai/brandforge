import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiImageAgentService {
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get('AI_IMAGE_AGENT_URL', 'http://localhost:4100');
  }

  generateForPost(postId: string, payload: unknown) {
    return this.request(`/v1/posts/${postId}/images/generate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  listPostJobs(postId: string) {
    return this.request(`/v1/posts/${postId}/images`, { method: 'GET' });
  }

  getPostJob(postId: string, jobId: string) {
    return this.request(`/v1/posts/${postId}/images/${jobId}`, { method: 'GET' });
  }

  getJobComponentSpec(postId: string, jobId: string) {
    return this.request(`/v1/posts/${postId}/images/${jobId}/component-spec`, {
      method: 'GET',
    });
  }

  suggestChanges(postId: string, jobId: string, payload: unknown) {
    return this.request(`/v1/posts/${postId}/images/${jobId}/suggest`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  selectVariant(postId: string, jobId: string, payload: unknown) {
    return this.request(`/v1/posts/${postId}/images/${jobId}/select-variant`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getPendingApprovals(postId: string) {
    return this.request(`/v1/posts/${postId}/approvals/pending`, { method: 'GET' });
  }

  approve(postId: string, jobId: string, payload: unknown) {
    return this.request(`/v1/posts/${postId}/approvals/${jobId}/approve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  reject(postId: string, jobId: string, payload: unknown) {
    return this.request(`/v1/posts/${postId}/approvals/${jobId}/reject`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  deliver(postId: string, jobId: string) {
    return this.request(`/v1/posts/${postId}/images/${jobId}/deliver`, { method: 'GET' });
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
