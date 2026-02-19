import type { PersonData } from '../../../types';

export interface BotWithPerson {
  id: string;
  name: string;
  person?: Partial<PersonData>;
  generation_locks?: {
    person_data?: boolean;
  };
}

export interface BotPersonProps {
  bot: BotWithPerson;
}

export type PersonFormValues = PersonData;
