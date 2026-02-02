/**
 * @fileoverview Блок списка (маркированный/нумерованный) для rich text редактора заметок
 * Поддерживает добавление/удаление элементов списка
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { ListBlock, ListItem } from '../../services/notesService';
import { generateListItemId } from '../../services/notesService';
import './NotesComponents.css';

interface ListBlockProps {
  block: ListBlock;
  onChange: (items: ListItem[]) => void;
  onEnter: () => void;
  onBackspace: () => void;
  onFocus: () => void;
  isFocused: boolean;
  autoFocus?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void ((props: ListBlockProps) => [props.onEnter, props.isFocused]);

/**
 * Компонент отдельного элемента списка
 */
interface ListItemEditorProps {
  item: ListItem;
  index: number;
  type: ListBlock['type'];
  onChange: (id: string, content: string) => void;
  onAddItem: (afterIndex: number) => void;
  onRemoveItem: (id: string) => void;
  autoFocus?: boolean;
}

const ListItemEditor: React.FC<ListItemEditorProps> = ({
  item,
  index,
  type,
  onChange,
  onAddItem,
  onRemoveItem,
  autoFocus = false,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showPlaceholder, setShowPlaceholder] = useState(!item.content);

  // Синхронизация contenteditable с пропсами
  useEffect(() => {
    if (contentRef.current && contentRef.current.textContent !== (item.content || '')) {
      contentRef.current.textContent = item.content || '';
      requestAnimationFrame(() => {
        setShowPlaceholder(!item.content);
      });
    }
  }, [item.content]);

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
      onChange(item.id, content);
    }
  }, [item.id, onChange]);

  // Обработка нажатия клавиш
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter - добавляем новый элемент списка
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onAddItem(index);
      }

      // Backspace - удаляем пустой элемент
      if (e.key === 'Backspace') {
        const content = contentRef.current?.textContent || '';
        if (content === '') {
          e.preventDefault();
          onRemoveItem(item.id);
        }
      }
    },
    [index, item.id, onAddItem, onRemoveItem]
  );

  // Обработка вставки (убираем форматирование)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  const marker = type === 'numbered_list' ? `${index + 1}.` : '•';

  return (
    <div className="list-item" data-item-id={item.id}>
      <span className="list-marker">{marker}</span>
      <div className="list-item-content-wrapper">
        {showPlaceholder && (
          <div className="block-placeholder">List item</div>
        )}
        <div
          ref={contentRef}
          className="list-item-content"
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export const ListBlockComponent: React.FC<ListBlockProps> = ({
  block,
  onChange,
  onEnter,
  onBackspace,
  onFocus,
  isFocused,
  autoFocus = false,
}) => {
  // Обработка изменения содержимого элемента
  const handleItemChange = useCallback(
    (id: string, content: string) => {
      const newItems = block.items.map(item =>
        item.id === id ? { ...item, content } : item
      );
      onChange(newItems);
    },
    [block.items, onChange]
  );

  // Добавление нового элемента списка
  const handleAddItem = useCallback(
    (afterIndex: number) => {
      const newItem: ListItem = {
        id: generateListItemId(),
        content: '',
      };
      const newItems = [...block.items];
      newItems.splice(afterIndex + 1, 0, newItem);
      onChange(newItems);
    },
    [block.items, onChange]
  );

  // Удаление элемента списка
  const handleRemoveItem = useCallback(
    (id: string) => {
      // Если остался только один элемент и он пустой - удаляем весь блок
      if (block.items.length === 1 && block.items[0].content === '') {
        onBackspace();
        return;
      }

      const newItems = block.items.filter(item => item.id !== id);
      onChange(newItems);

      // Если удалили последний элемент - создаем новый пустой
      if (newItems.length === 0) {
        const emptyItem: ListItem = {
          id: generateListItemId(),
          content: '',
        };
        onChange([emptyItem]);
      }
    },
    [block.items, onChange, onBackspace]
  );

  // Обработка фокуса на блоке
  const handleContainerFocus = useCallback(() => {
    onFocus();
  }, [onFocus]);

  // Если список пустой - добавляем один пустой элемент
  useEffect(() => {
    if (block.items.length === 0) {
      const emptyItem: ListItem = {
        id: generateListItemId(),
        content: '',
      };
      onChange([emptyItem]);
    }
  }, [block.items.length, onChange]);

  const className =
    block.type === 'numbered_list'
      ? 'list-block numbered-list'
      : 'list-block bullet-list';

  return (
    <div
      className={className}
      data-block-id={block.id}
      data-block-type={block.type}
      onFocus={handleContainerFocus}
    >
      {block.items.map((item, index) => (
        <ListItemEditor
          key={item.id}
          item={item}
          index={index}
          type={block.type}
          onChange={handleItemChange}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          autoFocus={autoFocus && index === block.items.length - 1}
        />
      ))}
    </div>
  );
};
