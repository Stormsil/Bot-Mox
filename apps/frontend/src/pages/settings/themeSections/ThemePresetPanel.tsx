import { CheckOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Flex, Input, Popconfirm, Select, Typography } from 'antd';
import type { ReactElement } from 'react';
import { TableActionButton } from '../../../shared/ui/TableActionButton';
import { cx } from '../sections/classNames';
import type { ThemeSettingsPanelProps } from '../ThemeSettingsPanel.types';

const { Text } = Typography;

type PresetProps = Pick<
  ThemeSettingsPanelProps,
  | 'selectedPresetId'
  | 'themePresetOptions'
  | 'onSelectedPresetChange'
  | 'onApplySelectedPreset'
  | 'themePresetApplying'
  | 'onDeleteSelectedPreset'
  | 'themePresetDeleting'
  | 'newThemePresetName'
  | 'onNewThemePresetNameChange'
  | 'onSaveCurrentAsPreset'
  | 'themePresetSaving'
>;

export function ThemePresetPanel(props: PresetProps): ReactElement {
  return (
    <div className={cx('theme-preset-panel')}>
      <Text strong className={cx('theme-preset-title')}>
        Saved Themes
      </Text>
      <Flex className={cx('theme-preset-row')} align="center" gap={8} wrap>
        <Select
          placeholder="Select saved theme"
          value={props.selectedPresetId}
          options={props.themePresetOptions}
          onChange={(value) => props.onSelectedPresetChange(value)}
          allowClear
          className={cx('theme-preset-select')}
        />
        <Button
          icon={<CheckOutlined />}
          onClick={props.onApplySelectedPreset}
          loading={props.themePresetApplying}
          disabled={!props.selectedPresetId}
        >
          Apply
        </Button>
        <Popconfirm
          title="Delete selected theme?"
          okText="Delete"
          cancelText="Cancel"
          onConfirm={props.onDeleteSelectedPreset}
          disabled={!props.selectedPresetId}
        >
          <TableActionButton
            buttonType="default"
            buttonSize="middle"
            icon={<DeleteOutlined />}
            danger
            loading={props.themePresetDeleting}
            disabled={!props.selectedPresetId}
          >
            Delete
          </TableActionButton>
        </Popconfirm>
      </Flex>
      <Flex className={cx('theme-preset-row')} align="center" gap={8} wrap>
        <Input
          placeholder="New theme name"
          value={props.newThemePresetName}
          onChange={(event) => props.onNewThemePresetNameChange(event.target.value)}
          onPressEnter={props.onSaveCurrentAsPreset}
          className={cx('theme-preset-name-input')}
        />
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={props.themePresetSaving}
          onClick={props.onSaveCurrentAsPreset}
        >
          Save As Theme
        </Button>
      </Flex>
    </div>
  );
}
