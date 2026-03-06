import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UnattendProfileConfig } from '../../../../entities/vm/model/unattend';
import {
  type BloatwarePackage,
  getWindowsBloatwarePackages,
  getWindowsCapabilities,
  type WindowsCapability,
} from '../../../../shared/config/data/windows-bloatware';
import {
  AppButton as Button,
  AppDivider as Divider,
  AppForm as Form,
  AppRadio as Radio,
  AppSelect as Select,
  AppSlider as Slider,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../../../shared/ui';

const { Text } = Typography;

interface BloatwareSectionProps {
  config: UnattendProfileConfig;
  updateConfig: <K extends keyof UnattendProfileConfig>(
    section: K,
    patch: Partial<UnattendProfileConfig[K]>,
  ) => void;
}

export const BloatwareSection: React.FC<BloatwareSectionProps> = ({ config, updateConfig }) => {
  const [bloatwarePackages, setBloatwarePackages] = useState<BloatwarePackage[]>([]);
  const [windowsCapabilities, setWindowsCapabilities] = useState<WindowsCapability[]>([]);
  const [isDictionaryLoading, setIsDictionaryLoading] = useState(true);
  const [dictionaryLoadError, setDictionaryLoadError] = useState<string | null>(null);
  const isSubscribedRef = useRef(true);

  const loadDictionaries = useCallback(async () => {
    setIsDictionaryLoading(true);
    setDictionaryLoadError(null);

    try {
      const [loadedPackages, loadedCapabilities] = await Promise.all([
        getWindowsBloatwarePackages(),
        getWindowsCapabilities(),
      ]);

      if (!isSubscribedRef.current) {
        return;
      }

      setBloatwarePackages(loadedPackages);
      setWindowsCapabilities(loadedCapabilities);
    } catch (error) {
      console.error('Failed to load unattend bloatware dictionaries:', error);
      if (!isSubscribedRef.current) {
        return;
      }
      setDictionaryLoadError('Failed to load bloatware dictionaries. Please retry.');
    } finally {
      if (isSubscribedRef.current) {
        setIsDictionaryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDictionaries();

    return () => {
      isSubscribedRef.current = false;
    };
  }, [loadDictionaries]);

  const sr = config.softwareRemoval;
  const cr = config.capabilityRemoval;
  const handleSelectAll = (field: 'fixedPackages' | 'randomPool') => {
    updateConfig('softwareRemoval', { [field]: bloatwarePackages.map((p) => p.id) });
  };

  const handleClearAll = (field: 'fixedPackages' | 'randomPool') => {
    updateConfig('softwareRemoval', { [field]: [] });
  };

  const packageOptions = bloatwarePackages.map((p) => ({
    label: p.name,
    value: p.id,
  }));

  const capabilityOptions = windowsCapabilities.map((c) => ({
    label: c.name,
    value: c.id,
  }));

  return (
    <Form layout="vertical" size="small">
      {dictionaryLoadError && (
        <Form.Item>
          <Space>
            <Text type="danger">{dictionaryLoadError}</Text>
            <Button
              size="small"
              onClick={() => {
                void loadDictionaries();
              }}
              loading={isDictionaryLoading}
            >
              Retry
            </Button>
          </Space>
        </Form.Item>
      )}

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
            loading={isDictionaryLoading}
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
              loading={isDictionaryLoading}
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
          loading={isDictionaryLoading}
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
          loading={isDictionaryLoading}
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
            loading={isDictionaryLoading}
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
