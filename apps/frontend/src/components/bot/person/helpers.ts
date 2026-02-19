import type { PersonData } from '../../../types';
import { countries } from './data';
import type { BotWithPerson, PersonFormValues } from './types';

const PERSON_GENERATOR_KEY = 'botmox_person_generator_country';

const toSafeString = (value: unknown): string => (typeof value === 'string' ? value : '');

const hasText = (value: string): boolean => value.trim().length > 0;

export const normalizeCountry = (country?: string): string => {
  if (country && countries.includes(country)) {
    return country;
  }
  return countries[0];
};

export const loadPersonGeneratorCountry = (): string | null => {
  try {
    const stored = localStorage.getItem(PERSON_GENERATOR_KEY);
    if (!stored) return null;
    return countries.includes(stored) ? stored : null;
  } catch (error) {
    console.error('Failed to load person generator country:', error);
    return null;
  }
};

export const savePersonGeneratorCountry = (country: string) => {
  try {
    localStorage.setItem(PERSON_GENERATOR_KEY, normalizeCountry(country));
  } catch (error) {
    console.error('Failed to save person generator country:', error);
  }
};

export const toPersonFormValues = (person?: BotWithPerson['person']): PersonFormValues => ({
  first_name: toSafeString(person?.first_name),
  last_name: toSafeString(person?.last_name),
  birth_date: toSafeString(person?.birth_date),
  country: toSafeString(person?.country),
  city: toSafeString(person?.city),
  address: toSafeString(person?.address),
  zip: toSafeString(person?.zip),
});

export const toPersonPayload = (values: Partial<PersonFormValues>): PersonData => ({
  first_name: toSafeString(values.first_name),
  last_name: toSafeString(values.last_name),
  birth_date: toSafeString(values.birth_date),
  country: toSafeString(values.country),
  city: toSafeString(values.city),
  address: toSafeString(values.address),
  zip: toSafeString(values.zip),
});

export const hasAnyPersonData = (person?: BotWithPerson['person']): boolean =>
  Object.values(toPersonFormValues(person)).some((value) => hasText(value));

export const isPersonDataComplete = (person?: BotWithPerson['person']): boolean =>
  Object.values(toPersonFormValues(person)).every((value) => hasText(value));
