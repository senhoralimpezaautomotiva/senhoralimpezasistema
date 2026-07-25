import assert from 'node:assert/strict';
import { buildSecurityHeaders } from '../../src/server/securityHeaders';

const headers = buildSecurityHeaders({
  environment: 'production',
  supabaseUrl: 'https://project-ref.supabase.co'
});
const csp = headers['Content-Security-Policy'];

for (const name of [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'X-Frame-Options',
  'Strict-Transport-Security'
]) {
  assert.ok(headers[name], `Header ausente: ${name}`);
}
assert.match(csp, /script-src 'self'(?:;|$)/);
assert.match(csp, /frame-ancestors 'none'/);
assert.doesNotMatch(csp, /unsafe-eval/);
assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);

console.log('SEC005 headers: baseline de produção validada.');
