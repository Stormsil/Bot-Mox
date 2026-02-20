import {
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Card, Empty, Input, message, Popconfirm, Spin, Tag, Tooltip } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useUpdateNoteMutation,
} from '../../entities/notes/api/useNoteMutations';
import { useNotesIndexQuery } from '../../entities/notes/api/useNotesIndexQuery';
import type { NoteIndex } from '../../entities/notes/model/types';
import { TableActionButton } from '../ui/TableActionButton';
import styles from './NoteSidebar.module.css';
import { formatDate, getTagColor } from './noteSidebarUtils';

interface NoteSidebarProps {
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onNoteDelete?: (noteId: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

export const NoteSidebar: React.FC<NoteSidebarProps> = ({
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onNoteDelete,
  collapsed = false,
  onToggle,
}) => {
  const createNoteMutation = useCreateNoteMutation();
  const deleteNoteMutation = useDeleteNoteMutation();
  const updateNoteMutation = useUpdateNoteMutation();
  const cx = (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(' ');

  const notesIndexQuery = useNotesIndexQuery();
  const notes = useMemo(() => (notesIndexQuery.data || []) as NoteIndex[], [notesIndexQuery.data]);
  const loading = notesIndexQuery.isLoading;
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!notesIndexQuery.error) {
      return;
    }
    message.error('Failed to load notes');
  }, [notesIndexQuery.error]);

  const sortedNotes = React.useMemo(() => {
    const filtered = (notes || []).filter((note) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        note.title?.toLowerCase().includes(query) ||
        note.preview?.toLowerCase().includes(query) ||
        note.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
        false
      );
    });

    return [...filtered].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return b.updated_at - a.updated_at;
    });
  }, [notes, searchQuery]);

  const handleCreateNote = useCallback(async () => {
    try {
      setCreating(true);
      await createNoteMutation.mutateAsync({
        title: 'New Note',
        bot_id: null,
        project_id: null,
        tags: [],
      });
      onCreateNote?.();
      setSearchQuery('');
    } catch (error) {
      console.error('Error creating note:', error);
    } finally {
      setCreating(false);
    }
  }, [createNoteMutation, onCreateNote]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleDeleteNote = useCallback(
    async (noteId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await deleteNoteMutation.mutateAsync(noteId);
        onNoteDelete?.(noteId);
        message.success('Note deleted');
      } catch (error) {
        console.error('Error deleting note:', error);
        message.error('Failed to delete note');
      }
    },
    [deleteNoteMutation, onNoteDelete],
  );

  const handleTogglePin = useCallback(
    async (note: NoteIndex, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await updateNoteMutation.mutateAsync({
          noteId: note.id,
          payload: { is_pinned: !note.is_pinned },
        });
        message.success(note.is_pinned ? 'Note unpinned' : 'Note pinned');
      } catch (error) {
        console.error('Error toggling pin:', error);
        message.error('Failed to update note');
      }
    },
    [updateNoteMutation],
  );

  return (
    <div className={cx(styles['note-sidebar'], collapsed && styles.collapsed)}>
      <div className={styles['note-sidebar-header']}>
        {!collapsed && <h3 className={styles['note-sidebar-title']}>Notes</h3>}
        <div className={styles['note-sidebar-header-actions']}>
          <Tooltip title={collapsed ? 'Expand' : 'Collapse'}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={onToggle}
              className={styles['note-sidebar-toggle-btn']}
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

      {!collapsed && (
        <div className={styles['note-sidebar-search']}>
          <Input
            className={styles['note-sidebar-search-input']}
            placeholder="Search notes..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={handleSearchChange}
            allowClear
            onClear={handleClearSearch}
            rootClassName={styles['note-sidebar-search-affix']}
            classNames={{
              input: styles['note-sidebar-search-input'],
            }}
          />
        </div>
      )}

      <div className={styles['note-sidebar-list']}>
        {loading ? (
          <div className={styles['note-sidebar-loading']}>
            <Spin size="small" />
            {!collapsed && <span>Loading notes...</span>}
          </div>
        ) : sortedNotes.length === 0 ? (
          !collapsed && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className={styles['note-sidebar-empty-description']}>
                  {searchQuery ? 'No notes found' : 'No notes yet'}
                </span>
              }
              className={styles['note-sidebar-empty']}
            >
              {!searchQuery && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNote}>
                  Create Note
                </Button>
              )}
            </Empty>
          )
        ) : (
          <div className={styles['note-sidebar-list-items']}>
            {sortedNotes.map((note) => (
              <div
                key={note.id}
                className={styles['note-sidebar-list-row']}
                style={{ marginBottom: collapsed ? 4 : 8 }}
              >
                <Card
                  className={cx(
                    styles['note-list-item'],
                    selectedNoteId === note.id && styles.selected,
                    note.is_pinned && styles.pinned,
                    collapsed && styles.collapsed,
                  )}
                  onClick={() => onSelectNote(note.id)}
                  styles={{
                    body: {
                      padding: collapsed ? '8px' : '12px 16px',
                      display: 'flex',
                      alignItems: collapsed ? 'center' : 'flex-start',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      gap: collapsed ? 0 : 8,
                      overflow: 'hidden',
                      width: '100%',
                      boxSizing: 'border-box',
                    },
                  }}
                  style={{ borderRadius: collapsed ? 4 : 8, width: '100%' }}
                >
                  {collapsed ? (
                    <div className={styles['note-list-item-collapsed']}>
                      {note.is_pinned ? (
                        <PushpinFilled className={styles['note-list-item-pin-icon']} />
                      ) : (
                        <div
                          className={cx(
                            styles['note-list-item-indicator'],
                            selectedNoteId === note.id && styles.selected,
                          )}
                        />
                      )}
                    </div>
                  ) : (
                    <>
                      <div className={styles['note-list-item-content']}>
                        <div className={styles['note-list-item-header']}>
                          {note.is_pinned && (
                            <PushpinFilled className={styles['note-list-item-pin-icon']} />
                          )}
                          <span className={styles['note-list-item-title']}>
                            {note.title || 'Untitled'}
                          </span>
                        </div>

                        {note.preview && (
                          <div className={styles['note-list-item-preview']}>{note.preview}</div>
                        )}

                        <div className={styles['note-list-item-footer']}>
                          {note.tags?.length > 0 && (
                            <div className={styles['note-list-item-tags']}>
                              {note.tags.slice(0, 3).map((tag) => (
                                <Tag
                                  key={tag}
                                  color={getTagColor(tag)}
                                  className={styles['note-list-item-tag']}
                                >
                                  {tag}
                                </Tag>
                              ))}
                              {note.tags.length > 3 && (
                                <Tag className={styles['note-list-item-tag']}>
                                  +{note.tags.length - 3}
                                </Tag>
                              )}
                            </div>
                          )}
                          <span className={styles['note-list-item-date']}>
                            {formatDate(note.updated_at)}
                          </span>
                        </div>
                      </div>

                      <div className={styles['note-list-item-actions']}>
                        <TableActionButton
                          icon={note.is_pinned ? <PushpinFilled /> : <PushpinOutlined />}
                          className={cx(
                            styles['note-list-item-action'],
                            note.is_pinned && styles.pinned,
                          )}
                          onClick={(e) => handleTogglePin(note, e as React.MouseEvent)}
                          tooltip={note.is_pinned ? 'Unpin' : 'Pin'}
                        />
                        <Popconfirm
                          title="Delete note?"
                          description="This action cannot be undone."
                          onConfirm={(e) =>
                            handleDeleteNote(note.id, e as unknown as React.MouseEvent)
                          }
                          onCancel={(e) => e?.stopPropagation()}
                          okText="Delete"
                          okType="danger"
                          cancelText="Cancel"
                        >
                          <TableActionButton
                            danger
                            icon={<DeleteOutlined />}
                            className={styles['note-list-item-action']}
                            onClick={(e) => (e as React.MouseEvent).stopPropagation()}
                            tooltip="Delete"
                          />
                        </Popconfirm>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && !collapsed && (
        <div className={styles['note-sidebar-footer']}>
          <span>
            {notes?.length || 0} {(notes?.length || 0) === 1 ? 'note' : 'notes'}
          </span>
          {(notes?.filter((n) => n.is_pinned).length || 0) > 0 && (
            <span>{notes.filter((n) => n.is_pinned).length} pinned</span>
          )}
        </div>
      )}
    </div>
  );
};
