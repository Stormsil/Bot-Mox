/**
 * @fileoverview Страница управления заметками с rich text редактором
 * Интегрирует NoteSidebar и NoteEditor для полноценной работы с заметками
 */

import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Empty, Spin, message } from 'antd';
import { useLocation } from 'react-router-dom';
import { NoteSidebar } from '../../components/notes';
import type { Note } from '../../services/notesService';
import {
  subscribeToNote,
} from '../../services/notesService';
import styles from './NotesPage.module.css';

const NoteEditor = lazy(async () => ({
  default: (await import('../../components/notes/NoteEditor')).NoteEditor,
}));

const SIDEBAR_COLLAPSED_KEY = 'notes_sidebar_collapsed';

export const NotesPage: React.FC = () => {
  const location = useLocation();
  // Состояние выбранной заметки
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (!selectedNoteId) {
      return;
    }

    const loadingFrame = window.requestAnimationFrame(() => {
      setLoading(true);
    });

    // Подписываемся на realtime обновления заметки
    const unsubscribe = subscribeToNote(selectedNoteId, (note) => {
      if (note) {
        setCurrentNote(note);
      } else {
        // Заметка была удалена
        setCurrentNote(null);
        setSelectedNoteId(null);
        message.info('Note was deleted');
      }
      setLoading(false);
    });

    return () => {
      window.cancelAnimationFrame(loadingFrame);
      unsubscribe();
    };
  }, [selectedNoteId]);

  // Обработчик выбора заметки из sidebar
  const handleSelectNote = useCallback((noteId: string) => {
    setCurrentNote(null);
    setSelectedNoteId(noteId);
  }, []);

  // Обработчик создания новой заметки
  const handleCreateNote = useCallback(() => {
    // Заметка создается в NoteSidebar, здесь только сбрасываем выбор
    setCurrentNote(null);
    setLoading(false);
    setSelectedNoteId(null);
    message.success('Note created');
  }, []);

  // Обработчик обновления заметки (локально)
  const handleNoteChange = useCallback((updatedNote: Note) => {
    setCurrentNote(updatedNote);
  }, []);

  // Обработчик удаления заметки
  const handleNoteDelete = useCallback((noteId: string) => {
    void noteId;
    setSelectedNoteId(null);
    setCurrentNote(null);
    setLoading(false);
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
              fallback={(
                <div className={styles.loading}>
                  <Spin size="large" />
                  <span>Loading editor...</span>
                </div>
              )}
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
