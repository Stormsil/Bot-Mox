import React from 'react';
import { CrownOutlined, DatabaseOutlined, FlagOutlined, TeamOutlined, TrophyOutlined, UserOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import type { CharacterFormData, ReferenceData } from './types';

const { Text } = Typography;

interface CharacterViewModeProps {
  formData: CharacterFormData;
  referenceData: ReferenceData;
  raceIconUrl: string | null;
}

export const CharacterViewMode: React.FC<CharacterViewModeProps> = ({ formData, referenceData, raceIconUrl }) => (
  <div className="character-view-mode">
    <div className="character-header-section">
      <div className="character-avatar-section">
        {raceIconUrl ? (
          <img
            src={raceIconUrl}
            alt={referenceData.races[formData.race]?.name || formData.race}
            className="character-race-avatar"
          />
        ) : (
          <div className="character-avatar">
            <UserOutlined />
          </div>
        )}
        <div className="character-title">
          <Text className="character-name">{formData.name || 'Unnamed Character'}</Text>
          <Text className="character-subtitle">
            Level {formData.level} {formData.race && referenceData.races[formData.race]?.name}{' '}
            {formData.class && referenceData.classes[formData.class]?.name}
          </Text>
        </div>
      </div>
    </div>

    <div className="character-stats-grid">
      <div className="stat-item">
        <DatabaseOutlined className="stat-icon" />
        <div className="stat-content">
          <Text className="stat-label">Server</Text>
          <Text className="stat-value">{formData.server && referenceData.servers[formData.server]?.name}</Text>
        </div>
      </div>

      <div className="stat-item">
        <FlagOutlined className="stat-icon" />
        <div className="stat-content">
          <Text className="stat-label">Faction</Text>
          <Text className="stat-value capitalize">{formData.faction && referenceData.factions[formData.faction]?.name}</Text>
        </div>
      </div>

      <div className="stat-item">
        <TeamOutlined className="stat-icon" />
        <div className="stat-content">
          <Text className="stat-label">Race</Text>
          <Text className="stat-value">{formData.race && referenceData.races[formData.race]?.name}</Text>
        </div>
      </div>

      <div className="stat-item">
        <CrownOutlined className="stat-icon" />
        <div className="stat-content">
          <Text className="stat-label">Class</Text>
          <Text className="stat-value">{formData.class && referenceData.classes[formData.class]?.name}</Text>
        </div>
      </div>

      <div className="stat-item">
        <TrophyOutlined className="stat-icon" />
        <div className="stat-content">
          <Text className="stat-label">Level</Text>
          <Text className="stat-value">{formData.level}</Text>
        </div>
      </div>
    </div>
  </div>
);
