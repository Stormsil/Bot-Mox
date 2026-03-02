import { CopyOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Alert, Button, Space } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useVmHardwareFingerprintMutation } from '../../entities/vm/api/useVmActionMutations';
import styles from './VMConfigPreview.module.css';

export const VMConfigPreview: React.FC = () => {
  const vmHardwareFingerprintMutation = useVmHardwareFingerprintMutation();
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleGenerate = () => {
    setPreviewError(null);
    vmHardwareFingerprintMutation.mutate(undefined, {
      onError: (error) => {
        setPreviewError(error.message || 'Failed to generate preview');
      },
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const preview = vmHardwareFingerprintMutation.data;
  const meta = preview?.meta ?? {};
  const brand =
    typeof meta.brand === 'string' && meta.brand.trim().length > 0
      ? meta.brand.trim()
      : typeof meta.manufacturer === 'string' && meta.manufacturer.trim().length > 0
        ? meta.manufacturer.trim()
        : '-';
  const product =
    typeof meta.product === 'string' && meta.product.trim().length > 0 ? meta.product.trim() : '-';
  const cpu = typeof meta.cpu === 'string' && meta.cpu.trim().length > 0 ? meta.cpu.trim() : '-';

  return (
    <div className={styles.root}>
      <Space>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleGenerate}
          loading={vmHardwareFingerprintMutation.isPending}
          disabled={vmHardwareFingerprintMutation.isPending}
        >
          Generate Preview
        </Button>
      </Space>
      {previewError && <Alert type="error" showIcon message={previewError} />}

      {preview && (
        <>
          <div className={styles.details}>
            <div className={styles.detail}>
              <div className={styles.detailLabel}>Brand / Board</div>
              <div className={styles.detailValue}>
                {brand} / {product}
              </div>
            </div>
            <div className={styles.detail}>
              <div className={styles.detailLabel}>CPU</div>
              <div className={styles.detailValue}>{cpu}</div>
            </div>
            <div className={styles.detail}>
              <div className={styles.detailLabel}>MAC Address</div>
              <div className={styles.detailValue}>{preview.mac}</div>
            </div>
            <div className={styles.detail}>
              <div className={styles.detailLabel}>SSD Serial</div>
              <div className={styles.detailValue}>{preview.ssdSerial}</div>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopy(preview.smbiosArgs)}
              disabled={vmHardwareFingerprintMutation.isPending}
            >
              Copy Args
            </Button>
          </div>

          <div className={styles.output}>{preview.smbiosArgs}</div>
        </>
      )}
    </div>
  );
};
