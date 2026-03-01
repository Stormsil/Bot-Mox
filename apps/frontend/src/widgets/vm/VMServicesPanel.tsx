import { LinkOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useVmSettingsQuery } from '../../entities/vm/api/useVmQueries';
import styles from './VMServicesPanel.module.css';

interface ServiceInfo {
  name: string;
  url: string;
  description: string;
}

export const VMServicesPanel: React.FC = () => {
  const vmSettingsQuery = useVmSettingsQuery();

  const services = useMemo((): ServiceInfo[] => {
    const settings = vmSettingsQuery.data;
    if (!settings) {
      return [];
    }

    return [
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
    ];
  }, [vmSettingsQuery.data]);

  return (
    <div className={styles.root}>
      {services.map((service) => (
        <div key={service.name} className={styles.card}>
          <div className={styles.name}>{service.name}</div>
          <div className={styles.url}>{service.url}</div>
          <div className={styles.description}>{service.description}</div>
          <Button
            type="primary"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => window.open(service.url, '_blank')}
            className={styles.openBtn}
          >
            Open
          </Button>
        </div>
      ))}
    </div>
  );
};
