import { URL } from 'node:url';

export interface SecurityConfig {
  allowedDomains?: string[] | string;
  allowFileProtocol?: boolean;
  blockLocalhost?: boolean;
  maskSensitiveData?: boolean;
}

export type ActionRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ActionRiskAssessment {
  risk: ActionRiskLevel;
  reason?: string;
  requiresConfirmation?: boolean;
}

export class SecurityPolicy {
  private allowedDomains: Set<string>;
  private wildcardAllowed: boolean = false;
  private allowFileProtocol: boolean;
  private blockLocalhost: boolean;
  private maskSensitiveData: boolean;

  constructor(config: SecurityConfig = {}) {
    this.allowedDomains = new Set<string>();
    this.allowFileProtocol = config.allowFileProtocol ?? true;
    this.blockLocalhost = config.blockLocalhost ?? false;
    this.maskSensitiveData = config.maskSensitiveData ?? true;

    const domains = config.allowedDomains ?? process.env.ALLOWED_DOMAINS ?? '*';
    this.configureAllowedDomains(domains);
  }

  private configureAllowedDomains(domains: string[] | string): void {
    const list = Array.isArray(domains)
      ? domains
      : domains.split(',').map((d) => d.trim()).filter(Boolean);

    for (const d of list) {
      if (d === '*') {
        this.wildcardAllowed = true;
      } else {
        this.allowedDomains.add(d.toLowerCase());
      }
    }
  }

  /**
   * Validates if a target URL is permitted under current security policy.
   */
  public isUrlAllowed(rawUrl: string): { allowed: boolean; reason?: string } {
    try {
      const parsed = new URL(rawUrl);

      if (parsed.protocol === 'file:') {
        if (!this.allowFileProtocol) {
          return { allowed: false, reason: 'file:// protocol is disallowed by security policy.' };
        }
        return { allowed: true };
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { allowed: false, reason: `Protocol "${parsed.protocol}" is not supported or permitted.` };
      }

      const hostname = parsed.hostname.toLowerCase();

      // Check loopback / localhost
      if (this.blockLocalhost) {
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
          return { allowed: false, reason: 'Access to localhost/loopback addresses is blocked.' };
        }
      }

      if (this.wildcardAllowed) {
        return { allowed: true };
      }

      // Exact match or subdomain match
      for (const allowed of this.allowedDomains) {
        if (hostname === allowed) {
          return { allowed: true };
        }
        if (allowed.startsWith('*.')) {
          const root = allowed.slice(2);
          if (hostname === root || hostname.endsWith(`.${root}`)) {
            return { allowed: true };
          }
        }
        if (hostname.endsWith(`.${allowed}`)) {
          return { allowed: true };
        }
      }

      return {
        allowed: false,
        reason: `Domain "${hostname}" is not in the allowed domains list: [${Array.from(this.allowedDomains).join(', ')}]`,
      };
    } catch {
      return { allowed: false, reason: `Invalid URL: "${rawUrl}"` };
    }
  }

  /**
   * Assesses the risk of a proposed browser action.
   */
  public assessActionRisk(toolName: string, args: Record<string, unknown>): ActionRiskAssessment {
    // Unsafe code execution is strictly HIGH/BLOCKED
    if (toolName === 'browser_run_code_unsafe' || toolName.includes('eval')) {
      return {
        risk: 'HIGH',
        reason: 'Unsafe code execution is disabled by default.',
        requiresConfirmation: true,
      };
    }

    // High-risk click or type on destructive or payment terms
    const textTarget = String(args.element || args.text || args.value || '').toLowerCase();
    const highRiskKeywords = ['delete account', 'purchase', 'pay now', 'transfer funds', 'drop table', 'remove all'];
    for (const kw of highRiskKeywords) {
      if (textTarget.includes(kw)) {
        return {
          risk: 'HIGH',
          reason: `Action targets potentially destructive or transactional keyword: "${kw}"`,
          requiresConfirmation: true,
        };
      }
    }

    if (toolName === 'browser_fill_form' || toolName === 'browser_click') {
      const mediumKeywords = ['submit', 'login', 'sign in', 'checkout', 'confirm', 'save changes'];
      for (const kw of mediumKeywords) {
        if (textTarget.includes(kw)) {
          return { risk: 'MEDIUM', reason: `Action involves state change: "${kw}"` };
        }
      }
    }

    return { risk: 'LOW' };
  }

  /**
   * Masks tokens, secrets, and sensitive strings from logs and snapshots.
   */
  public maskSensitive(content: string): string {
    if (!this.maskSensitiveData || !content) return content;

    return content
      // Mask bearer tokens
      .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]')
      // Mask sk-... or or-... api keys
      .replace(/(sk-[a-zA-Z0-9]{20,})|(sk-or-v1-[a-zA-Z0-9]{30,})/g, '[REDACTED_API_KEY]')
      // Mask passwords in query params or forms
      .replace(/(password|passwd|secret|api_key|token)=([^&\s]+)/gi, '$1=[REDACTED]');
  }
}
