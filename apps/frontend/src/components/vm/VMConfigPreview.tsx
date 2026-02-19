import { CopyOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { SmbiosResult } from '../../utils/vm';
import { generateMac, generateSmbios, generateSsdSerial } from '../../utils/vm';
import styles from './VMConfigPreview.module.css';

export const VMConfigPreview: React.FC = () => {
  const [smbiosResult, setSmbiosResult] = useState<SmbiosResult | null>(null);
  const [mac, setMac] = useState('');
  const [serial, setSerial] = useState('');

  const handleGenerate = () => {
    setSmbiosResult(generateSmbios());
    setMac(generateMac());
    setSerial(generateSsdSerial());
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={styles.root}>
      <Space>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerate}>
          Generate Preview
        </Button>
      </Space>

      {smbiosResult && (
        <>
          <div className={styles.details}>
            <div className={styles.detail}>
              <div className={styles.detailLabel}>Brand / Board</div>
              <div className={styles.detailValue}>
                {smbiosResult.brand} / {smbiosResult.product}
              </div>
            </div>
            <div className={styles.detail}>
              <div className={styles.detailLabel}>CPU</div>
              <div className={styles.detailValue}>{smbiosResult.cpu}</div>
            </div>
            <div className={styles.detail}>
              <div className={styles.detailLabel}>MAC Address</div>
              <div className={styles.detailValue}>{mac}</div>
            </div>
            <div className={styles.detail}>
              <div className={styles.detailLabel}>SSD Serial</div>
              <div className={styles.detailValue}>{serial}</div>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopy(smbiosResult.args)}
            >
              Copy Args
            </Button>
          </div>

          <div className={styles.output}>{smbiosResult.args}</div>
        </>
      )}
    </div>
  );
};
