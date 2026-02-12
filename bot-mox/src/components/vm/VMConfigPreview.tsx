import React, { useState } from 'react';
import { Button, Space } from 'antd';
import { ThunderboltOutlined, CopyOutlined } from '@ant-design/icons';
import { generateSmbios, generateMac, generateSsdSerial } from '../../utils/vm';
import type { SmbiosResult } from '../../utils/vm';
import './VMConfigPreview.css';

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
    <div className="vm-config-preview">
      <Space>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleGenerate}
        >
          Generate Preview
        </Button>
      </Space>

      {smbiosResult && (
        <>
          <div className="vm-config-preview-details">
            <div className="vm-config-preview-detail">
              <div className="detail-label">Brand / Board</div>
              <div className="detail-value">{smbiosResult.brand} / {smbiosResult.product}</div>
            </div>
            <div className="vm-config-preview-detail">
              <div className="detail-label">CPU</div>
              <div className="detail-value">{smbiosResult.cpu}</div>
            </div>
            <div className="vm-config-preview-detail">
              <div className="detail-label">MAC Address</div>
              <div className="detail-value">{mac}</div>
            </div>
            <div className="vm-config-preview-detail">
              <div className="detail-label">SSD Serial</div>
              <div className="detail-value">{serial}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopy(smbiosResult.args)}
            >
              Copy Args
            </Button>
          </div>

          <div className="vm-config-preview-output">
            {smbiosResult.args}
          </div>
        </>
      )}
    </div>
  );
};
