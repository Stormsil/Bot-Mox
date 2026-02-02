/**
 * @fileoverview Боковая панель с заметками
 * Отображает список заметок, поиск и кнопку создания новой заметки
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Input, Button, List, Tag, Empty, Spin, Tooltip, Popconfirm, message, Card } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import type { NoteIndex } from '../../services/notesService';
import {
  createNote,
  subscribeToNotesIndex,
  deleteNote,
  updateNote,
} from '../../services/notesService';
import './NotesComponents.css';

interface NoteSidebarProps {
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onNoteDelete?: (noteId: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

/**
 * Форматирует дату для отображения
 */
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Сегодня - показываем время
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
};

// Цвета для тегов
const TAG_COLORS = [
  'blue',
  'green',
  'orange',
  'purple',
  'cyan',
  'magenta',
  'geekblue',
  'lime',
];

/**
 * Генерирует цвет тега на основе его названия
 */
const getTagColor = (tag: string): string => {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
};

export const NoteSidebar: React.FC<NoteSidebarProps> = ({
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onNoteDelete,
  collapsed = false,
  onToggle,
}) => {
  const [notes, setNotes] = useState<NoteIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);

  // Загрузка списка заметок
  useEffect(() => {
    setLoading(true);

    // Подписываемся на realtime обновления индекса
    const unsubscribe = subscribeToNotesIndex(fetchedNotes => {
      setNotes(fetchedNotes);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Фильтрация и сортировка заметок - мемоизировано
  const sortedNotes = React.useMemo(() => {
    // Фильтрация
    const filtered = (notes || []).filter(note => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        note.title?.toLowerCase().includes(query) ||
        note.preview?.toLowerCase().includes(query) ||
        note.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        false
      );
    });

    // Сортировка: сначала закрепленные, потом по дате обновления
    return [...filtered].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return b.updated_at - a.updated_at;
    });
  }, [notes, searchQuery]);

  // Создание новой заметки
  const handleCreateNote = useCallback(async () => {
    try {
      setCreating(true);
      await createNote({
        title: 'New Note',
        bot_id: null,
        project_id: null,
        tags: [],
      });
      setSearchQuery('');
    } catch (error) {
      console.error('Error creating note:', error);
    } finally {
      setCreating(false);
    }
  }, []);

  // Обработка изменения поискового запроса
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    []
  );

  // Очистка поиска
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Удаление заметки
  const handleDeleteNote = useCallback(async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNote(noteId);
      onNoteDelete?.(noteId);
      message.success('Note deleted');
    } catch (error) {
      console.error('Error deleting note:', error);
      message.error('Failed to delete note');
    }
  }, [onNoteDelete]);

  // Закрепление/открепление заметки
  const handleTogglePin = useCallback(async (note: NoteIndex, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateNote(note.id, { is_pinned: !note.is_pinned });
      message.success(note.is_pinned ? 'Note unpinned' : 'Note pinned');
    } catch (error) {
      console.error('Error toggling pin:', error);
      message.error('Failed to update note');
    }
  }, []);

  return (
    <div className={`note-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Заголовок и кнопка создания */}
      <div className="note-sidebar-header">
        {!collapsed && <h3 className="note-sidebar-title">Notes</h3>}
        <div className="note-sidebar-header-actions">
          <Tooltip title={collapsed ? 'Expand' : 'Collapse'}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={onToggle}
              className="note-sidebar-toggle-btn"
            />
          </Tooltip>
          {!collapsed && (
            <Tooltip title="New Note">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateNote}
                loading={creating}
              />
            </Tooltip>
          )}
        </div>
      </div>

      {/* Поиск - скрыт в collapsed режиме */}
      {!collapsed && (
        <div className="note-sidebar-search">
          <Input
            placeholder="Search notes..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={handleSearchChange}
            allowClear
            onClear={handleClearSearch}
          />
        </div>
      )}

      {/* Список заметок */}
      <div className="note-sidebar-list">
        {loading ? (
          <div className="note-sidebar-loading">
            <Spin size="small" />
            {!collapsed && <span>Loading notes...</span>}
          </div>
        ) : sortedNotes.length === 0 ? (
          !collapsed && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                searchQuery ? 'No notes found' : 'No notes yet'
              }
              className="note-sidebar-empty"
            >
              {!searchQuery && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreateNote}
                >
                  Create Note
                </Button>
              )}
            </Empty>
          )
        ) : (
          <List
            dataSource={sortedNotes}
            renderItem={note => (
              <List.Item style={{ padding: 0, border: 'none', marginBottom: collapsed ? 4 : 8 }}>
                <Card
                  key={note.id}
                  className={`note-list-item ${
                    selectedNoteId === note.id ? 'selected' : ''
                  } ${note.is_pinned ? 'pinned' : ''} ${collapsed ? 'collapsed' : ''}`}
                  onClick={() => onSelectNote(note.id)}
                  bodyStyle={{ padding: collapsed ? '8px' : '12px 16px' }}
                  style={{ borderRadius: collapsed ? 4 : 8, width: '100%' }}
                >
                  {collapsed ? (
                    // Collapsed view - только иконка/индикатор
                    <div className="note-list-item-collapsed">
                      {note.is_pinned ? (
                        <PushpinFilled className="note-list-item-pin-icon" />
                      ) : (
                        <div className={`note-list-item-indicator ${selectedNoteId === note.id ? 'selected' : ''}`} />
                      )}
                    </div>
                  ) : (
                    // Full view
                    <>
                      <div className="note-list-item-content">
                        <div className="note-list-item-header">
                          {note.is_pinned && (
                            <PushpinFilled className="note-list-item-pin-icon" />
                          )}
                          <span className="note-list-item-title">
                            {note.title || 'Untitled'}
                          </span>
                        </div>

                        {note.preview && (
                          <div className="note-list-item-preview">
                            {note.preview}
                          </div>
                        )}

                        <div className="note-list-item-footer">
                          {note.tags?.length > 0 && (
                            <div className="note-list-item-tags">
                              {note.tags.slice(0, 3).map(tag => (
                                <Tag
                                  key={tag}
                                  color={getTagColor(tag)}
                                  className="note-list-item-tag"
                                >
                                  {tag}
                                </Tag>
                              ))}
                              {note.tags.length > 3 && (
                                <Tag className="note-list-item-tag">
                                  +{note.tags.length - 3}
                                </Tag>
                              )}
                            </div>
                          )}
                          <span className="note-list-item-date">
                            {formatDate(note.updated_at)}
                          </span>
                        </div>
                      </div>

                      {/* Hover actions */}
                      <div className="note-list-item-actions">
                        <Tooltip title={note.is_pinned ? 'Unpin' : 'Pin'}>
                          <Button
                            type="text"
                            size="small"
                            icon={note.is_pinned ? <PushpinFilled /> : <PushpinOutlined />}
                            className={`note-list-item-action ${note.is_pinned ? 'pinned' : ''}`}
                            onClick={(e) => handleTogglePin(note, e)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="Delete note?"
                          description="This action cannot be undone."
                          onConfirm={(e) => handleDeleteNote(note.id, e as unknown as React.MouseEvent)}
                          onCancel={(e) => e?.stopPropagation()}
                          okText="Delete"
                          okType="danger"
                          cancelText="Cancel"
                        >
                          <Tooltip title="Delete">
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              className="note-list-item-action"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </div>
                    </>
                  )}
                </Card>
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Статистика - скрыта в collapsed режиме */}
      {!loading && !collapsed && (
        <div className="note-sidebar-footer">
          <span>
            {notes?.length || 0} {(notes?.length || 0) === 1 ? 'note' : 'notes'}
          </span>
          {(notes?.filter(n => n.is_pinned).length || 0) > 0 && (
            <span>
              {notes.filter(n => n.is_pinned).length} pinned
            </span>
          )}
        </div>
      )}
    </div>
  );
};
