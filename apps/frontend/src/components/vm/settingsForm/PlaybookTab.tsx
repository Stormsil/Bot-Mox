import {
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { Button, Card, Checkbox, Input, message, Space, Spin, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PLAYBOOK_CONTENT } from '../../../data/default-playbook';
import {
  createPlaybook,
  deletePlaybook,
  listPlaybooks,
  type Playbook,
  type PlaybookValidationResult,
  updatePlaybook,
  validatePlaybook,
} from '../../../entities/vm/api/playbookFacade';
import styles from './PlaybookTab.module.css';

const { Text } = Typography;

export const PlaybookTab: React.FC = () => {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playbookName, setPlaybookName] = useState('');
  const [content, setContent] = useState(DEFAULT_PLAYBOOK_CONTENT);
  const [isDefault, setIsDefault] = useState(false);
  const [validation, setValidation] = useState<PlaybookValidationResult | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const playbookNameRef = useRef(playbookName);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    playbookNameRef.current = playbookName;
  }, [playbookName]);

  const loadPlaybooks = useCallback(async () => {
    setLoading(true);
    try {
      const envelope = await listPlaybooks();
      const loaded = envelope.data || [];
      setPlaybooks(loaded);

      if (!selectedIdRef.current && !playbookNameRef.current && loaded.length > 0) {
        const preferred = loaded.find((p) => p.is_default) || loaded[0];
        if (preferred) {
          setSelectedId(preferred.id);
          setPlaybookName(preferred.name);
          setContent(preferred.content);
          setIsDefault(preferred.is_default);
        }
      }
    } catch {
      message.error('Failed to load playbooks');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPlaybooks();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPlaybooks]);

  const handleSelect = useCallback(
    (id: string) => {
      const playbook = playbooks.find((p) => p.id === id);
      if (!playbook) return;
      setSelectedId(id);
      setPlaybookName(playbook.name);
      setContent(playbook.content);
      setIsDefault(playbook.is_default);
      setValidation(null);
    },
    [playbooks],
  );

  const handleNew = useCallback(() => {
    setSelectedId(null);
    setPlaybookName('');
    setContent(DEFAULT_PLAYBOOK_CONTENT);
    setIsDefault(false);
    setValidation(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!playbookName.trim()) {
      message.warning('Playbook name is required');
      return;
    }
    if (!content.trim()) {
      message.warning('Playbook content is required');
      return;
    }

    setSaving(true);
    try {
      if (selectedId) {
        const envelope = await updatePlaybook(selectedId, {
          name: playbookName.trim(),
          is_default: isDefault,
          content,
        });
        setPlaybooks((prev) => prev.map((p) => (p.id === selectedId ? envelope.data : p)));
        message.success('Playbook updated');
      } else {
        const envelope = await createPlaybook({
          name: playbookName.trim(),
          is_default: isDefault,
          content,
        });
        setPlaybooks((prev) => [...prev, envelope.data]);
        setSelectedId(envelope.data.id);
        message.success('Playbook created');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      message.error(`Failed to save playbook: ${errorMessage}`);
    }
    setSaving(false);
  }, [content, isDefault, playbookName, selectedId]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;

    setSaving(true);
    try {
      await deletePlaybook(selectedId);
      setPlaybooks((prev) => prev.filter((p) => p.id !== selectedId));
      setSelectedId(null);
      setPlaybookName('');
      setContent(DEFAULT_PLAYBOOK_CONTENT);
      setIsDefault(false);
      setValidation(null);
      message.success('Playbook deleted');
    } catch {
      message.error('Failed to delete playbook');
    }
    setSaving(false);
  }, [selectedId]);

  const handleValidate = useCallback(async () => {
    if (!content.trim()) return;
    try {
      const envelope = await validatePlaybook(content);
      setValidation(envelope.data);
      if (envelope.data.valid) {
        message.success('Playbook is valid');
      } else {
        message.warning('Playbook has validation errors');
      }
    } catch {
      message.error('Validation request failed');
    }
  }, [content]);

  const handleExport = useCallback(() => {
    const blob = new Blob([content], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playbookName.trim() || 'playbook'}.yml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, playbookName]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yml,.yaml';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      setContent(text);
      setValidation(null);
      if (!playbookName.trim()) {
        setPlaybookName(file.name.replace(/\.(yml|yaml)$/i, ''));
      }
    };
    input.click();
  }, [playbookName]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spin />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <Card
        size="small"
        className={styles.sidebarCard}
        title={<Text strong>Playbooks</Text>}
        extra={<Button type="link" size="small" icon={<PlusOutlined />} onClick={handleNew} />}
      >
        <div className={styles.sidebarList}>
          {playbooks.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className={[
                styles.sidebarItem,
                p.id === selectedId ? styles.sidebarItemActive : '',
                p.is_default ? styles.sidebarItemDefault : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {p.is_default && <span style={{ marginRight: 4 }}>*</span>}
              {p.name}
            </button>
          ))}
          {playbooks.length === 0 && (
            <Text type="secondary" className={styles.sidebarEmpty}>
              No playbooks yet
            </Text>
          )}
        </div>
      </Card>

      {/* Editor */}
      <Card size="small" className={styles.editorCard}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div className={styles.headerRow}>
            <Input
              placeholder="Playbook name"
              value={playbookName}
              onChange={(e) => setPlaybookName(e.target.value)}
              className={styles.nameInput}
            />
            <Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}>
              Default
            </Checkbox>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
              Save
            </Button>
            {selectedId && (
              <Button danger icon={<DeleteOutlined />} loading={saving} onClick={handleDelete}>
                Delete
              </Button>
            )}
          </div>

          <div className={styles.editorBox}>
            <Editor
              height="400px"
              language="yaml"
              value={content}
              onChange={(value) => {
                setContent(value || '');
                setValidation(null);
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
              }}
            />
          </div>

          <div className={styles.footerRow}>
            <div className={styles.validation}>
              {validation && (
                <Text type={validation.valid ? 'success' : 'danger'}>
                  {validation.valid
                    ? `Valid${validation.warnings.length > 0 ? ` (${validation.warnings.length} warning${validation.warnings.length === 1 ? '' : 's'})` : ''}`
                    : `${validation.errors.length} error${validation.errors.length === 1 ? '' : 's'}`}
                </Text>
              )}
              {validation?.warnings.map((w) => (
                <div key={w.message}>
                  <Text type="warning" className={styles.validationLine}>
                    {w.message}
                  </Text>
                </div>
              ))}
              {validation?.errors.map((e) => (
                <div key={`${e.path || 'root'}:${e.message}`}>
                  <Text type="danger" className={styles.validationLine}>
                    {e.path ? `${e.path}: ` : ''}
                    {e.message}
                  </Text>
                </div>
              ))}
            </div>
            <Space>
              <Button size="small" onClick={handleValidate}>
                Validate
              </Button>
              <Button size="small" icon={<UploadOutlined />} onClick={handleImport}>
                Import
              </Button>
              <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>
                Export
              </Button>
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
};
