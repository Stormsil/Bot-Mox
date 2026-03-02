import { HighlightOutlined } from '@ant-design/icons';

import type { ReactElement } from 'react';
import {
  AppButton as Button,
  AppColorPicker as ColorPicker,
  AppFlex as Flex,
  AppInput as Input,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../../shared/ui';
import { THEME_COLOR_DEFINITIONS } from '../../../theme/themePalette';
import { cx } from '../sections/classNames';
import type { ThemeSettingsPanelProps } from '../ThemeSettingsPanel.types';

const { Text } = Typography;

type ColorsProps = Pick<
  ThemeSettingsPanelProps,
  | 'editingThemeMode'
  | 'localThemePalettes'
  | 'themeInputValues'
  | 'onThemeColorChange'
  | 'onThemeInputChange'
  | 'onThemeInputCommit'
  | 'onPickColorFromScreen'
>;

export function ThemeColorsGrid(props: ColorsProps): ReactElement {
  return (
    <div className={cx('theme-colors-grid')}>
      {THEME_COLOR_DEFINITIONS.map(({ cssVar, label }) => (
        <Flex
          key={cssVar}
          className={cx('theme-color-row')}
          align="center"
          justify="space-between"
          gap={12}
        >
          <div className={cx('theme-color-labels')}>
            <Text strong>{label}</Text>
            <Text code>{cssVar}</Text>
          </div>
          <Space wrap>
            <ColorPicker
              value={props.localThemePalettes[props.editingThemeMode][cssVar]}
              format="hex"
              disabledAlpha
              showText
              onChange={(color) =>
                props.onThemeColorChange(props.editingThemeMode, cssVar, color.toHexString(), {
                  syncApp: false,
                })
              }
              onChangeComplete={(color) =>
                props.onThemeColorChange(props.editingThemeMode, cssVar, color.toHexString(), {
                  syncApp: true,
                })
              }
            />
            <Input
              value={props.themeInputValues[props.editingThemeMode][cssVar]}
              onChange={(event) =>
                props.onThemeInputChange(props.editingThemeMode, cssVar, event.target.value)
              }
              onBlur={() => props.onThemeInputCommit(props.editingThemeMode, cssVar)}
              onPressEnter={() => props.onThemeInputCommit(props.editingThemeMode, cssVar)}
              className={cx('theme-color-input')}
              placeholder="#000000"
            />
            <Button
              icon={<HighlightOutlined />}
              onClick={() => void props.onPickColorFromScreen(props.editingThemeMode, cssVar)}
            >
              Pick Screen Color
            </Button>
          </Space>
        </Flex>
      ))}
    </div>
  );
}
