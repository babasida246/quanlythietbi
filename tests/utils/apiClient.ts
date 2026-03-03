import { APIRequestContext, request } from '@playwright/test';
import { testEnv, detectApiPrefix } from './env';

/**
 * API Client for backend testing
 */
export class ApiClient {
    private context: APIRequestContext | null = null;
    private baseUrl: string;
    private apiPrefix: string = '';

    constructor(baseUrl: string = testEnv.apiBaseUrl) {
        this.baseUrl = baseUrl;
    }

    /**
     * Initialize API client with auto-detected prefix
     */
    async init(): Promise<void> {
        this.context = await request.newContext({
            baseURL: this.baseUrl,
            timeout: testEnv.timeout,
            extraHTTPHeaders: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });

        this.apiPrefix = await detectApiPrefix(this.baseUrl);
    }

    /**
     * Cleanup resources
     */
    async dispose(): Promise<void> {
        if (this.context) {
            await this.context.dispose();
            this.context = null;
        }
    }

    /**
     * Get full API path with prefix
     */
    private getPath(endpoint: string): string {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${this.apiPrefix}${cleanEndpoint}`;
    }

    /**
     * Health check endpoint
     */
    async healthCheck(): Promise<any> {
        if (!this.context) throw new Error('API client not initialized');

        const response = await this.context.get(this.getPath('/health'));
        return {
            status: response.status(),
            body: response.ok() ? await response.json() : await response.text(),
        };
    }

    /**
     * Chat completion endpoint
     */
    async chatCompletion(payload: {
        messages: Array<{ role: string; content: string }>;
        model?: string;
        temperature?: number;
    }): Promise<any> {
        if (!this.context) throw new Error('API client not initialized');

        const response = await this.context.post(this.getPath('/api/v1/chat'), {
            data: payload,
        });

        return {
            status: response.status(),
            body: response.ok() ? await response.json() : await response.text(),
            headers: response.headers(),
        };
    }

    /**
     * Get logs tool
     */
    async getLogs(payload: {
        source: 'zabbix' | 'syslog' | 'fortigate';
        timeRange: {
            start: string;
            end: string;
        };
        filters?: Record<string, any>;
    }): Promise<any> {
        if (!this.context) throw new Error('API client not initialized');

        const response = await this.context.post(this.getPath('/v1/tools/get_logs'), {
            data: payload,
        });

        return {
            status: response.status(),
            body: response.ok() ? await response.json() : await response.text(),
            headers: response.headers(),
        };
    }

    /**
     * Summarize logs tool
     */
    async summarizeLogs(payload: {
        logs: Array<any>;
        summary_type?: string;
    }): Promise<any> {
        if (!this.context) throw new Error('API client not initialized');

        const response = await this.context.post(this.getPath('/v1/tools/summarize_logs'), {
            data: payload,
        });

        return {
            status: response.status(),
            body: response.ok() ? await response.json() : await response.text(),
            headers: response.headers(),
        };
    }

    /**
     * Generic request helper
     */
    async request(method: string, endpoint: string, options: {
        data?: any;
        params?: Record<string, string>;
        headers?: Record<string, string>;
    } = {}): Promise<any> {
        if (!this.context) throw new Error('API client not initialized');

        const url = this.getPath(endpoint);
        const requestOptions: any = {};

        if (options.data) {
            requestOptions.data = options.data;
        }

        if (options.params) {
            const searchParams = new URLSearchParams(options.params);
            requestOptions.url = `${url}?${searchParams.toString()}`;
        }

        if (options.headers) {
            requestOptions.headers = options.headers;
        }

        let response;
        switch (method.toUpperCase()) {
            case 'GET':
                response = await this.context.get(requestOptions.url || url, requestOptions);
                break;
            case 'POST':
                response = await this.context.post(url, requestOptions);
                break;
            case 'PUT':
                response = await this.context.put(url, requestOptions);
                break;
            case 'DELETE':
                response = await this.context.delete(url, requestOptions);
                break;
            default:
                throw new Error(`Unsupported HTTP method: ${method}`);
        }

        return {
            status: response.status(),
            body: response.ok() ? await response.json() : await response.text(),
            headers: response.headers(),
            ok: response.ok(),
        };
    }
}