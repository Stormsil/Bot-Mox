import { Button, Divider, Form, Radio, Select, Slider, Space, Typography } from 'antd';
import type React from 'react';
import { BLOATWARE_PACKAGES, WINDOWS_CAPABILITIES } from '../../../../data/windows-bloatware';
import type { UnattendProfileConfig } from '../../../../entities/vm/model/unattend';

const { Text } = Typography;

interface BloatwareSectionProps {
  config: UnattendProfileConfig;
  updateConfig: <K extends keyof UnattendProfileConfig>(
    section: K,
    patch: Partial<UnattendProfileConfig[K]>,
  ) => void;
}

export const BloatwareSection: React.FC<BloatwareSectionProps> = ({ config, updateConfig }) => {
  const sr = config.softwareRemoval;
  const cr = config.capabilityRemoval;

  const handleSelectAll = (field: 'fixedPackages' | 'randomPool') => {
    updateConfig('softwareRemoval', { [field]: BLOATWARE_PACKAGES.map((p) => p.id) });
  };

  const handleClearAll = (field: 'fixedPackages' | 'randomPool') => {
    updateConfig('softwareRemoval', { [field]: [] });
  };

  const packageOptions = BLOATWARE_PACKAGES.map((p) => ({
    label: p.name,
    value: p.id,
  }));

  const capabilityOptions = WINDOWS_CAPABILITIES.map((c) => ({
    label: c.name,
    value: c.id,
  }));

  return (
    <Form layout="vertical" size="small">
      <Form.Item label="Package removal mode">
        <Radio.Group
          value={sr.mode}
          onChange={(e) => updateConfig('softwareRemoval', { mode: e.target.value })}
        >
          <Radio value="fixed">Fixed list</Radio>
          <Radio value="random">Random subset</Radio>
          <Radio value="fixed_random">Fixed + random extras</Radio>
        </Radio.Group>
      </Form.Item>

      {(sr.mode === 'fixed' || sr.mode === 'fixed_random') && (
        <Form.Item label="Packages to always remove">
          <Space style={{ marginBottom: 4 }}>
            <Button size="small" onClick={() => handleSelectAll('fixedPackages')}>
              Select all
            </Button>
            <Button size="small" onClick={() => handleClearAll('fixedPackages')}>
              Clear
            </Button>
          </Space>
          <Select
            mode="multiple"
            value={sr.fixedPackages}
            onChange={(value) => updateConfig('softwareRemoval', { fixedPackages: value })}
            placeholder="Select packages"
            maxTagCount={5}
            style={{ width: '100%' }}
            options={packageOptions}
          />
        </Form.Item>
      )}

      {(sr.mode === 'random' || sr.mode === 'fixed_random') && (
        <>
          <Form.Item label="Random pool">
            <Space style={{ marginBottom: 4 }}>
              <Button size="small" onClick={() => handleSelectAll('randomPool')}>
                Select all
              </Button>
              <Button size="small" onClick={() => handleClearAll('randomPool')}>
                Clear
              </Button>
            </Space>
            <Select
              mode="multiple"
              value={sr.randomPool}
              onChange={(value) => updateConfig('softwareRemoval', { randomPool: value })}
              placeholder="Pool for random removal"
              maxTagCount={5}
              style={{ width: '100%' }}
              options={packageOptions}
            />
          </Form.Item>
          <Form.Item label="Random count range">
            <Slider
              range
              min={0}
              max={50}
              value={[sr.randomCount?.min ?? 5, sr.randomCount?.max ?? 15]}
              onChange={(value) => {
                if (Array.isArray(value)) {
                  updateConfig('softwareRemoval', {
                    randomCount: { min: value[0], max: value[1] },
                  });
                }
              }}
            />
          </Form.Item>
        </>
      )}

      <Form.Item label="Never remove (protected)">
        <Select
          mode="multiple"
          value={sr.neverRemove || []}
          onChange={(value) => updateConfig('softwareRemoval', { neverRemove: value })}
          placeholder="Packages that should never be removed"
          maxTagCount={5}
          style={{ width: '100%' }}
          options={packageOptions}
        />
      </Form.Item>

      <Divider />
      <Text strong>Capability Removal</Text>

      <Form.Item label="Mode" style={{ marginTop: 8 }}>
        <Radio.Group
          value={cr.mode}
          onChange={(e) => updateConfig('capabilityRemoval', { mode: e.target.value })}
        >
          <Radio value="fixed">Fixed</Radio>
          <Radio value="random">Random</Radio>
          <Radio value="fixed_random">Fixed + random</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item label="Capabilities to remove">
        <Select
          mode="multiple"
          value={cr.fixedCapabilities}
          onChange={(value) => updateConfig('capabilityRemoval', { fixedCapabilities: value })}
          placeholder="Select capabilities"
          maxTagCount={5}
          style={{ width: '100%' }}
          options={capabilityOptions}
        />
      </Form.Item>

      {(cr.mode === 'random' || cr.mode === 'fixed_random') && (
        <Form.Item label="Capability random pool">
          <Select
            mode="multiple"
            value={cr.randomPool}
            onChange={(value) => updateConfig('capabilityRemoval', { randomPool: value })}
            placeholder="Pool for random removal"
            maxTagCount={5}
            style={{ width: '100%' }}
            options={capabilityOptions}
          />
        </Form.Item>
      )}
    </Form>
  );
};
