/**
 * @fileoverview Базовый редактор блока для rich text редактора заметок
 * Поддерживает заголовки (H1, H2, H3) и параграфы
 */

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteBlockType, TextBlock } from '../../entities/notes/model/types';
import styles from './NoteBlocks.module.css';

interface BlockEditorProps {
  block: TextBlock;
  placeholder?: string;
  onChange: (content: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  onSlashCommand: (position: { x: number; y: number }) => void;
  onFocus: () => void;
  isFocused: boolean;
  autoFocus?: boolean;
}

/**
 * Определяет тип блока по содержимому (для markdown-like синтаксиса)
 */
const detectBlockType = (content: string): NoteBlockType | null => {
  if (content.startsWith('# ')) return 'heading_1';
  if (content.startsWith('## ')) return 'heading_2';
  if (content.startsWith('### ')) return 'heading_3';
  return null;
};

/**
 * Убирает markdown синтаксис из содержимого
 */
const stripMarkdown = (content: string, type: NoteBlockType): string => {
  switch (type) {
    case 'heading_1':
      return content.replace(/^#\s*/, '');
    case 'heading_2':
      return content.replace(/^##\s*/, '');
    case 'heading_3':
      return content.replace(/^###\s*/, '');
    default:
      return content;
  }
};

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/**
 * Получает CSS класс для типа блока
 */
const getBlockClassName = (type: NoteBlockType): string => {
  switch (type) {
    case 'heading_1':
      return cx(styles['block-editor'], styles['heading-1']);
    case 'heading_2':
      return cx(styles['block-editor'], styles['heading-2']);
    case 'heading_3':
      return cx(styles['block-editor'], styles['heading-3']);
    default:
      return cx(styles['block-editor'], styles.paragraph);
  }
};

/**
 * Получает placeholder для типа блока
 */
const getPlaceholder = (type: NoteBlockType): string => {
  switch (type) {
    case 'heading_1':
      return 'Heading 1';
    case 'heading_2':
      return 'Heading 2';
    case 'heading_3':
      return 'Heading 3';
    default:
      return "Type '/' for commands";
  }
};

export const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  placeholder,
  onChange,
  onEnter,
  onBackspace,
  onSlashCommand,
  onFocus,
  isFocused,
  autoFocus = false,
}) => {
  void isFocused;
  const contentRef = useRef<HTMLDivElement>(null);
  const [showPlaceholder, setShowPlaceholder] = useState(!block.content);
  const slashMenuTriggered = useRef(false);

  // Синхронизация contenteditable с пропсами
  useEffect(() => {
    if (contentRef.current && contentRef.current.textContent !== (block.content || '')) {
      contentRef.current.textContent = block.content || '';
      // Используем requestAnimationFrame для избежания setState в эффекте
      requestAnimationFrame(() => {
        setShowPlaceholder(!block.content);
      });
    }
  }, [block.content]);

  // Автофокус при монтировании
  useEffect(() => {
    if (autoFocus && contentRef.current) {
      contentRef.current.focus();
      // Устанавливаем курсор в конец
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(contentRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [autoFocus]);

  // Обработка ввода текста
  const handleInput = useCallback(() => {
    if (contentRef.current) {
      const content = contentRef.current.textContent || '';
      setShowPlaceholder(!content);

      // Проверяем на markdown-like синтаксис для смены типа блока
      const detectedType = detectBlockType(content);
      if (detectedType && detectedType !== block.type) {
        const cleanContent = stripMarkdown(content, detectedType);
        onChange(cleanContent);
        // Тип блока меняется через родительский компонент
        return;
      }

      onChange(content);

      // Проверяем на ввод "/" для открытия меню команд
      if (content === '/' && !slashMenuTriggered.current) {
        slashMenuTriggered.current = true;
        const rect = contentRef.current.getBoundingClientRect();
        onSlashCommand({ x: rect.left, y: rect.bottom + 4 });
      } else if (content !== '/') {
        slashMenuTriggered.current = false;
      }
    }
  }, [block.type, onChange, onSlashCommand]);

  // Обработка нажатия клавиш
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter - создаем новый блок
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onEnter();
      }

      // Backspace - удаляем пустой блок
      if (e.key === 'Backspace') {
        const content = contentRef.current?.textContent || '';
        if (content === '') {
          e.preventDefault();
          onBackspace();
        }
      }

      // Escape - закрываем меню команд
      if (e.key === 'Escape') {
        slashMenuTriggered.current = false;
      }
    },
    [onEnter, onBackspace],
  );

  // Обработка фокуса
  const handleFocus = useCallback(() => {
    onFocus();
  }, [onFocus]);

  // Обработка потери фокуса
  const handleBlur = useCallback(() => {
    slashMenuTriggered.current = false;
  }, []);

  // Обработка вставки (убираем форматирование)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  const className = getBlockClassName(block.type);
  const displayPlaceholder = placeholder || getPlaceholder(block.type);

  return (
    <div className={className} data-block-id={block.id} data-block-type={block.type}>
      {showPlaceholder && <div className={styles['block-placeholder']}>{displayPlaceholder}</div>}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: contentEditable div is the rich-text editor surface */}
      <div
        ref={contentRef}
        className={styles['block-content']}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPaste={handlePaste}
        spellCheck={false}
      />
    </div>
  );
};
