/**
 * @fileoverview Markdown редактор заметки на базе @uiw/react-md-editor
 * Управляет редактированием markdown текста, автосохранением и взаимодействием с backend API
 */

import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PushpinFilled,
  PushpinOutlined,
  SaveOutlined,
  SplitCellsOutlined,
} from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import { Button, Input, message, Space, Tag, Tooltip } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import remarkGfm from 'remark-gfm';
import {
  useDeleteNoteMutation,
  useUpdateNoteMutation,
} from '../../entities/notes/api/useNoteMutations';
import type { Note } from '../../entities/notes/model/types';
import { TableActionButton } from '../ui/TableActionButton';
import '@uiw/react-md-editor/markdown-editor.css';
import styles from './NoteEditor.module.css';

interface NoteEditorProps {
  note: Note;
  onNoteChange: (note: Note) => void;
  onNoteDelete?: (noteId: string) => void;
}

type EditorMode = 'edit' | 'preview' | 'split';
const EDITOR_MODE_STORAGE_KEY = 'notes_editor_mode';

const getInitialEditorMode = (): EditorMode => {
  if (typeof window === 'undefined') {
    return 'split';
  }

  const stored = localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
  if (stored === 'edit' || stored === 'preview' || stored === 'split') {
    return stored;
  }

  return 'split';
};

/**
 * Debounce функция для отложенного сохранения заметки
 */
function useDebouncedSave(
  fn: (note: Note, silent: boolean) => Promise<void>,
  delay: number,
): (note: Note, silent?: boolean) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedFn = useCallback(
    (note: Note, silent: boolean = true) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => fn(note, silent), delay);
    },
    [fn, delay],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onNoteChange, onNoteDelete }) => {
  const updateNoteMutation = useUpdateNoteMutation();
  const deleteNoteMutation = useDeleteNoteMutation();
  const cx = (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(' ');

  // Локальное состояние заметки
  const [localNote, setLocalNote] = useState<Note>({
    ...note,
    content: note.content || '',
    tags: note.tags || [],
    title: note.title || '',
  });
  const [editorMode, setEditorMode] = useState<EditorMode>(getInitialEditorMode);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [colorMode, setColorMode] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'light',
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const target = document.documentElement;

    const syncMode = () => {
      setColorMode(target.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    };

    syncMode();

    const observer = new MutationObserver(syncMode);
    observer.observe(target, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(EDITOR_MODE_STORAGE_KEY, editorMode);
    } catch (error) {
      console.warn('Failed to persist notes editor mode:', error);
    }
  }, [editorMode]);

  // Синхронизация с внешним состоянием - только при смене заметки
  useEffect(() => {
    setLocalNote({
      ...note,
      content: note.content || '',
      tags: note.tags || [],
      title: note.title || '',
    });
    setHasChanges(false);
  }, [note]);

  // Автосохранение с debounce (2 секунды)
  const saveNote = useCallback(
    async (noteToSave: Note, silent: boolean = false) => {
      try {
        setIsSaving(true);
        await updateNoteMutation.mutateAsync({
          noteId: noteToSave.id,
          payload: {
            title: noteToSave.title,
            content: noteToSave.content,
            tags: noteToSave.tags,
            is_pinned: noteToSave.is_pinned,
          },
        });
        setHasChanges(false);
        if (!silent) {
          message.success('Note saved', 1);
        }
      } catch (error) {
        console.error('Error saving note:', error);
        message.error('Failed to save note');
      } finally {
        setIsSaving(false);
      }
    },
    [updateNoteMutation],
  );

  const debouncedSave = useDebouncedSave(saveNote, 2000);

  // Обработка изменений заметки
  const handleNoteUpdate = useCallback(
    (updates: Partial<Note>) => {
      setLocalNote((prev) => {
        const updated = { ...prev, ...updates, updated_at: Date.now() };
        setHasChanges(true);
        debouncedSave(updated, true);
        onNoteChange(updated);
        return updated;
      });
    },
    [debouncedSave, onNoteChange],
  );

  // Изменение заголовка
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleNoteUpdate({ title: e.target.value });
    },
    [handleNoteUpdate],
  );

  const handleContentChange = useCallback(
    (value?: string) => handleNoteUpdate({ content: value || '' }),
    [handleNoteUpdate],
  );

  // Переключение закрепления
  const handleTogglePin = useCallback(() => {
    handleNoteUpdate({ is_pinned: !localNote.is_pinned });
  }, [handleNoteUpdate, localNote.is_pinned]);

  // Удаление заметки
  const handleDelete = useCallback(async () => {
    try {
      await deleteNoteMutation.mutateAsync(localNote.id);
      onNoteDelete?.(localNote.id);
      message.success('Note deleted');
    } catch (error) {
      console.error('Error deleting note:', error);
      message.error('Failed to delete note');
    }
  }, [deleteNoteMutation, localNote.id, onNoteDelete]);

  // Ручное сохранение
  const handleManualSave = useCallback(() => {
    void saveNote(localNote, false);
  }, [localNote, saveNote]);
  const mdPreviewMode = useMemo<'edit' | 'live' | 'preview'>(() => {
    if (editorMode === 'edit') return 'edit';
    if (editorMode === 'preview') return 'preview';
    return 'live';
  }, [editorMode]);

  return (
    <div className={styles['note-editor']}>
      {/* Заголовок заметки */}
      <div className={styles['note-editor-header']}>
        <Input
          className={styles['note-title-input']}
          placeholder="Note title"
          value={localNote.title}
          onChange={handleTitleChange}
          variant="borderless"
        />
        <Space>
          {/* Переключатель режимов */}
          <div className={styles['editor-mode-switcher']}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => setEditorMode('edit')}
              size="small"
              className={cx(
                styles['editor-mode-button'],
                editorMode === 'edit' && styles['editor-mode-button-active'],
              )}
            >
              Edit
            </Button>
            <Button
              type="text"
              icon={<SplitCellsOutlined />}
              onClick={() => setEditorMode('split')}
              size="small"
              className={cx(
                styles['editor-mode-button'],
                editorMode === 'split' && styles['editor-mode-button-active'],
              )}
            >
              Split
            </Button>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => setEditorMode('preview')}
              size="small"
              className={cx(
                styles['editor-mode-button'],
                editorMode === 'preview' && styles['editor-mode-button-active'],
              )}
            >
              Preview
            </Button>
          </div>
          <Tooltip title={localNote.is_pinned ? 'Unpin' : 'Pin'}>
            <Button
              icon={localNote.is_pinned ? <PushpinFilled /> : <PushpinOutlined />}
              type={localNote.is_pinned ? 'primary' : 'text'}
              onClick={handleTogglePin}
            />
          </Tooltip>
          <TableActionButton
            icon={<SaveOutlined />}
            loading={isSaving}
            onClick={handleManualSave}
            tooltip="Save"
          />
          <TableActionButton
            icon={<DeleteOutlined />}
            danger
            onClick={handleDelete}
            tooltip="Delete"
          />
        </Space>
      </div>

      {/* Теги */}
      {localNote.tags?.length > 0 && (
        <div className={styles['note-tags']}>
          {localNote.tags.map((tag) => (
            <Tag key={tag} className={styles['note-tag']}>
              {tag}
            </Tag>
          ))}
        </div>
      )}

      {/* Редактор контента */}
      <div
        className={cx(styles['note-content-editor'], styles['note-md-editor-root'])}
        data-color-mode={colorMode}
      >
        <MDEditor
          value={localNote.content || ''}
          onChange={handleContentChange}
          preview={mdPreviewMode}
          height={Math.max(420, typeof window !== 'undefined' ? window.innerHeight - 280 : 520)}
          visibleDragbar={false}
          textareaProps={{
            placeholder: 'Start writing your note in Markdown...',
          }}
          previewOptions={{
            remarkPlugins: [remarkGfm],
            className: styles['notes-md-preview'],
          }}
        />
      </div>

      {/* Индикатор сохранения */}
      {hasChanges && (
        <div className={styles['note-save-indicator']}>
          <span>Unsaved changes</span>
        </div>
      )}
    </div>
  );
};
