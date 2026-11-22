import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'server/domain/**',
        'server/modules/**/service.ts',
        'server/http/**',
        'server/support/**',
        'shared/**',
        'src/lib/**',
      ],
      // motion.ts adalah pembungkus GSAP/DOM; diverifikasi di peramban (V-9), bukan lewat tes unit.
      exclude: [
        'src/lib/motion.ts',
        'src/lib/auditLabels.ts',
        'shared/types.ts',
        'server/support/actor.ts',
        'server/support/deps.ts',
      ],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});
