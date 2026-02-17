import React from 'react';
import { CrownOutlined, DatabaseOutlined, FlagOutlined, TeamOutlined, TrophyOutlined, UserOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import type { CharacterFormData, ReferenceData } from './types';
import styles from './character.module.css';

const { Text } = Typography;

interface CharacterViewModeProps {
  formData: CharacterFormData;
  referenceData: ReferenceData;
  raceIconUrl: string | null;
}

export const CharacterViewMode: React.FC<CharacterViewModeProps> = ({ formData, referenceData, raceIconUrl }) => (
  <div className={styles['character-view-mode']}>
    <div className={styles['character-header-section']}>
      <div className={styles['character-avatar-section']}>
        {raceIconUrl ? (
          <img
            src={raceIconUrl}
            alt={referenceData.races[formData.race]?.name || formData.race}
            className={styles['character-race-avatar']}
          />
        ) : (
          <div className={styles['character-avatar']}>
            <UserOutlined />
          </div>
        )}
        <div className={styles['character-title']}>
          <Text className={styles['character-name']}>{formData.name || 'Unnamed Character'}</Text>
          <Text className={styles['character-subtitle']}>
            Level {formData.level} {formData.race && referenceData.races[formData.race]?.name}{' '}
            {formData.class && referenceData.classes[formData.class]?.name}
          </Text>
        </div>
      </div>
    </div>

    <div className={styles['character-stats-grid']}>
      <div className={styles['stat-item']}>
        <DatabaseOutlined className={styles['stat-icon']} />
        <div className={styles['stat-content']}>
          <Text className={styles['stat-label']}>Server</Text>
          <Text className={styles['stat-value']}>{formData.server && referenceData.servers[formData.server]?.name}</Text>
        </div>
      </div>

      <div className={styles['stat-item']}>
        <FlagOutlined className={styles['stat-icon']} />
        <div className={styles['stat-content']}>
          <Text className={styles['stat-label']}>Faction</Text>
          <Text className={[styles['stat-value'], styles.capitalize].join(' ')}>{formData.faction && referenceData.factions[formData.faction]?.name}</Text>
        </div>
      </div>

      <div className={styles['stat-item']}>
        <TeamOutlined className={styles['stat-icon']} />
        <div className={styles['stat-content']}>
          <Text className={styles['stat-label']}>Race</Text>
          <Text className={styles['stat-value']}>{formData.race && referenceData.races[formData.race]?.name}</Text>
        </div>
      </div>

      <div className={styles['stat-item']}>
        <CrownOutlined className={styles['stat-icon']} />
        <div className={styles['stat-content']}>
          <Text className={styles['stat-label']}>Class</Text>
          <Text className={styles['stat-value']}>{formData.class && referenceData.classes[formData.class]?.name}</Text>
        </div>
      </div>

      <div className={styles['stat-item']}>
        <TrophyOutlined className={styles['stat-icon']} />
        <div className={styles['stat-content']}>
          <Text className={styles['stat-label']}>Level</Text>
          <Text className={styles['stat-value']}>{formData.level}</Text>
        </div>
      </div>
    </div>
  </div>
);
