/**
 * @fileoverview Страница управления заметками с rich text редактором
 * Интегрирует NoteSidebar и NoteEditor для полноценной работы с заметками
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Empty, Spin, message } from 'antd';
import { NoteSidebar, NoteEditor } from '../../components/notes';
import type { Note } from '../../services/notesService';
import {
  getNote,
  subscribeToNote,
} from '../../services/notesService';
import './NotesPage.css';

const SIDEBAR_COLLAPSED_KEY = 'notes_sidebar_collapsed';

/**
 * Создает пустую заметку по умолчанию
 */
const createDefaultNote = (): Note => {
  const now = Date.now();
  return {
    id: '',
    title: '',
    content: '',  // Markdown content
    tags: [],
    bot_id: null,
    project_id: null,
    is_pinned: false,
    created_at: now,
    updated_at: now,
  };
};

export const NotesPage: React.FC = () => {
  // Состояние выбранной заметки
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(false);

  // Состояние сворачивания боковой панели
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved ? JSON.parse(saved) : false;
  });

  // Загрузка заметки при изменении выбранного ID
  useEffect(() => {
    if (!selectedNoteId) {
      setCurrentNote(null);
      return;
    }

    setLoading(true);

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
      unsubscribe();
    };
  }, [selectedNoteId]);

  // Обработчик выбора заметки из sidebar
  const handleSelectNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
  }, []);

  // Обработчик создания новой заметки
  const handleCreateNote = useCallback(() => {
    // Заметка создается в NoteSidebar, здесь только сбрасываем выбор
    setSelectedNoteId(null);
    message.success('Note created');
  }, []);

  // Обработчик обновления заметки (локально)
  const handleNoteChange = useCallback((updatedNote: Note) => {
    setCurrentNote(updatedNote);
  }, []);

  // Обработчик удаления заметки
  const handleNoteDelete = useCallback((noteId: string) => {
    setSelectedNoteId(null);
    setCurrentNote(null);
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
    <div className="notes-page">
      <div className="notes-layout">
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
        <div className="notes-editor-container">
          {loading ? (
            <div className="notes-loading">
              <Spin size="large" />
              <span>Loading note...</span>
            </div>
          ) : currentNote ? (
            <NoteEditor
              note={currentNote}
              onNoteChange={handleNoteChange}
              onNoteDelete={handleNoteDelete}
            />
          ) : (
            <div className="notes-empty">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div className="notes-empty-content">
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
