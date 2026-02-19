import { Alert, Form, Modal, Switch, TimePicker, theme } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { ScheduleSession } from '../../types';
import { generateSessionId, hasOverlap, timeToMinutes } from '../../utils/scheduleUtils';

interface SessionEditorProps {
  session?: ScheduleSession | null;
  existingSessions: ScheduleSession[];
  visible: boolean;
  onSave: (session: ScheduleSession) => void;
  onCancel: () => void;
}

export const SessionEditor: React.FC<SessionEditorProps> = ({
  session,
  existingSessions,
  visible,
  onSave,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!session;
  const { token } = theme.useToken();

  useEffect(() => {
    if (visible) {
      if (session) {
        form.setFieldsValue({
          start: dayjs(session.start, 'HH:mm'),
          end: dayjs(session.end, 'HH:mm'),
          enabled: session.enabled,
        });
      } else {
        // Default values for new session
        form.setFieldsValue({
          start: dayjs('09:00', 'HH:mm'),
          end: dayjs('11:30', 'HH:mm'),
          enabled: true,
        });
      }
      const frameId = window.requestAnimationFrame(() => {
        setError(null);
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }
  }, [visible, session, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      const startTime = values.start.format('HH:mm');
      const endTime = values.end.format('HH:mm');
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      // Check if session crosses midnight (end time is earlier than start time)
      const crossesMidnight = endMinutes < startMinutes;

      // Calculate duration (handle midnight crossing)
      const duration = crossesMidnight
        ? 1440 - startMinutes + endMinutes // Minutes until midnight + minutes from midnight
        : endMinutes - startMinutes;

      // Validate minimum duration (15 minutes)
      if (duration < 15) {
        setError('Session must be at least 15 minutes long');
        return;
      }

      const newSession: ScheduleSession = {
        id: session?.id || generateSessionId(),
        start: startTime,
        end: endTime,
        enabled: values.enabled,
        type: 'active',
      };

      // Check for overlaps
      if (hasOverlap(newSession, existingSessions, session?.id)) {
        setError('This session overlaps with an existing session');
        return;
      }

      setError(null);
      onSave(newSession);
      form.resetFields();
    });
  };

  const handleCancel = () => {
    setError(null);
    form.resetFields();
    onCancel();
  };

  const handleTimeChange = () => {
    setError(null);
  };

  return (
    <Modal
      title={
        <span style={{ color: token.colorText }}>{isEditing ? 'Edit Session' : 'Add Session'}</span>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={isEditing ? 'Save' : 'Add'}
      styles={{
        content: {
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorderSecondary}`,
        },
        header: {
          background: token.colorFillTertiary,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        },
        footer: {
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        },
      }}
    >
      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setError(null)}
        />
      )}

      <Form form={form} layout="vertical">
        <Form.Item
          label="Start Time"
          name="start"
          rules={[{ required: true, message: 'Please select start time' }]}
        >
          <TimePicker
            format="HH:mm"
            minuteStep={5}
            style={{ width: '100%' }}
            onChange={handleTimeChange}
          />
        </Form.Item>

        <Form.Item
          label="End Time"
          name="end"
          rules={[{ required: true, message: 'Please select end time' }]}
        >
          <TimePicker
            format="HH:mm"
            minuteStep={5}
            style={{ width: '100%' }}
            onChange={handleTimeChange}
          />
        </Form.Item>

        <Form.Item label="Enabled" name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};
