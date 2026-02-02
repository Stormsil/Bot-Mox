import React, { useState, useCallback } from 'react';
import { Button, InputNumber, TimePicker, Form, Space, Popover } from 'antd';
import { SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ScheduleGenerationParams } from '../../types';
import { timeToMinutes } from '../../utils/scheduleUtils';
import dayjs from 'dayjs';
import './ScheduleGenerator.css';

interface ScheduleGeneratorProps {
  onGenerate: (params: ScheduleGenerationParams) => void;
  disabled?: boolean;
}

// Дефолтные значения параметров - ОПТИМИЗИРОВАННЫЕ
// Рассчитаны для стабильной генерации 12+ часов активного времени
const DEFAULT_PARAMS: ScheduleGenerationParams = {
  startTime: '06:00',       // Раньше начинаем - больше времени для сессий
  endTime: '23:59',         // Почти до полуночи
  targetActiveMinutes: 720, // 12 часов - оптимальная цель
  minSessionMinutes: 45,    // 45 минут - компромисс между гибкостью и стабильностью
  minBreakMinutes: 15,      // 15 минут минимум - позволяет больше сессий
  randomOffsetMinutes: 10,  // ±10 минут - меньше хаоса, больше предсказуемости
  profile: 'farming'
};

// Ограничения для валидации - с проверкой достижимости
const CONSTRAINTS = {
  minSessionMinutes: { min: 15, max: 240 },
  minBreakMinutes: { min: 5, max: 120 },
  randomOffsetMinutes: { min: 0, max: 30 }, // Ограничиваем для стабильности
  targetActiveMinutes: { min: 30, max: 1380 } // 30 мин - 23 часа
};

export const ScheduleGenerator: React.FC<ScheduleGeneratorProps> = ({
  onGenerate,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [params, setParams] = useState<ScheduleGenerationParams>(DEFAULT_PARAMS);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Валидация параметров с проверкой достижимости цели
  const validateParams = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    
    const windowStart = timeToMinutes(params.startTime);
    const windowEnd = timeToMinutes(params.endTime);
    const windowDuration = windowEnd - windowStart;
    
    if (windowDuration <= 0) {
      newErrors.endTime = 'End time must be after start time';
    }
    
    if (params.targetActiveMinutes > windowDuration) {
      newErrors.targetActiveMinutes = `Cannot exceed window duration (${windowDuration} min)`;
    }
    
    if (params.minSessionMinutes < CONSTRAINTS.minSessionMinutes.min) {
      newErrors.minSessionMinutes = `Minimum ${CONSTRAINTS.minSessionMinutes.min} minutes`;
    }
    
    if (params.minSessionMinutes > CONSTRAINTS.minSessionMinutes.max) {
      newErrors.minSessionMinutes = `Maximum ${CONSTRAINTS.minSessionMinutes.max} minutes`;
    }
    
    if (params.minBreakMinutes < CONSTRAINTS.minBreakMinutes.min) {
      newErrors.minBreakMinutes = `Minimum ${CONSTRAINTS.minBreakMinutes.min} minutes`;
    }
    
    if (params.randomOffsetMinutes > CONSTRAINTS.randomOffsetMinutes.max) {
      newErrors.randomOffsetMinutes = `Maximum ${CONSTRAINTS.randomOffsetMinutes.max} minutes`;
    }
    
    // ПРОВЕРКА ДОСТИЖИМОСТИ: Можем ли мы достичь targetActiveMinutes с текущими настройками?
    if (windowDuration > 0) {
      // Минимальное время для одной сессии = minSessionMinutes + minBreakMinutes (кроме последней)
      // Для N сессий нужно: N * minSessionMinutes + (N-1) * minBreakMinutes <= windowDuration
      // Решаем: N * (minSessionMinutes + minBreakMinutes) - minBreakMinutes <= windowDuration
      // N <= (windowDuration + minBreakMinutes) / (minSessionMinutes + minBreakMinutes)
      const maxSessionsPossible = Math.floor(
        (windowDuration + params.minBreakMinutes) / 
        (params.minSessionMinutes + params.minBreakMinutes)
      );
      
      // Максимальное активное время = maxSessionsPossible * minSessionMinutes
      const maxAchievableActiveTime = maxSessionsPossible * params.minSessionMinutes;
      
      if (params.targetActiveMinutes > maxAchievableActiveTime) {
        newErrors.targetActiveMinutes = 
          `With min session ${params.minSessionMinutes}min and break ${params.minBreakMinutes}min, ` +
          `maximum achievable is ${maxAchievableActiveTime}min (${Math.floor(maxAchievableActiveTime / 60)}h ${maxAchievableActiveTime % 60}m). ` +
          `Either reduce target, decrease min session/break, or extend time window.`;
      }
      
      // Дополнительная проверка: targetActiveMinutes должен быть разумным
      // Рекомендуемое максимальное активное время = 70% от windowDuration
      const recommendedMaxActive = Math.floor(windowDuration * 0.75);
      if (params.targetActiveMinutes > recommendedMaxActive && !newErrors.targetActiveMinutes) {
        // Предупреждение, но не ошибка
        console.warn(
          `[ScheduleGenerator] Target ${params.targetActiveMinutes}min exceeds recommended 75% of window ` +
          `(${recommendedMaxActive}min). Generation may produce suboptimal results.`
        );
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [params]);

  // Обработчик генерации
  const handleGenerate = useCallback(() => {
    if (!validateParams()) return;
    
    onGenerate(params);
    setIsOpen(false);
  }, [params, validateParams, onGenerate]);

  // Обновление параметра
  const updateParam = useCallback(<K extends keyof ScheduleGenerationParams>(
    key: K,
    value: ScheduleGenerationParams[K]
  ) => {
    setParams(prev => ({ ...prev, [key]: value }));
    // Очищаем ошибку для этого поля
    if (errors[key]) {
      setErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    }
  }, [errors]);

  // Контент поповера с параметрами
  const popoverContent = (
    <div className="schedule-generator-form">
      <Form layout="vertical" size="small">
        <div className="generator-row">
          <Form.Item 
            label="Farm Start" 
            validateStatus={errors.startTime ? 'error' : undefined}
            help={errors.startTime}
          >
            <TimePicker
              value={dayjs(params.startTime, 'HH:mm')}
              onChange={(time) => updateParam('startTime', time?.format('HH:mm') || '09:00')}
              format="HH:mm"
              size="small"
            />
          </Form.Item>
          
          <Form.Item 
            label="Farm End"
            validateStatus={errors.endTime ? 'error' : undefined}
            help={errors.endTime}
          >
            <TimePicker
              value={dayjs(params.endTime, 'HH:mm')}
              onChange={(time) => updateParam('endTime', time?.format('HH:mm') || '23:00')}
              format="HH:mm"
              size="small"
            />
          </Form.Item>
        </div>

        <Form.Item 
          label={`Target Active Time: ${params.targetActiveMinutes} min (${Math.floor(params.targetActiveMinutes / 60)}h ${params.targetActiveMinutes % 60}m)`}
          validateStatus={errors.targetActiveMinutes ? 'error' : undefined}
          help={errors.targetActiveMinutes}
        >
          <InputNumber
            min={CONSTRAINTS.targetActiveMinutes.min}
            max={CONSTRAINTS.targetActiveMinutes.max}
            value={params.targetActiveMinutes}
            onChange={(value) => updateParam('targetActiveMinutes', value || 480)}
            size="small"
            style={{ width: '100%' }}
            step={15}
          />
        </Form.Item>

        <div className="generator-row">
          <Form.Item 
            label="Min Session"
            validateStatus={errors.minSessionMinutes ? 'error' : undefined}
            help={errors.minSessionMinutes}
          >
            <InputNumber
              min={CONSTRAINTS.minSessionMinutes.min}
              max={CONSTRAINTS.minSessionMinutes.max}
              value={params.minSessionMinutes}
              onChange={(value) => updateParam('minSessionMinutes', value || 60)}
              size="small"
              addonAfter="min"
            />
          </Form.Item>
          
          <Form.Item 
            label="Min Break"
            validateStatus={errors.minBreakMinutes ? 'error' : undefined}
            help={errors.minBreakMinutes}
          >
            <InputNumber
              min={CONSTRAINTS.minBreakMinutes.min}
              max={CONSTRAINTS.minBreakMinutes.max}
              value={params.minBreakMinutes}
              onChange={(value) => updateParam('minBreakMinutes', value || 30)}
              size="small"
              addonAfter="min"
            />
          </Form.Item>
        </div>

        <Form.Item 
          label={`Random Offset: ±${params.randomOffsetMinutes} min`}
          validateStatus={errors.randomOffsetMinutes ? 'error' : undefined}
          help={errors.randomOffsetMinutes}
        >
          <InputNumber
            min={CONSTRAINTS.randomOffsetMinutes.min}
            max={CONSTRAINTS.randomOffsetMinutes.max}
            value={params.randomOffsetMinutes}
            onChange={(value) => updateParam('randomOffsetMinutes', value || 0)}
            size="small"
            style={{ width: '100%' }}
            addonAfter="min"
          />
        </Form.Item>

        <Space className="generator-actions">
          <Button size="small" onClick={() => setParams(DEFAULT_PARAMS)}>
            Reset
          </Button>
          <Button 
            type="primary" 
            size="small" 
            icon={<ThunderboltOutlined />}
            onClick={handleGenerate}
          >
            Generate
          </Button>
        </Space>
      </Form>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      title="Schedule Generator Settings"
      trigger="click"
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="bottomRight"
    >
      <Button
        icon={<SettingOutlined />}
        size="small"
        disabled={disabled}
      >
        Generate
      </Button>
    </Popover>
  );
};
