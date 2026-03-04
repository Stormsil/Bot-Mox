import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { settingsQueryKeys } from './settingsQueryKeys';
import { listThemeAssets, type ThemeBackgroundAsset } from './themeFacade';

export function useThemeAssetsQuery(): UseQueryResult<ThemeBackgroundAsset[], Error> {
  return useQuery<ThemeBackgroundAsset[], Error>({
    queryKey: settingsQueryKeys.themeAssets(),
    queryFn: async () => {
      const data = await listThemeAssets();
      return data.items.filter((item) => item.status === 'ready' || item.status === 'pending');
    },
  });
}
