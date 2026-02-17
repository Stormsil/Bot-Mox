import React from 'react';
import { Checkbox, Form, Radio, Typography } from 'antd';
import type { UnattendProfileConfig } from '../../../../services/unattendProfileService';
import { DESKTOP_ICONS, START_FOLDERS } from '../../../../data/windows-visual-effects';

const { Text } = Typography;

interface DesktopIconsSectionProps {
  config: UnattendProfileConfig;
  updateConfig: <K extends keyof UnattendProfileConfig>(section: K, patch: Partial<UnattendProfileConfig[K]>) => void;
}

export const DesktopIconsSection: React.FC<DesktopIconsSectionProps> = ({ config, updateConfig }) => {
  const mode = config.desktopIcons.mode;
  const icons = config.desktopIcons.icons || {};
  const startFolders = config.desktopIcons.startFolders || {};
  const isCustom = mode === 'custom' || mode === 'custom_randomize';

  return (
    <Form layout="vertical" size="small">
      <Form.Item>
        <Checkbox
          checked={config.desktopIcons.deleteEdgeShortcut}
          onChange={(e) => updateConfig('desktopIcons', { deleteEdgeShortcut: e.target.checked })}
        >
          Delete Edge desktop shortcut
        </Checkbox>
      </Form.Item>

      <Form.Item label="Icons mode">
        <Radio.Group
          value={mode}
          onChange={(e) => updateConfig('desktopIcons', { mode: e.target.value })}
        >
          <Radio value="default">Default (no changes)</Radio>
          <Radio value="custom">Custom</Radio>
          <Radio value="custom_randomize">Custom + randomize</Radio>
        </Radio.Group>
      </Form.Item>

      {isCustom && (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Desktop Icons</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {DESKTOP_ICONS.map((icon) => (
              <Checkbox
                key={icon.key}
                checked={icons[icon.key] ?? false}
                onChange={(e) =>
                  updateConfig('desktopIcons', {
                    icons: { ...icons, [icon.key]: e.target.checked },
                  })
                }
              >
                {icon.name}
              </Checkbox>
            ))}
          </div>

          <Text strong style={{ display: 'block', marginBottom: 8 }}>Start Menu Folders</Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {START_FOLDERS.map((folder) => (
              <Checkbox
                key={folder.key}
                checked={startFolders[folder.key] ?? false}
                onChange={(e) =>
                  updateConfig('desktopIcons', {
                    startFolders: { ...startFolders, [folder.key]: e.target.checked },
                  })
                }
              >
                {folder.name}
              </Checkbox>
            ))}
          </div>
        </>
      )}
    </Form>
  );
};
