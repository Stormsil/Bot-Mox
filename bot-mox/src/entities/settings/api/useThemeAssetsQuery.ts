import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { settingsQueryKeys } from './settingsQueryKeys';
import { listThemeAssets, type ThemeBackgroundAsset } from './themeFacade';

const THEME_ASSETS_REFETCH_MS = 15_000;

export function useThemeAssetsQuery(): UseQueryResult<ThemeBackgroundAsset[], Error> {
  return useQuery<ThemeBackgroundAsset[], Error>({
    queryKey: settingsQueryKeys.themeAssets(),
    queryFn: async () => {
      const data = await listThemeAssets();
      return data.items.filter((item) => item.status === 'ready' || item.status === 'pending');
    },
    refetchInterval: THEME_ASSETS_REFETCH_MS,
  });
}
