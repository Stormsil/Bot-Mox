import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { getVMSettings } from '../../services/vmSettingsService';
import './VMServicesPanel.css';

interface ServiceInfo {
  name: string;
  url: string;
  description: string;
}

export const VMServicesPanel: React.FC = () => {
  const [services, setServices] = useState<ServiceInfo[]>([]);

  useEffect(() => {
    getVMSettings().then(settings => {
      setServices([
        {
          name: 'Proxmox VE',
          url: settings.services?.proxmoxUrl || settings.proxmox?.url || 'https://192.168.0.43:8006/',
          description: 'Virtual machine management web interface',
        },
        {
          name: 'TinyFileManager',
          url: settings.services?.tinyFmUrl || 'http://192.168.0.43:8080/index.php?',
          description: 'File manager for VM config files on the host',
        },
        {
          name: 'SyncThing',
          url: settings.services?.syncThingUrl || 'https://127.0.0.1:8384/',
          description: 'File synchronization between host and VMs',
        },
      ]);
    });
  }, []);

  return (
    <div className="vm-services-panel">
      {services.map(service => (
        <div key={service.name} className="vm-service-card">
          <div className="service-name">{service.name}</div>
          <div className="service-url">{service.url}</div>
          <div className="service-description">{service.description}</div>
          <Button
            type="primary"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => window.open(service.url, '_blank')}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            Open
          </Button>
        </div>
      ))}
    </div>
  );
};
