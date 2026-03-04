import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      react,
    },
    rules: {
      'react/button-has-type': 'error',
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'Literal[value=3600000]',
          message:
            'Use dayjs/shared date helpers instead of magic millisecond literals (3600000 = 1 hour).',
        },
        {
          selector: 'Literal[value=86400000]',
          message:
            "Use dayjs().add/subtract(..., 'day') or shared date helpers instead of 86400000.",
        },
        {
          selector: 'Literal[value=172800000]',
          message:
            "Use dayjs().add/subtract(..., 'day') or shared date helpers instead of 172800000.",
        },
        {
          selector: 'Literal[value=259200000]',
          message:
            "Use dayjs().add/subtract(..., 'day') or shared date helpers instead of 259200000.",
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../../services/settingsService',
              importNames: ['getSubscriptionSettings'],
              message:
                'Direct subscription settings API usage is not allowed in UI. Use entities/settings query hooks.',
            },
            {
              name: '../../../services/settingsService',
              importNames: ['getSubscriptionSettings'],
              message:
                'Direct subscription settings API usage is not allowed in UI. Use entities/settings query hooks.',
            },
            {
              name: '../../services/resourceTreeSettingsService',
              importNames: ['fetchResourceTreeSettings', 'saveResourceTreeSettings'],
              message:
                'Direct resource tree settings API usage in UI is not allowed. Use entities/settings resource tree hooks.',
            },
            {
              name: '../../../services/resourceTreeSettingsService',
              importNames: ['fetchResourceTreeSettings', 'saveResourceTreeSettings'],
              message:
                'Direct resource tree settings API usage in UI is not allowed. Use entities/settings resource tree hooks.',
            },
            {
              name: '../../services/apiClient',
              importNames: ['apiGet', 'apiPut', 'apiPatch', 'apiPost', 'apiDelete'],
              message:
                'Direct apiClient usage in UI is not allowed. Route requests through entities/services hooks.',
            },
            {
              name: '../../../services/apiClient',
              importNames: ['apiGet', 'apiPut', 'apiPatch', 'apiPost', 'apiDelete'],
              message:
                'Direct apiClient usage in UI is not allowed. Route requests through entities/services hooks.',
            },
          ],
          patterns: [
            {
              group: ['antd'],
              allowImportNamePattern: '^(message|theme|App|Form)$',
              allowTypeImports: true,
              message:
                'Outside shared/ui, only message, theme, App, Form (for Form.useForm), and type-only imports are allowed from antd.',
            },
            {
              group: ['antd/es/*', 'antd/lib/*'],
              allowTypeImports: true,
              message:
                'Visual AntD deep imports are not allowed outside shared/ui. Use shared/ui wrappers instead.',
            },
            {
              group: ['**/services/settingsService'],
              message:
                'UI layers must not import settingsService directly. Use entities/settings facade/query hooks.',
            },
            {
              group: ['**/services/themeService'],
              message:
                'UI layers must not import themeService directly. Use entities/settings facade/theme slices.',
            },
            {
              group: ['**/services/unattendProfileService'],
              message:
                'UI layers must not import unattendProfileService directly. Use entities/vm facades/query hooks.',
            },
            {
              group: ['**/services/wowNamesService'],
              message:
                'UI layers must not import wowNamesService directly. Use entities/bot facades/query hooks.',
            },
            {
              group: ['**/services/botLifecycleService'],
              message:
                'UI layers must not import botLifecycleService directly. Use entities/bot facades/query hooks.',
            },
            {
              group: ['**/services/apiClient'],
              message:
                'UI layers must not import apiClient directly. Route requests through entities/services hooks.',
            },
          ],
        },
      ],
    },
  },
]);
