/**
 * @fileoverview Меню команд (slash menu) для rich text редактора заметок
 * Появляется при вводе "/" и позволяет выбрать тип блока
 */

import {
  CheckSquareOutlined,
  FontSizeOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteBlockType } from '../../entities/notes/model/types';
import styles from './NotesComponents.module.css';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/**
 * Опция меню команд
 */
interface CommandOption {
  type: NoteBlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut: string;
}

/**
 * Доступные команды
 */
const COMMANDS: CommandOption[] = [
  {
    type: 'heading_1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: <span className={styles['slash-command-custom-icon']}>H1</span>,
    shortcut: '#',
  },
  {
    type: 'heading_2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: <span className={styles['slash-command-custom-icon']}>H2</span>,
    shortcut: '##',
  },
  {
    type: 'heading_3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: <span className={styles['slash-command-custom-icon']}>H3</span>,
    shortcut: '###',
  },
  {
    type: 'paragraph',
    label: 'Text',
    description: 'Plain text block',
    icon: <FontSizeOutlined />,
    shortcut: 'text',
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    description: 'To-do item with checkbox',
    icon: <CheckSquareOutlined />,
    shortcut: '[]',
  },
  {
    type: 'bullet_list',
    label: 'Bullet List',
    description: 'Bulleted list of items',
    icon: <UnorderedListOutlined />,
    shortcut: '-',
  },
  {
    type: 'numbered_list',
    label: 'Numbered List',
    description: 'Numbered list of items',
    icon: <OrderedListOutlined />,
    shortcut: '1.',
  },
];

interface SlashCommandMenuProps {
  position: { x: number; y: number } | null;
  onSelect: (type: NoteBlockType) => void;
  onClose: () => void;
  filter?: string;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  position,
  onSelect,
  onClose,
  filter = '',
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Фильтрация команд по поисковому запросу - мемоизирована
  const filteredCommands = React.useMemo(() => {
    const filterLower = filter.toLowerCase();
    return COMMANDS.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(filterLower) ||
        cmd.description.toLowerCase().includes(filterLower) ||
        cmd.shortcut.toLowerCase().includes(filterLower),
    );
  }, [filter]);

  // Сброс выбранного индекса при изменении фильтра или списка команд
  useEffect(() => {
    void filter;
    void filteredCommands.length;
    const frameId = window.requestAnimationFrame(() => {
      setSelectedIndex(0);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [filter, filteredCommands.length]);

  // Обработка клавиатурной навигации
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!position) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : prev));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex].type);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onSelect, onClose, position],
  );

  // Обработка клика вне меню
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  // Подписка на события
  useEffect(() => {
    if (position) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [handleKeyDown, handleClickOutside, position]);

  // Прокрутка к выбранному элементу
  useEffect(() => {
    if (menuRef.current && position) {
      const selectedElement = menuRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, position]);

  // Обработка выбора команды
  const handleSelect = useCallback(
    (type: NoteBlockType) => {
      onSelect(type);
    },
    [onSelect],
  );

  // Обработка наведения мыши
  const handleMouseEnter = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  // Если меню не должно быть видно
  if (!position) {
    return null;
  }

  // Если нет подходящих команд
  if (filteredCommands.length === 0) {
    return (
      <div
        ref={menuRef}
        className={styles['slash-command-menu']}
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        <div className={styles['slash-command-empty']}>No commands found</div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className={styles['slash-command-menu']}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {filteredCommands.map((command, index) => (
        <button
          type="button"
          key={command.type}
          className={cx(styles['slash-command-item'], index === selectedIndex && styles.selected)}
          onClick={() => handleSelect(command.type)}
          onMouseEnter={() => handleMouseEnter(index)}
        >
          <div className={styles['slash-command-icon']}>{command.icon}</div>
          <div className={styles['slash-command-content']}>
            <div className={styles['slash-command-label']}>{command.label}</div>
            <div className={styles['slash-command-description']}>{command.description}</div>
          </div>
          <div className={styles['slash-command-shortcut']}>{command.shortcut}</div>
        </button>
      ))}
    </div>
  );
};
