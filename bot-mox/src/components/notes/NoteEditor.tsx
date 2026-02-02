/**
 * @fileoverview Markdown редактор заметки с Monaco Editor
 * Управляет редактированием markdown текста, автосохранением и взаимодействием с Firebase
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { Input, Button, Tag, Space, Tooltip, message } from 'antd';
import {
  SaveOutlined,
  PushpinOutlined,
  PushpinFilled,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SplitCellsOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Note } from '../../services/notesService';
import {
  updateNote,
  deleteNote,
} from '../../services/notesService';
import './NotesComponents.css';

interface NoteEditorProps {
  note: Note;
  onNoteChange: (note: Note) => void;
  onNoteDelete?: (noteId: string) => void;
}

type EditorMode = 'edit' | 'preview' | 'split';

/**
 * Debounce функция для отложенного сохранения заметки
 */
function useDebouncedSave(
  fn: (note: Note) => Promise<void>,
  delay: number
): (note: Note) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedFn = useCallback(
    (note: Note) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => fn(note), delay);
    },
    [fn, delay]
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

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onNoteChange,
  onNoteDelete,
}) => {
  // Локальное состояние заметки
  const [localNote, setLocalNote] = useState<Note>({
    ...note,
    content: note.content || '',
    tags: note.tags || [],
    title: note.title || '',
  });
  const [editorMode, setEditorMode] = useState<EditorMode>('split');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Синхронизация с внешним состоянием - только при смене заметки
  useEffect(() => {
    setLocalNote({
      ...note,
      content: note.content || '',
      tags: note.tags || [],
      title: note.title || '',
    });
    setHasChanges(false);
  }, [note.id]);

  // Автосохранение с debounce (2 секунды)
  const saveNote = useCallback(
    async (noteToSave: Note) => {
      try {
        setIsSaving(true);
        await updateNote(noteToSave.id, {
          title: noteToSave.title,
          content: noteToSave.content,
          tags: noteToSave.tags,
          is_pinned: noteToSave.is_pinned,
        });
        setHasChanges(false);
        message.success('Note saved', 1);
      } catch (error) {
        console.error('Error saving note:', error);
        message.error('Failed to save note');
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const debouncedSave = useDebouncedSave(saveNote, 2000);

  const pendingNoteRef = useRef<Note | null>(null);

  // Обработка изменений заметки
  const handleNoteUpdate = useCallback(
    (updates: Partial<Note>) => {
      setLocalNote(prev => {
        const updated = { ...prev, ...updates, updated_at: Date.now() };
        setHasChanges(true);
        debouncedSave(updated);
        pendingNoteRef.current = updated;
        return updated;
      });
    },
    [debouncedSave]
  );

  // Синхронизация с родителем
  useEffect(() => {
    if (pendingNoteRef.current) {
      onNoteChange(pendingNoteRef.current);
      pendingNoteRef.current = null;
    }
  });

  // Изменение заголовка
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleNoteUpdate({ title: e.target.value });
    },
    [handleNoteUpdate]
  );

  // Изменение контента через Monaco
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      handleNoteUpdate({ content: value || '' });
    },
    [handleNoteUpdate]
  );

  // Переключение закрепления
  const handleTogglePin = useCallback(() => {
    handleNoteUpdate({ is_pinned: !localNote.is_pinned });
  }, [handleNoteUpdate, localNote.is_pinned]);

  // Удаление заметки
  const handleDelete = useCallback(async () => {
    try {
      await deleteNote(localNote.id);
      onNoteDelete?.(localNote.id);
      message.success('Note deleted');
    } catch (error) {
      console.error('Error deleting note:', error);
      message.error('Failed to delete note');
    }
  }, [localNote.id, onNoteDelete]);

  // Ручное сохранение
  const handleManualSave = useCallback(() => {
    saveNote(localNote);
  }, [localNote, saveNote]);

  // Monaco editor options
  const editorOptions = useMemo<editor.IStandaloneEditorConstructionOptions>(() => ({
    minimap: { enabled: false },
    lineNumbers: 'off',
    folding: false,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
    wordWrap: 'on',
    wrappingIndent: 'same',
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    padding: { top: 16, bottom: 16 },
    scrollBeyondLastLine: false,
    renderLineHighlight: 'none',
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: false,
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    parameterHints: { enabled: false },
    hover: { enabled: false },
    formatOnType: true,
    formatOnPaste: true,
    autoIndent: 'full',
  }), []);

  // Monaco editor theme
  const handleEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    
    // Настройка автонумерации списков
    editor.onKeyDown((e) => {
      if (e.keyCode === 3) { // Enter key
        const model = editor.getModel();
        if (!model) return;
        
        const position = editor.getPosition();
        if (!position) return;
        
        const lineNumber = position.lineNumber;
        const lineContent = model.getLineContent(lineNumber);
        
        // Проверяем нумерованный список: "1. text" или "  1. text"
        const numberedListMatch = lineContent.match(/^(\s*)(\d+)\.\s*(.*)$/);
        if (numberedListMatch) {
          const [, indent, num, text] = numberedListMatch;
          
          // Если строка пустая (только номер) - удаляем нумерацию
          if (!text.trim()) {
            e.preventDefault();
            editor.executeEdits('', [{
              range: {
                startLineNumber: lineNumber,
                startColumn: 1,
                endLineNumber: lineNumber,
                endColumn: lineContent.length + 1,
              },
              text: '',
            }]);
            return;
          }
          
          // Автонумерация: следующий номер
          e.preventDefault();
          const nextNum = parseInt(num, 10) + 1;
          const newText = `\n${indent}${nextNum}. `;
          
          editor.executeEdits('', [{
            range: {
              startLineNumber: lineNumber,
              startColumn: lineContent.length + 1,
              endLineNumber: lineNumber,
              endColumn: lineContent.length + 1,
            },
            text: newText,
          }]);
          
          // Перемещаем курсор после нового номера
          editor.setPosition({
            lineNumber: lineNumber + 1,
            column: newText.length,
          });
          return;
        }
        
        // Проверяем маркированный список: "- text" или "  - text"
        const bulletListMatch = lineContent.match(/^(\s*)([-*])\s+(.*)$/);
        if (bulletListMatch) {
          const [, indent, bullet, text] = bulletListMatch;
          
          // Если строка пустая (только bullet) - удаляем bullet
          if (!text.trim()) {
            e.preventDefault();
            editor.executeEdits('', [{
              range: {
                startLineNumber: lineNumber,
                startColumn: 1,
                endLineNumber: lineNumber,
                endColumn: lineContent.length + 1,
              },
              text: '',
            }]);
            return;
          }
          
          // Продолжаем список с тем же bullet
          e.preventDefault();
          const newText = `\n${indent}${bullet} `;
          
          editor.executeEdits('', [{
            range: {
              startLineNumber: lineNumber,
              startColumn: lineContent.length + 1,
              endLineNumber: lineNumber,
              endColumn: lineContent.length + 1,
            },
            text: newText,
          }]);
          
          editor.setPosition({
            lineNumber: lineNumber + 1,
            column: newText.length,
          });
          return;
        }
        
        // Проверяем чекбокс: "- [ ] text" или "- [x] text"
        const checkboxMatch = lineContent.match(/^(\s*)(- \[[ x]\])\s*(.*)$/);
        if (checkboxMatch) {
          const [, indent, checkbox, text] = checkboxMatch;
          
          // Если строка пустая - удаляем чекбокс
          if (!text.trim()) {
            e.preventDefault();
            editor.executeEdits('', [{
              range: {
                startLineNumber: lineNumber,
                startColumn: 1,
                endLineNumber: lineNumber,
                endColumn: lineContent.length + 1,
              },
              text: '',
            }]);
            return;
          }
          
          // Продолжаем с пустым чекбоксом
          e.preventDefault();
          const newText = `\n${indent}- [ ] `;
          
          editor.executeEdits('', [{
            range: {
              startLineNumber: lineNumber,
              startColumn: lineContent.length + 1,
              endLineNumber: lineNumber,
              endColumn: lineContent.length + 1,
            },
            text: newText,
          }]);
          
          editor.setPosition({
            lineNumber: lineNumber + 1,
            column: newText.length,
          });
        }
      }
    });
  }, []);

  // Обработка клика по чекбоксу в Preview
  const handleCheckboxClick = useCallback((lineIndex: number, checked: boolean) => {
    console.log('[DEBUG] handleCheckboxClick called:', { lineIndex, checked, contentLength: localNote.content.length });
    const lines = localNote.content.split('\n');
    console.log('[DEBUG] Total lines:', lines.length);
    if (lineIndex < 0 || lineIndex >= lines.length) {
      console.log('[DEBUG] Invalid lineIndex, returning');
      return;
    }

    const line = lines[lineIndex];
    console.log('[DEBUG] Line content:', JSON.stringify(line));
    // Ищем паттерн чекбокса: - [ ] или - [x] (с поддержкой разных регистров X)
    const checkboxRegex = /^(\s*)- \[([ xX])\](.*)$/i;
    const match = line.match(checkboxRegex);
    console.log('[DEBUG] Regex match:', match);

    if (match) {
      const [, indent, , rest] = match;
      const newCheckbox = checked ? '[x]' : '[ ]';
      lines[lineIndex] = `${indent}- ${newCheckbox}${rest}`;
      
      const newContent = lines.join('\n');
      console.log('[DEBUG] Updating content, new line:', JSON.stringify(lines[lineIndex]));
      handleNoteUpdate({ content: newContent });
    } else {
      console.log('[DEBUG] No checkbox pattern match found');
    }
  }, [localNote.content, handleNoteUpdate]);

  // Кастомный компонент для рендеринга списка с чекбоксами
  const MarkdownComponents = useMemo(() => {
    // Создаем массив индексов чекбоксов из текущего контента
    const checkboxIndices: number[] = [];
    const lines = localNote.content.split('\n');
    lines.forEach((line, index) => {
      if (/^\s*- \[[ xX]\]/i.test(line)) {
        checkboxIndices.push(index);
      }
    });
    console.log('[DEBUG] MarkdownComponents computed, checkboxIndices:', checkboxIndices);

    // Счетчик для отслеживания порядка чекбоксов при рендеринге
    let checkboxRenderCount = 0;
    // Массив для хранения индексов в порядке рендеринга
    const renderedIndices: (number | undefined)[] = [];

    return {
      // Перехватываем рендеринг input[type="checkbox"] внутри task list
      input: (props: React.InputHTMLAttributes<HTMLInputElement>) => {
        const { type, checked, disabled, ...rest } = props;
        // Обрабатываем только чекбоксы из task list (они имеют disabled от remark-gfm)
        if (type === 'checkbox' && disabled) {
          const currentCheckboxIndex = checkboxIndices[checkboxRenderCount++];
          const isChecked = checked ?? false;
          // Сохраняем индекс для использования в обработчике
          const checkboxIndex = currentCheckboxIndex;
          renderedIndices.push(checkboxIndex);
          console.log('[DEBUG] Rendering custom checkbox, index:', checkboxIndex, 'isChecked:', isChecked, 'count:', checkboxRenderCount);

          // Обработчик клика по чекбоксу - используем замыкание для сохранения индекса
          const handleToggle = (e?: React.MouseEvent | React.ChangeEvent) => {
            console.log('[DEBUG] handleToggle called:', { checkboxIndex, isChecked, eventType: e?.type });
            e?.preventDefault();
            e?.stopPropagation();
            if (checkboxIndex !== undefined) {
              console.log('[DEBUG] Calling handleCheckboxClick with:', { checkboxIndex, newChecked: !isChecked });
              handleCheckboxClick(checkboxIndex, !isChecked);
            } else {
              console.log('[DEBUG] checkboxIndex is undefined!');
            }
          };

          return (
            <input
              {...rest}
              type="checkbox"
              checked={isChecked}
              onChange={handleToggle}
              className="markdown-checkbox-input"
              id={`checkbox-${checkboxIndex}`}
            />
          );
        }
        // Для всех остальных input рендерим как есть
        return <input {...props} />;
      },

      // Перехватываем label в task list для связи с кастомным чекбоксом
      label: (props: React.LabelHTMLAttributes<HTMLLabelElement> & { className?: string }) => {
        const { className, children, ...rest } = props;
        // Проверяем, что это label из task-list-item
        if (className?.includes('task-list-item')) {
          // Находим соответствующий индекс чекбокса
          const currentIndex = renderedIndices[checkboxRenderCount - 1];
          
          return (
            <label
              {...rest}
              className={`markdown-checkbox-text ${className || ''}`}
              htmlFor={`checkbox-${currentIndex}`}
              onClick={(e) => {
                e.preventDefault();
                const checkbox = document.getElementById(`checkbox-${currentIndex}`) as HTMLInputElement;
                if (checkbox) {
                  checkbox.click();
                }
              }}
            >
              {children}
            </label>
          );
        }
        return <label {...props}>{children}</label>;
      },

      // Убираем стандартное поведение li для task list
      li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement> & { checked?: boolean | null }) => {
        const isTaskListItem = props.checked !== null && props.checked !== undefined;

        if (isTaskListItem) {
          // Рендерим task list item с кастомной структурой
          return (
            <li className="markdown-checkbox-item" {...props}>
              {children}
            </li>
          );
        }

        return <li {...props}>{children}</li>;
      },
    };
  }, [localNote.content, handleCheckboxClick]);

  // Рендер контента в зависимости от режима
  const renderContent = () => {
    switch (editorMode) {
      case 'edit':
        return (
          <div className="monaco-editor-wrapper">
            <Editor
              value={localNote.content}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              language="markdown"
              theme="vs-dark"
              options={editorOptions}
            />
          </div>
        );
      case 'preview':
        return (
          <div className="markdown-preview markdown-preview-full">
            {localNote.content ? (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={MarkdownComponents}
              >
                {localNote.content}
              </ReactMarkdown>
            ) : (
              <div className="markdown-preview-empty">
                Nothing to preview
              </div>
            )}
          </div>
        );
      case 'split':
        return (
          <div className="markdown-split-view">
            <div className="monaco-editor-wrapper monaco-editor-half">
              <Editor
                value={localNote.content}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                language="markdown"
                theme="vs-dark"
                options={editorOptions}
              />
            </div>
            <div className="markdown-preview markdown-preview-half">
              {localNote.content ? (
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={MarkdownComponents}
                >
                  {localNote.content}
                </ReactMarkdown>
              ) : (
                <div className="markdown-preview-empty">
                  Nothing to preview
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="note-editor">
      {/* Заголовок заметки */}
      <div className="note-editor-header">
        <Input
          className="note-title-input"
          placeholder="Note title"
          value={localNote.title}
          onChange={handleTitleChange}
          variant="borderless"
        />
        <Space>
          {/* Переключатель режимов */}
          <div className="editor-mode-switcher">
            <Button
              type={editorMode === 'edit' ? 'primary' : 'text'}
              icon={<EditOutlined />}
              onClick={() => setEditorMode('edit')}
              size="small"
            >
              Edit
            </Button>
            <Button
              type={editorMode === 'split' ? 'primary' : 'text'}
              icon={<SplitCellsOutlined />}
              onClick={() => setEditorMode('split')}
              size="small"
            >
              Split
            </Button>
            <Button
              type={editorMode === 'preview' ? 'primary' : 'text'}
              icon={<EyeOutlined />}
              onClick={() => setEditorMode('preview')}
              size="small"
            >
              Preview
            </Button>
          </div>
          <Tooltip title={localNote.is_pinned ? 'Unpin' : 'Pin'}>
            <Button
              icon={
                localNote.is_pinned ? <PushpinFilled /> : <PushpinOutlined />
              }
              type={localNote.is_pinned ? 'primary' : 'text'}
              onClick={handleTogglePin}
            />
          </Tooltip>
          <Tooltip title="Save">
            <Button
              icon={<SaveOutlined />}
              type="text"
              loading={isSaving}
              onClick={handleManualSave}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              icon={<DeleteOutlined />}
              type="text"
              danger
              onClick={handleDelete}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Теги */}
      {localNote.tags?.length > 0 && (
        <div className="note-tags">
          {localNote.tags.map(tag => (
            <Tag key={tag} className="note-tag">
              {tag}
            </Tag>
          ))}
        </div>
      )}

      {/* Редактор контента */}
      <div className="note-content-editor">
        {renderContent()}
      </div>

      {/* Индикатор сохранения */}
      {hasChanges && (
        <div className="note-save-indicator">
          <span>Unsaved changes</span>
        </div>
      )}
    </div>
  );
};
