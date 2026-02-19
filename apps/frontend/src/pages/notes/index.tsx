/**
 * @fileoverview Страница управления заметками с rich text редактором
 * Интегрирует NoteSidebar и NoteEditor для полноценной работы с заметками
 */

import { Empty, message, Spin } from 'antd';
import type React from 'react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NoteSidebar } from '../../components/notes';
import { useNoteByIdQuery } from '../../entities/notes/api/useNoteByIdQuery';
import type { Note } from '../../entities/notes/model/types';
import styles from './NotesPage.module.css';

const NoteEditor = lazy(async () => ({
  default: (await import('../../components/notes/NoteEditor')).NoteEditor,
}));

const SIDEBAR_COLLAPSED_KEY = 'notes_sidebar_collapsed';

export const NotesPage: React.FC = () => {
  const location = useLocation();
  // Состояние выбранной заметки
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const noteByIdQuery = useNoteByIdQuery(selectedNoteId);

  // Состояние сворачивания боковой панели
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved ? JSON.parse(saved) : false;
  });

  // Поддержка deep-link из календаря: /notes?note=<id>
  useEffect(() => {
    const noteIdFromQuery = new URLSearchParams(location.search).get('note');
    if (!noteIdFromQuery) return;
    const frameId = window.requestAnimationFrame(() => {
      setSelectedNoteId((prev) => (prev === noteIdFromQuery ? prev : noteIdFromQuery));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [location.search]);

  // Загрузка заметки при изменении выбранного ID
  useEffect(() => {
    if (!noteByIdQuery.error) {
      return;
    }
    message.error('Failed to load note');
  }, [noteByIdQuery.error]);

  // Обработчик выбора заметки из sidebar
  const handleSelectNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
  }, []);

  // Обработчик создания новой заметки
  const handleCreateNote = useCallback(() => {
    setSelectedNoteId(null);
    message.success('Note created');
  }, []);

  // Обработчик обновления заметки (локально)
  const handleNoteChange = useCallback((updatedNote: Note) => {
    void updatedNote;
  }, []);

  // Обработчик удаления заметки
  const handleNoteDelete = useCallback((noteId: string) => {
    void noteId;
    setSelectedNoteId(null);
    message.success('Note deleted');
  }, []);

  // Обработчик переключения состояния боковой панели
  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev: boolean) => {
      const newValue = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  const currentNote = noteByIdQuery.data || null;
  const loading = Boolean(selectedNoteId) && noteByIdQuery.isLoading;

  return (
    <div className={styles.root}>
      <div className={styles.layout}>
        {/* Боковая панель с списком заметок */}
        <NoteSidebar
          selectedNoteId={selectedNoteId}
          onSelectNote={handleSelectNote}
          onCreateNote={handleCreateNote}
          onNoteDelete={handleNoteDelete}
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
        />

        {/* Область редактора */}
        <div className={styles.editorContainer}>
          {loading ? (
            <div className={styles.loading}>
              <Spin size="large" />
              <span>Loading note...</span>
            </div>
          ) : currentNote ? (
            <Suspense
              fallback={
                <div className={styles.loading}>
                  <Spin size="large" />
                  <span>Loading editor...</span>
                </div>
              }
            >
              <NoteEditor
                note={currentNote}
                onNoteChange={handleNoteChange}
                onNoteDelete={handleNoteDelete}
              />
            </Suspense>
          ) : (
            <div className={styles.empty}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div className={styles.emptyContent}>
                    <p>Select a note from the sidebar</p>
                    <p>or create a new one</p>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
