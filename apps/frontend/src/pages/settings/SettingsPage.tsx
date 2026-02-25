import type React from 'react';
import { bindCssModuleCx } from '../../shared/lib/classNames';
import styles from './SettingsPage.module.css';
import { SettingsCardsGrid } from './ui/SettingsCardsGrid';
import { SettingsPageHeader } from './ui/SettingsPageHeader';
import { ThemeSettingsContainer } from './ui/ThemeSettingsContainer';
import { useSettingsPageViewModel } from './useSettingsPageViewModel';

const cx = bindCssModuleCx(styles);

export const SettingsPage: React.FC = () => {
  const vm = useSettingsPageViewModel();

  return (
    <div className={cx('settings-page')}>
      <SettingsPageHeader loading={vm.ui.loading} onRefresh={() => void vm.actions.refreshAll()} />
      <SettingsCardsGrid
        forms={vm.forms}
        loading={vm.ui.loading}
        saving={vm.ui.saving}
        projectEntries={vm.data.projectEntries}
        actions={vm.actions}
        themePanelSlot={<ThemeSettingsContainer themeSettings={vm.data.themeSettingsQueryData} />}
      />
    </div>
  );
};

export default SettingsPage;
