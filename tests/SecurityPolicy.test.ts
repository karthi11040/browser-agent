import { describe, it, expect } from 'vitest';
import { SecurityPolicy } from '../src/security/SecurityPolicy.js';

describe('SecurityPolicy', () => {
  it('allows all domains when wildcard is specified', () => {
    const policy = new SecurityPolicy({ allowedDomains: '*' });
    expect(policy.isUrlAllowed('https://example.com').allowed).toBe(true);
    expect(policy.isUrlAllowed('https://news.ycombinator.com/item?id=1').allowed).toBe(true);
  });

  it('restricts navigation to specified allowed domains only', () => {
    const policy = new SecurityPolicy({ allowedDomains: ['example.com', '*.github.com'] });

    expect(policy.isUrlAllowed('https://example.com/page').allowed).toBe(true);
    expect(policy.isUrlAllowed('https://gist.github.com/test').allowed).toBe(true);
    expect(policy.isUrlAllowed('https://malicious-site.com').allowed).toBe(false);
  });

  it('blocks loopback/localhost when blockLocalhost is enabled', () => {
    const policy = new SecurityPolicy({ allowedDomains: '*', blockLocalhost: true });

    expect(policy.isUrlAllowed('http://localhost:3000').allowed).toBe(false);
    expect(policy.isUrlAllowed('http://127.0.0.1:8080').allowed).toBe(false);
    expect(policy.isUrlAllowed('https://example.com').allowed).toBe(true);
  });

  it('correctly assesses action risks', () => {
    const policy = new SecurityPolicy();

    // High risk unsafe execution
    const unsafeRisk = policy.assessActionRisk('browser_run_code_unsafe', {});
    expect(unsafeRisk.risk).toBe('HIGH');
    expect(unsafeRisk.requiresConfirmation).toBe(true);

    // High risk destructive keyword
    const deleteRisk = policy.assessActionRisk('browser_click', { element: 'Delete Account permanently' });
    expect(deleteRisk.risk).toBe('HIGH');
    expect(deleteRisk.requiresConfirmation).toBe(true);

    // Medium risk state change
    const submitRisk = policy.assessActionRisk('browser_click', { element: 'Submit form' });
    expect(submitRisk.risk).toBe('MEDIUM');

    // Low risk navigation/read
    const navRisk = policy.assessActionRisk('browser_navigate', { url: 'https://example.com' });
    expect(navRisk.risk).toBe('LOW');
  });

  it('masks sensitive authorization tokens and passwords', () => {
    const policy = new SecurityPolicy();

    const text = 'Authorization: Bearer mySecretToken123 and api_key=sk-123456789012345678901234';
    const masked = policy.maskSensitive(text);

    expect(masked).not.toContain('mySecretToken123');
    expect(masked).toContain('Bearer [REDACTED]');
  });
});
