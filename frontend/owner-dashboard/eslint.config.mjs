import nextPlugin from '@next/eslint-plugin-next';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-html-link-for-pages': ['error', 'src/pages'],
    },
    settings: {
      next: {
        rootDir: '.',
      },
    },
  },
];
