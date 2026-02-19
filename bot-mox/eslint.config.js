import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

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
      // Prevent accidental form submissions (default type is "submit").
      'react/button-has-type': 'error',
    },
  },
  {
    files: ['src/components/bot/**/*.tsx', 'src/pages/bot/**/*.tsx', 'src/components/layout/Header.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/services/apiClient'],
              message:
                'Do not import apiClient directly in bot UI components. Use entities/bot query/mutation hooks.',
            },
            {
              group: ['**/services/botsApiService'],
              message:
                'Do not import botsApiService directly in bot UI components. Use entities/bot query/mutation hooks.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/**/*.tsx', 'src/pages/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../../services/botsApiService',
              importNames: ['subscribeBotsList', 'subscribeBotsMap'],
              message: 'Legacy polling subscriptions are not allowed in UI. Use entities/bot query hooks.',
            },
            {
              name: '../../../services/botsApiService',
              importNames: ['subscribeBotsList', 'subscribeBotsMap'],
              message: 'Legacy polling subscriptions are not allowed in UI. Use entities/bot query hooks.',
            },
            {
              name: '../../services/botsApiService',
              importNames: ['fetchBotsList', 'fetchBotsMap', 'deleteBot'],
              message: 'Direct bot API usage is not allowed in UI. Use entities/bot query/mutation hooks.',
            },
            {
              name: '../../../services/botsApiService',
              importNames: ['fetchBotsList', 'fetchBotsMap', 'deleteBot'],
              message: 'Direct bot API usage is not allowed in UI. Use entities/bot query/mutation hooks.',
            },
            {
              name: '../../services/resourcesApiService',
              importNames: ['subscribeResources'],
              message: 'Legacy resource subscriptions are not allowed in UI. Use entities/resources query hooks.',
            },
            {
              name: '../../../services/resourcesApiService',
              importNames: ['subscribeResources'],
              message: 'Legacy resource subscriptions are not allowed in UI. Use entities/resources query hooks.',
            },
            {
              name: '../../services/resourcesApiService',
              importNames: ['fetchResources', 'createResource', 'updateResource', 'deleteResource'],
              message: 'Direct resource API usage is not allowed in UI. Use entities/resources query/mutation hooks.',
            },
            {
              name: '../../../services/resourcesApiService',
              importNames: ['fetchResources', 'createResource', 'updateResource', 'deleteResource'],
              message: 'Direct resource API usage is not allowed in UI. Use entities/resources query/mutation hooks.',
            },
            {
              name: '../../services/licensesApiService',
              importNames: ['subscribeLicenses'],
              message: 'Legacy license subscriptions are not allowed in UI. Use entities/resources query hooks.',
            },
            {
              name: '../../../services/licensesApiService',
              importNames: ['subscribeLicenses'],
              message: 'Legacy license subscriptions are not allowed in UI. Use entities/resources query hooks.',
            },
            {
              name: '../../services/licensesApiService',
              importNames: ['createLicense', 'updateLicense', 'deleteLicense'],
              message: 'Direct license mutations are not allowed in UI. Use entities/resources mutation hooks.',
            },
            {
              name: '../../../services/licensesApiService',
              importNames: ['createLicense', 'updateLicense', 'deleteLicense'],
              message: 'Direct license mutations are not allowed in UI. Use entities/resources mutation hooks.',
            },
            {
              name: '../../services/projectSettingsService',
              importNames: ['subscribeToProjectSettings'],
              message: 'Legacy project settings subscriptions are not allowed in UI. Use entities/settings query hooks.',
            },
            {
              name: '../../../services/projectSettingsService',
              importNames: ['subscribeToProjectSettings'],
              message: 'Legacy project settings subscriptions are not allowed in UI. Use entities/settings query hooks.',
            },
            {
              name: '../../services/notesService',
              importNames: ['subscribeToNotesIndex'],
              message: 'Legacy notes index subscriptions are not allowed in UI. Use entities/notes query hooks.',
            },
            {
              name: '../../../services/notesService',
              importNames: ['subscribeToNotesIndex'],
              message: 'Legacy notes index subscriptions are not allowed in UI. Use entities/notes query hooks.',
            },
            {
              name: '../../services/notesService',
              importNames: ['subscribeToNote', 'createNote', 'updateNote', 'deleteNote'],
              message: 'Direct notes API usage in UI is not allowed. Use entities/notes query/mutation hooks.',
            },
            {
              name: '../../../services/notesService',
              importNames: ['subscribeToNote', 'createNote', 'updateNote', 'deleteNote'],
              message: 'Direct notes API usage in UI is not allowed. Use entities/notes query/mutation hooks.',
            },
            {
              name: '../../services/proxyDataService',
              importNames: ['subscribeProxies', 'subscribeBots'],
              message: 'Legacy proxies polling is not allowed in UI. Use entities/resources and entities/bot query hooks.',
            },
            {
              name: '../../../services/proxyDataService',
              importNames: ['subscribeProxies', 'subscribeBots'],
              message: 'Legacy proxies polling is not allowed in UI. Use entities/resources and entities/bot query hooks.',
            },
            {
              name: '../../services/proxyDataService',
              importNames: ['createProxy', 'updateProxyById', 'deleteProxyById'],
              message: 'Direct proxy CRUD in UI is not allowed. Use entities/resources proxy mutation hooks.',
            },
            {
              name: '../../../services/proxyDataService',
              importNames: ['createProxy', 'updateProxyById', 'deleteProxyById'],
              message: 'Direct proxy CRUD in UI is not allowed. Use entities/resources proxy mutation hooks.',
            },
            {
              name: '../../services/workspaceService',
              importNames: [
                'subscribeToCalendarEvents',
                'subscribeToKanbanTasks',
                'fetchCalendarEvents',
                'fetchKanbanTasks',
                'createCalendarEvent',
                'updateCalendarEvent',
                'deleteCalendarEvent',
                'createKanbanTask',
                'updateKanbanTask',
                'deleteKanbanTask',
              ],
              message: 'Direct workspace API usage in UI is not allowed. Use entities/workspace query/mutation hooks.',
            },
            {
              name: '../../../services/workspaceService',
              importNames: [
                'subscribeToCalendarEvents',
                'subscribeToKanbanTasks',
                'fetchCalendarEvents',
                'fetchKanbanTasks',
                'createCalendarEvent',
                'updateCalendarEvent',
                'deleteCalendarEvent',
                'createKanbanTask',
                'updateKanbanTask',
                'deleteKanbanTask',
              ],
              message: 'Direct workspace API usage in UI is not allowed. Use entities/workspace query/mutation hooks.',
            },
            {
              name: '../../../../services/workspaceService',
              importNames: [
                'subscribeToCalendarEvents',
                'subscribeToKanbanTasks',
                'fetchCalendarEvents',
                'fetchKanbanTasks',
                'createCalendarEvent',
                'updateCalendarEvent',
                'deleteCalendarEvent',
                'createKanbanTask',
                'updateKanbanTask',
                'deleteKanbanTask',
              ],
              message: 'Direct workspace API usage in UI is not allowed. Use entities/workspace query/mutation hooks.',
            },
            {
              name: '../../services/settingsService',
              importNames: ['getSubscriptionSettings'],
              message: 'Direct subscription settings API usage is not allowed in UI. Use entities/settings query hooks.',
            },
            {
              name: '../../../services/settingsService',
              importNames: ['getSubscriptionSettings'],
              message: 'Direct subscription settings API usage is not allowed in UI. Use entities/settings query hooks.',
            },
            {
              name: '../../services/resourceTreeSettingsService',
              importNames: ['fetchResourceTreeSettings', 'saveResourceTreeSettings'],
              message: 'Direct resource tree settings API usage in UI is not allowed. Use entities/settings resource tree hooks.',
            },
            {
              name: '../../../services/resourceTreeSettingsService',
              importNames: ['fetchResourceTreeSettings', 'saveResourceTreeSettings'],
              message: 'Direct resource tree settings API usage in UI is not allowed. Use entities/settings resource tree hooks.',
            },
            {
              name: '../../services/apiClient',
              importNames: ['apiGet', 'apiPut', 'apiPatch', 'apiPost', 'apiDelete'],
              message: 'Direct apiClient usage in UI is not allowed. Route requests through entities/services hooks.',
            },
            {
              name: '../../../services/apiClient',
              importNames: ['apiGet', 'apiPut', 'apiPatch', 'apiPost', 'apiDelete'],
              message: 'Direct apiClient usage in UI is not allowed. Route requests through entities/services hooks.',
            },
          ],
          patterns: [
            {
              group: ['**/services/botsApiService'],
              message:
                'UI layers must not import botsApiService directly. Use entities/bot model + query/mutation hooks.',
            },
            {
              group: ['**/services/financeService'],
              message:
                'UI layers must not import financeService directly. Use entities/finance api/lib slices.',
            },
            {
              group: ['**/services/ipqsService'],
              message:
                'UI layers must not import ipqsService directly. Use entities/resources ipqs facade/hooks.',
            },
            {
              group: ['**/services/settingsService'],
              message:
                'UI layers must not import settingsService directly. Use entities/settings facade/query hooks.',
            },
            {
              group: ['**/services/projectSettingsService'],
              message:
                'UI layers must not import projectSettingsService directly. Use entities/settings facade/query hooks.',
            },
            {
              group: ['**/services/themeService'],
              message:
                'UI layers must not import themeService directly. Use entities/settings facade/theme slices.',
            },
            {
              group: ['**/services/apiKeysService'],
              message:
                'UI layers must not import apiKeysService directly. Use entities/settings facade/query hooks.',
            },
            {
              group: ['**/services/storagePolicyService'],
              message:
                'UI layers must not import storagePolicyService directly. Use entities/settings facade/query hooks.',
            },
            {
              group: ['**/services/vmService'],
              message:
                'UI layers must not import vmService directly. Use entities/vm facades/query hooks.',
            },
            {
              group: ['**/services/vmOpsService'],
              message:
                'UI layers must not import vmOpsService directly. Use entities/vm facades/query hooks.',
            },
            {
              group: ['**/services/vmOpsEventsService'],
              message:
                'UI layers must not import vmOpsEventsService directly. Use entities/vm facades/query hooks.',
            },
            {
              group: ['**/services/vmSettingsService'],
              message:
                'UI layers must not import vmSettingsService directly. Use entities/vm facades/query hooks.',
            },
            {
              group: ['**/services/playbookService'],
              message:
                'UI layers must not import playbookService directly. Use entities/vm facades/query hooks.',
            },
            {
              group: ['**/services/secretsService'],
              message:
                'UI layers must not import secretsService directly. Use entities/vm facades/query hooks.',
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
              group: ['**/services/notesService'],
              message: 'UI layers must not import notesService directly. Use entities/notes model + query/mutation hooks.',
            },
          ],
        },
      ],
    },
  },
])
