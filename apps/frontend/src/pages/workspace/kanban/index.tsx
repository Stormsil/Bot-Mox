import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { message } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  useCreateKanbanTaskMutation,
  useDeleteKanbanTaskMutation,
  useUpdateKanbanTaskMutation,
} from '../../../entities/workspace/api/useWorkspaceMutations';
import { useWorkspaceKanbanTasksQuery } from '../../../entities/workspace/api/useWorkspaceQueries';
import type { KanbanStatus, KanbanTask } from '../../../entities/workspace/model/types';
import { uiLogger } from '../../../observability/uiLogger';
import {
  AppButton as Button,
  AppCard as Card,
  AppDatePicker as DatePicker,
  AppEmpty as Empty,
  AppForm as Form,
  AppInput as Input,
  AppModal as Modal,
  AppPopconfirm as Popconfirm,
  AppSelect as Select,
  AppSpace as Space,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../../shared/ui';
import { TableActionButton } from '../../../shared/ui/TableActionButton';
import styles from './WorkspaceKanbanPage.module.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface KanbanFormValues {
  title: string;
  description?: string;
  status: KanbanStatus;
  due_date?: Dayjs;
}

const STATUSES: Array<{ key: KanbanStatus; title: string; color: string }> = [
  { key: 'todo', title: 'Todo', color: 'default' },
  { key: 'in_progress', title: 'In Progress', color: 'processing' },
  { key: 'done', title: 'Done', color: 'success' },
];

export const WorkspaceKanbanPage: React.FC = () => {
  const kanbanTasksQuery = useWorkspaceKanbanTasksQuery();
  const createKanbanTaskMutation = useCreateKanbanTaskMutation();
  const updateKanbanTaskMutation = useUpdateKanbanTaskMutation();
  const deleteKanbanTaskMutation = useDeleteKanbanTaskMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [form] = Form.useForm<KanbanFormValues>();

  useEffect(() => {
    if (!kanbanTasksQuery.error) {
      return;
    }
    uiLogger.error('Failed to load kanban tasks:', kanbanTasksQuery.error);
    message.error('Failed to load kanban tasks');
  }, [kanbanTasksQuery.error]);

  const tasks = useMemo<KanbanTask[]>(() => kanbanTasksQuery.data || [], [kanbanTasksQuery.data]);
  const loading = kanbanTasksQuery.isLoading;

  const tasksByStatus = useMemo(() => {
    const grouped: Record<KanbanStatus, KanbanTask[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };
    tasks.forEach((task) => {
      grouped[task.status].push(task);
    });
    return grouped;
  }, [tasks]);

  const getNextOrder = (status: KanbanStatus): number => {
    const statusTasks = tasksByStatus[status];
    if (statusTasks.length === 0) return Date.now();
    return Math.max(...statusTasks.map((task) => task.order)) + 1;
  };

  const openCreateModal = (status: KanbanStatus = 'todo') => {
    setEditingTask(null);
    form.setFieldsValue({
      title: '',
      description: '',
      status,
      due_date: undefined,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (task: KanbanTask) => {
    setEditingTask(task);
    form.setFieldsValue({
      title: task.title,
      description: task.description,
      status: task.status,
      due_date: task.due_date ? dayjs(task.due_date, 'YYYY-MM-DD') : undefined,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
    form.resetFields();
  };

  const handleSave = async () => {
    let values: KanbanFormValues;
    try {
      values = await form.validateFields();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in (error as object)) {
        return;
      }
      uiLogger.error('Failed to validate task form:', error);
      return;
    }

    const payload = {
      title: values.title.trim(),
      description: values.description?.trim() ?? '',
      status: values.status,
      due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
    };

    if (editingTask) {
      updateKanbanTaskMutation.mutate(
        { id: editingTask.id, data: payload },
        {
          onSuccess: () => {
            closeModal();
          },
        },
      );
      return;
    }

    createKanbanTaskMutation.mutate(
      {
        ...payload,
        order: getNextOrder(payload.status),
      },
      {
        onSuccess: () => {
          closeModal();
        },
      },
    );
  };

  const handleDelete = (taskId: string) => {
    deleteKanbanTaskMutation.mutate(taskId);
  };

  const moveTask = (task: KanbanTask) => {
    const currentIndex = STATUSES.findIndex((item) => item.key === task.status);
    if (currentIndex < 0 || currentIndex === STATUSES.length - 1) {
      return;
    }
    const nextStatus = STATUSES[currentIndex + 1].key;
    updateKanbanTaskMutation.mutate({
      id: task.id,
      data: {
        status: nextStatus,
        order: getNextOrder(nextStatus),
      },
    });
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Title
          level={4}
          className={styles.title}
          style={{ margin: 0, color: 'var(--boxmox-color-text-primary)' }}
        >
          <span className={styles.titleIcon} aria-hidden>
            <CheckCircleOutlined />
          </span>
          Workspace Kanban
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal('todo')}>
          Add task
        </Button>
      </div>

      <div className={styles.board}>
        {STATUSES.map((column) => {
          const columnTasks = tasksByStatus[column.key];
          return (
            <Card
              key={column.key}
              className={styles.column}
              classNames={{ body: styles.columnBody }}
              title={
                <Space>
                  <span>{column.title}</span>
                  <Tag color={column.color}>{columnTasks.length}</Tag>
                </Space>
              }
              extra={
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => openCreateModal(column.key)}
                >
                  New
                </Button>
              }
              loading={loading}
            >
              {columnTasks.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<Text type="secondary">No tasks</Text>}
                />
              ) : (
                <div className={styles.tasks}>
                  {columnTasks.map((task) => (
                    <Card
                      key={task.id}
                      className={styles.task}
                      classNames={{ body: styles.taskBody }}
                      size="small"
                    >
                      <div className={styles.taskHeader}>
                        <Text strong>{task.title}</Text>
                        <Space size={2}>
                          {task.status !== 'done' && (
                            <TableActionButton
                              icon={<RightOutlined />}
                              onClick={() => moveTask(task)}
                              tooltip="Move to next column"
                            />
                          )}
                          <TableActionButton
                            icon={<EditOutlined />}
                            onClick={() => openEditModal(task)}
                            tooltip="Edit task"
                          />
                          <Popconfirm
                            title="Delete task?"
                            okText="Delete"
                            cancelText="Cancel"
                            onConfirm={() => handleDelete(task.id)}
                          >
                            <TableActionButton
                              danger
                              icon={<DeleteOutlined />}
                              tooltip="Delete task"
                            />
                          </Popconfirm>
                        </Space>
                      </div>
                      {task.description ? (
                        <Text className={styles.taskDescription}>{task.description}</Text>
                      ) : (
                        <Text type="secondary" className={styles.taskDescription}>
                          No description
                        </Text>
                      )}
                      <div className={styles.taskFooter}>
                        {task.due_date ? (
                          <Tag
                            color={dayjs(task.due_date).isBefore(dayjs(), 'day') ? 'error' : 'blue'}
                          >
                            Due {dayjs(task.due_date).format('DD MMM')}
                          </Tag>
                        ) : (
                          <Tag>Without due date</Tag>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal
        title={editingTask ? 'Edit task' : 'Create task'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={closeModal}
        confirmLoading={createKanbanTaskMutation.isPending || updateKanbanTaskMutation.isPending}
        destroyOnHidden
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder="Task title" maxLength={120} />
          </Form.Item>

          <Form.Item name="status" label="Column" rules={[{ required: true }]}>
            <Select
              options={STATUSES.map((status) => ({
                value: status.key,
                label: status.title,
              }))}
            />
          </Form.Item>

          <Form.Item name="due_date" label="Due date">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={4} placeholder="Task details..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WorkspaceKanbanPage;
