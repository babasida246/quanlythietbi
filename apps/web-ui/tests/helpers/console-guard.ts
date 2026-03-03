import { expect, type Page } from '@playwright/test';

export type ConsoleGuardOptions = {
  allowWarnings?: RegExp[];
  allowRequestFailures?: RegExp[];
  criticalWarnings?: RegExp[];
};

type GuardIssue = {
  source: 'console.error' | 'console.warn' | 'pageerror' | 'requestfailed';
  message: string;
};

const DEFAULT_CRITICAL_WARNING_PATTERNS = [
  /Message with id ".*" must be of type "string"/i,
  /\$format.*deprecated.*json/i
];

export function attachConsoleGuard(page: Page, options: ConsoleGuardOptions = {}) {
  const issues: GuardIssue[] = [];
  const allowWarnings = options.allowWarnings ?? [];
  const allowRequestFailures = options.allowRequestFailures ?? [];
  const criticalWarnings = options.criticalWarnings ?? DEFAULT_CRITICAL_WARNING_PATTERNS;

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error') {
      issues.push({ source: 'console.error', message: text });
      return;
    }

    if (type === 'warning') {
      const isCritical = criticalWarnings.some((pattern) => pattern.test(text));
      const isAllowed = allowWarnings.some((pattern) => pattern.test(text));
      if (isCritical && !isAllowed) {
        issues.push({ source: 'console.warn', message: text });
      }
    }
  });

  page.on('pageerror', (error) => {
    const message = error.stack || error.message;
    issues.push({ source: 'pageerror', message });
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const message = `${request.method()} ${request.url()} -> ${failure?.errorText ?? 'unknown error'}`;
    const isAllowed = allowRequestFailures.some((pattern) => pattern.test(message));
    if (!isAllowed) {
      issues.push({ source: 'requestfailed', message });
    }
  });

  return {
    assertNoIssues(): void {
      const details = issues.map((issue) => `[${issue.source}] ${issue.message}`);
      expect(details, details.join('\n')).toEqual([]);
    },
    getIssues(): string[] {
      return issues.map((issue) => `[${issue.source}] ${issue.message}`);
    }
  };
}
