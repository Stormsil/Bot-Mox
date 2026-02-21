import { createNotesPollingSubscription } from '../notes/subscriptions';
import type { Note, NoteIndex, Unsubscribe } from '../notes/types';
import { getAllNotes, getNote } from './crud';
import { getNotesByBot, listNotes } from './query';

const DEFAULT_POLL_INTERVAL_MS = 3000;

export function subscribeToNote(id: string, callback: (note: Note | null) => void): Unsubscribe {
  return createNotesPollingSubscription({
    key: `notes:${id}`,
    intervalMs: 2000,
    load: async () => getNote(id),
    callback,
    fallbackValue: null,
    errorMessage: `Error subscribing to note ${id}:`,
  });
}

export function subscribeToAllNotes(callback: (notes: Note[]) => void): Unsubscribe {
  return createNotesPollingSubscription({
    key: 'notes:all',
    intervalMs: DEFAULT_POLL_INTERVAL_MS,
    load: async () => getAllNotes(),
    callback,
    fallbackValue: [],
    errorMessage: 'Error subscribing to all notes:',
  });
}

export function subscribeToNotesByBot(
  botId: string,
  callback: (notes: Note[]) => void,
): Unsubscribe {
  return createNotesPollingSubscription({
    key: `notes:bot:${botId}`,
    intervalMs: DEFAULT_POLL_INTERVAL_MS,
    load: async () => getNotesByBot(botId),
    callback,
    fallbackValue: [],
    errorMessage: `Error subscribing to notes by bot ${botId}:`,
  });
}

export function subscribeToNotesIndex(callback: (notes: NoteIndex[]) => void): Unsubscribe {
  return createNotesPollingSubscription({
    key: 'notes:index',
    intervalMs: DEFAULT_POLL_INTERVAL_MS,
    load: async () => listNotes(),
    callback,
    fallbackValue: [],
    errorMessage: 'Error subscribing to notes index:',
  });
}
