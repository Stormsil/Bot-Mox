import React from 'react';
import { DatePicker, Form, Input, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { CalendarEventFormValues } from './types';

const { TextArea } = Input;

interface CalendarEventModalProps {
  open: boolean;
  editing: boolean;
  saving: boolean;
  form: FormInstance<CalendarEventFormValues>;
  noteOptions: Array<{ label: string; value: string }>;
  onSave: () => Promise<void>;
  onCancel: () => void;
}

export const CalendarEventModal: React.FC<CalendarEventModalProps> = ({
  open,
  editing,
  saving,
  form,
  noteOptions,
  onSave,
  onCancel,
}) => (
  <Modal
    title={editing ? 'Edit event' : 'Create event'}
    open={open}
    onOk={() => void onSave()}
    onCancel={onCancel}
    confirmLoading={saving}
    destroyOnHidden
  >
    <Form layout="vertical" form={form}>
      <Form.Item
        name="title"
        label="Title"
        rules={[{ required: true, message: 'Title is required' }]}
      >
        <Input placeholder="Event title" maxLength={120} />
      </Form.Item>
      <Form.Item
        name="date"
        label="Date"
        rules={[{ required: true, message: 'Date is required' }]}
      >
        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
      </Form.Item>
      <Form.Item name="linked_note_id" label="Link note (optional)">
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          options={noteOptions}
          placeholder="Select a note from Workspace Notes"
        />
      </Form.Item>
      <Form.Item name="description" label="Description">
        <TextArea rows={4} placeholder="Optional notes..." />
      </Form.Item>
    </Form>
  </Modal>
);
