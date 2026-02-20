import type { PersonData } from '../../../types';
import { turkeyAddresses, ukraineAddresses } from './data/addresses';
import { countries } from './data/countries';
import {
  turkishFirstNames,
  turkishLastNames,
  ukrainianFirstNames,
  ukrainianLastNames,
} from './data/names';

type PersonAddress = (typeof turkeyAddresses)[0];

const pickRandom = <T>(values: readonly T[]): T =>
  values[Math.floor(Math.random() * values.length)];

const generateRandomBirthDate = (): string => {
  const startDate = new Date(1970, 0, 1);
  const endDate = new Date(2000, 11, 31);
  const randomDate = new Date(
    startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()),
  );

  const day = String(randomDate.getDate()).padStart(2, '0');
  const month = String(randomDate.getMonth() + 1).padStart(2, '0');
  const year = randomDate.getFullYear();

  return `${day}-${month}-${year}`;
};

const byCountry = {
  Turkey: {
    firstNames: turkishFirstNames,
    lastNames: turkishLastNames,
    addresses: turkeyAddresses,
  },
  Ukraine: {
    firstNames: ukrainianFirstNames,
    lastNames: ukrainianLastNames,
    addresses: ukraineAddresses,
  },
} as const;

export { countries };

export const generateRandomPersonData = (country: string): PersonData => {
  const countryConfig = byCountry[country as keyof typeof byCountry] ?? byCountry.Ukraine;
  const firstName = pickRandom(countryConfig.firstNames);
  const lastName = pickRandom(countryConfig.lastNames);
  const address: PersonAddress = pickRandom(countryConfig.addresses);

  return {
    first_name: firstName,
    last_name: lastName,
    birth_date: generateRandomBirthDate(),
    country,
    city: address.locality,
    address: `${address.street} ${address.houseNumber}`,
    zip: address.postalCode,
  };
};
