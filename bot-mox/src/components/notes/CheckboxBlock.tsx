/**
 * @fileoverview Блок чекбокса для rich text редактора заметок
 * Поддерживает переключение состояния и редактирование текста
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Checkbox } from 'antd';
import type { CheckboxBlock } from '../../services/notesService';
import './NotesComponents.css';

interface CheckboxBlockProps {
  block: CheckboxBlock;
  onChange: (content: string) => void;
  onCheckedChange: (checked: boolean) => void;
  onEnter: () => void;
  onBackspace: () => void;
  onFocus: () => void;
  isFocused: boolean;
  autoFocus?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void ((props: CheckboxBlockProps) => props.isFocused);

export const CheckboxBlockComponent: React.FC<CheckboxBlockProps> = ({
  block,
  onChange,
  onCheckedChange,
  onEnter,
  onBackspace,
  onFocus,
  isFocused,
  autoFocus = false,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showPlaceholder, setShowPlaceholder] = useState(!block.content);

  // Синхронизация contenteditable с пропсами
  useEffect(() => {
    if (contentRef.current && contentRef.current.textContent !== (block.content || '')) {
      contentRef.current.textContent = block.content || '';
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
      onChange(content);
    }
  }, [onChange]);

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
    },
    [onEnter, onBackspace]
  );

  // Обработка изменения состояния чекбокса
  const handleCheckboxChange = useCallback(
    (e: { target: { checked: boolean } }) => {
      onCheckedChange(e.target.checked);
    },
    [onCheckedChange]
  );

  // Обработка клика по чекбоксу (чтобы не терять фокус на тексте)
  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Обработка фокуса
  const handleFocus = useCallback(() => {
    onFocus();
  }, [onFocus]);

  // Обработка вставки (убираем форматирование)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  return (
    <div
      className={`checkbox-block ${block.checked ? 'checked' : ''}`}
      data-block-id={block.id}
      data-block-type="checkbox"
    >
      <div className="checkbox-wrapper" onClick={handleCheckboxClick}>
        <Checkbox
          checked={block.checked}
          onChange={handleCheckboxChange}
          className="checkbox-input"
        />
      </div>
      <div className="checkbox-content-wrapper">
        {showPlaceholder && (
          <div className="block-placeholder">To-do</div>
        )}
        <div
          ref={contentRef}
          className="checkbox-content"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onPaste={handlePaste}
          spellCheck={false}
        />
      </div>
    </div>
  );
};
