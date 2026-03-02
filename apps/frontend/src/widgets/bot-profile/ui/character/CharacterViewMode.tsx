import {
  CrownOutlined,
  DatabaseOutlined,
  FlagOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Flex, Typography } from 'antd';
import type React from 'react';
import styles from './character.module.css';
import type { CharacterFormData, ReferenceData } from './types';

const { Text } = Typography;

interface CharacterViewModeProps {
  formData: CharacterFormData;
  referenceData: ReferenceData;
  raceIconUrl: string | null;
}

export const CharacterViewMode: React.FC<CharacterViewModeProps> = ({
  formData,
  referenceData,
  raceIconUrl,
}) => (
  <Flex vertical className={styles['character-view-mode']} gap={24}>
    <Flex className={styles['character-header-section']} align="center" justify="space-between">
      <Flex className={styles['character-avatar-section']} align="center" gap={16}>
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
        <Flex vertical className={styles['character-title']} gap={4}>
          <Text className={styles['character-name']}>{formData.name || 'Unnamed Character'}</Text>
          <Text className={styles['character-subtitle']}>
            Level {formData.level} {formData.race && referenceData.races[formData.race]?.name}{' '}
            {formData.class && referenceData.classes[formData.class]?.name}
          </Text>
        </Flex>
      </Flex>
    </Flex>

    <Flex wrap gap={16} className={styles['character-stats-grid']}>
      <Flex className={styles['stat-item']} align="flex-start" gap={12}>
        <DatabaseOutlined className={styles['stat-icon']} />
        <Flex vertical className={styles['stat-content']} gap={4}>
          <Text className={styles['stat-label']}>Server</Text>
          <Text className={styles['stat-value']}>
            {formData.server && referenceData.servers[formData.server]?.name}
          </Text>
        </Flex>
      </Flex>

      <Flex className={styles['stat-item']} align="flex-start" gap={12}>
        <FlagOutlined className={styles['stat-icon']} />
        <Flex vertical className={styles['stat-content']} gap={4}>
          <Text className={styles['stat-label']}>Faction</Text>
          <Text className={[styles['stat-value'], styles.capitalize].join(' ')}>
            {formData.faction && referenceData.factions[formData.faction]?.name}
          </Text>
        </Flex>
      </Flex>

      <Flex className={styles['stat-item']} align="flex-start" gap={12}>
        <TeamOutlined className={styles['stat-icon']} />
        <Flex vertical className={styles['stat-content']} gap={4}>
          <Text className={styles['stat-label']}>Race</Text>
          <Text className={styles['stat-value']}>
            {formData.race && referenceData.races[formData.race]?.name}
          </Text>
        </Flex>
      </Flex>

      <Flex className={styles['stat-item']} align="flex-start" gap={12}>
        <CrownOutlined className={styles['stat-icon']} />
        <Flex vertical className={styles['stat-content']} gap={4}>
          <Text className={styles['stat-label']}>Class</Text>
          <Text className={styles['stat-value']}>
            {formData.class && referenceData.classes[formData.class]?.name}
          </Text>
        </Flex>
      </Flex>

      <Flex className={styles['stat-item']} align="flex-start" gap={12}>
        <TrophyOutlined className={styles['stat-icon']} />
        <Flex vertical className={styles['stat-content']} gap={4}>
          <Text className={styles['stat-label']}>Level</Text>
          <Text className={styles['stat-value']}>{formData.level}</Text>
        </Flex>
      </Flex>
    </Flex>
  </Flex>
);
