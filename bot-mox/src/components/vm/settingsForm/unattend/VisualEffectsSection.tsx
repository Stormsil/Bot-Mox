import React from 'react';
import { Checkbox, Form, Radio, Tag, Typography } from 'antd';
import type { UnattendProfileConfig } from '../../../../services/unattendProfileService';
import { VISUAL_EFFECTS } from '../../../../data/windows-visual-effects';

const { Text } = Typography;

interface VisualEffectsSectionProps {
  config: UnattendProfileConfig;
  updateConfig: <K extends keyof UnattendProfileConfig>(section: K, patch: Partial<UnattendProfileConfig[K]>) => void;
}

type TriState = true | false | 'random';

export const VisualEffectsSection: React.FC<VisualEffectsSectionProps> = ({ config, updateConfig }) => {
  const mode = config.visualEffects.mode;
  const effects = config.visualEffects.effects || {};
  const isCustom = mode === 'custom' || mode === 'custom_randomize';

  const handleEffectChange = (key: string, value: boolean) => {
    updateConfig('visualEffects', {
      effects: { ...effects, [key]: value },
    });
  };

  const handleEffectClear = (key: string) => {
    const next = { ...effects };
    delete next[key];
    updateConfig('visualEffects', { effects: next });
  };

  return (
    <Form layout="vertical" size="small">
      <Form.Item label="Visual effects mode">
        <Radio.Group
          value={mode}
          onChange={(e) => updateConfig('visualEffects', { mode: e.target.value })}
        >
          <Radio value="default">Default (no changes)</Radio>
          <Radio value="appearance">Best appearance</Radio>
          <Radio value="performance">Best performance</Radio>
          <Radio value="custom">Custom</Radio>
          <Radio value="custom_randomize">Custom + randomize unset</Radio>
        </Radio.Group>
      </Form.Item>

      {isCustom && (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            {mode === 'custom_randomize'
              ? 'Checked = always on, unchecked = always off, unset (gray) = randomized per VM.'
              : 'Check to enable, uncheck to disable.'}
          </Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            {VISUAL_EFFECTS.map((effect) => {
              const value: TriState = effects[effect.key] !== undefined ? effects[effect.key] : 'random';
              const isRandom = value === 'random' && mode === 'custom_randomize';

              return (
                <div key={effect.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Checkbox
                    checked={value === true}
                    indeterminate={isRandom}
                    onChange={(e) => {
                      if (mode === 'custom_randomize' && effects[effect.key] === undefined) {
                        // first click on random: set to true
                        handleEffectChange(effect.key, true);
                      } else if (mode === 'custom_randomize' && effects[effect.key] === true) {
                        // second click: set to false
                        handleEffectChange(effect.key, false);
                      } else if (mode === 'custom_randomize' && effects[effect.key] === false) {
                        // third click: clear (randomize)
                        handleEffectClear(effect.key);
                      } else {
                        handleEffectChange(effect.key, e.target.checked);
                      }
                    }}
                  >
                    {effect.name}
                  </Checkbox>
                  {isRandom && <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>rnd</Tag>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Form>
  );
};
