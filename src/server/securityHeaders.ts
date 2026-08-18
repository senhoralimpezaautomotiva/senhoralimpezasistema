import type { RequestHandler } from 'express';
import type { AppEnvironment } from './environment';

export interface SecurityHeaderOptions {
  environment: AppEnvironment;
  supabaseUrl?: string;
}

const getOrigin = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

export const buildContentSecurityPolicy = (
  options: SecurityHeaderOptions
): string => {
  const isDevelopment = options.environment === 'development';
  const supabaseOrigin = getOrigin(options.supabaseUrl);
  const connectSources = new Set(["'self'"]);
  if (supabaseOrigin) {
    connectSources.add(supabaseOrigin);
    connectSources.add(supabaseOrigin.replace(/^https:/, 'wss:'));
  }
  if (isDevelopment) {
    connectSources.add('http:');
    connectSources.add('https:');
    connectSources.add('ws:');
    connectSources.add('wss:');
  }

  const scriptSources = ["'self'"];
  // Vite injects an inline React refresh preamble only in development.
  if (isDevelopment) scriptSources.push("'unsafe-inline'");

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src ${Array.from(connectSources).join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:"
  ].join('; ');
};

export const buildSecurityHeaders = (
  options: SecurityHeaderOptions
): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Security-Policy': buildContentSecurityPolicy(options),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    'X-Frame-Options': 'DENY',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'X-DNS-Prefetch-Control': 'off'
  };
  if (options.environment === 'production') {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
};

export const createSecurityHeaders = (
  options: SecurityHeaderOptions
): RequestHandler => {
  const headers = buildSecurityHeaders(options);
  return (_request, response, next) => {
    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
    next();
  };
};
