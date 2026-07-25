export interface SecretFinding {
  rule: string;
  file: string;
  line: number;
}

interface SecretRule {
  name: string;
  pattern: RegExp;
}

const join = (...parts: string[]): string => parts.join('');

const SECRET_RULES: SecretRule[] = [
  {
    name: 'private-key',
    pattern: new RegExp(join('-----BEGIN ', '(?:RSA |EC |OPENSSH )?', 'PRIVATE KEY-----'), 'g')
  },
  {
    name: 'supabase-secret-key',
    pattern: new RegExp(join('sb_', 'secret_', '[A-Za-z0-9_-]{16,}'), 'g')
  },
  {
    name: 'service-role-jwt',
    pattern: new RegExp(join('eyJ[A-Za-z0-9_-]{20,}', '\\.', '[A-Za-z0-9_-]{20,}', '\\.', '[A-Za-z0-9_-]{20,}'), 'g')
  },
  {
    name: 'github-token',
    pattern: new RegExp(join('gh', '[pousr]_', '[A-Za-z0-9]{20,}'), 'g')
  },
  {
    name: 'google-api-key',
    pattern: new RegExp(join('AI', 'za[0-9A-Za-z_-]{30,}'), 'g')
  },
  {
    name: 'aws-access-key',
    pattern: new RegExp(join('AK', 'IA[0-9A-Z]{16}'), 'g')
  },
  {
    name: 'slack-token',
    pattern: new RegExp(join('xo', 'x[baprs]-[A-Za-z0-9-]{20,}'), 'g')
  },
  {
    name: 'private-webhook-url',
    pattern: new RegExp(
      join('https://', '(?:hook\\.[A-Za-z0-9.-]*make\\.com|hooks\\.zapier\\.com)', '/[A-Za-z0-9/_-]{8,}'),
      'gi'
    )
  },
  {
    name: 'embedded-zapi-credential',
    pattern: new RegExp(
      join('/instances/', '[A-Za-z0-9_-]{8,}', '/token/', '[A-Za-z0-9_-]{8,}'),
      'g'
    )
  },
  {
    name: 'hardcoded-bearer',
    pattern: new RegExp(join('Bearer\\s+', '[A-Za-z0-9._~-]{24,}'), 'g')
  }
];

const getLineNumber = (text: string, index: number): number =>
  text.slice(0, index).split(/\r?\n/).length;

const TEST_SENTINEL = /(?:never-persist|private-token|token-super-secreto|header\.payload\.signature|public-test-key|private\.example)/i;

const isExplicitTestSentinel = (text: string, index: number): boolean => {
  const lineStart = text.lastIndexOf('\n', index) + 1;
  const lineEnd = text.indexOf('\n', index);
  return TEST_SENTINEL.test(text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd));
};

const isPublicSupabaseAnonJwt = (token: string): boolean => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      role?: unknown;
    };
    return parsed.role === 'anon';
  } catch {
    return false;
  }
};

export const scanTextForSecrets = (
  text: string,
  file = 'memory'
): SecretFinding[] => {
  const findings: SecretFinding[] = [];
  for (const rule of SECRET_RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      if (isExplicitTestSentinel(text, match.index || 0)) continue;
      if (rule.name === 'service-role-jwt' && isPublicSupabaseAnonJwt(match[0])) {
        continue;
      }
      findings.push({
        rule: rule.name,
        file,
        line: getLineNumber(text, match.index || 0)
      });
    }
  }

  const literalCredential = new RegExp(
    join(
      '(?:password|passwd|secret|token|api[_-]?key|service[_-]?role[_-]?key)',
      '\\s*[:=]\\s*',
      '["\\x27`]',
      '([^"\\x27`\\r\\n]{16,})',
      '["\\x27`]'
    ),
    'gi'
  );
  for (const match of text.matchAll(literalCredential)) {
    const value = match[1] || '';
    const isPlaceholder =
      /^(?:<|replace-|set-in-|\$\{|process\.|Deno\.|import\.meta)/i.test(value);
    const isHighEntropy =
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /\d/.test(value) &&
      !/\s/.test(value);
    if (
      !isPlaceholder &&
      isHighEntropy &&
      !isExplicitTestSentinel(text, match.index || 0)
    ) {
      findings.push({
        rule: 'literal-credential',
        file,
        line: getLineNumber(text, match.index || 0)
      });
    }
  }
  return findings;
};
