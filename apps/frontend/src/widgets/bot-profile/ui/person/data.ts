import type { PersonData } from '../../../../shared/types';
import { countries } from './data/countries';

interface PersonAddress {
  street: string;
  houseNumber: string;
  locality: string;
  region: string;
  province: string;
  postalCode: string;
}

interface PersonCountryData {
  firstNames: readonly string[];
  lastNames: readonly string[];
  addresses: readonly PersonAddress[];
}

interface PersonDataset {
  Turkey: PersonCountryData;
  Ukraine: PersonCountryData;
}

let personDatasetPromise: Promise<PersonDataset> | null = null;

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

const loadPersonDataset = async (): Promise<PersonDataset> => {
  const [{ turkeyAddresses, ukraineAddresses }, namesModule] = await Promise.all([
    import('./data/addresses'),
    import('./data/names'),
  ]);

  return {
    Turkey: {
      firstNames: namesModule.turkishFirstNames,
      lastNames: namesModule.turkishLastNames,
      addresses: turkeyAddresses,
    },
    Ukraine: {
      firstNames: namesModule.ukrainianFirstNames,
      lastNames: namesModule.ukrainianLastNames,
      addresses: ukraineAddresses,
    },
  };
};

const getPersonDataset = (): Promise<PersonDataset> => {
  if (!personDatasetPromise) {
    personDatasetPromise = loadPersonDataset();
  }

  return personDatasetPromise;
};

export { countries };

export const preloadPersonDataset = async (): Promise<void> => {
  await getPersonDataset();
};

export const generateRandomPersonData = async (country: string): Promise<PersonData> => {
  const byCountry = await getPersonDataset();
  const countryConfig = byCountry[country as keyof PersonDataset] ?? byCountry.Ukraine;
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
