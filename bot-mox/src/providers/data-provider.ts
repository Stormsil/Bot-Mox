import type { 
  DataProvider, 
  BaseRecord, 
  GetListResponse, 
  GetOneResponse, 
  CreateResponse, 
  UpdateResponse, 
  DeleteOneResponse, 
  GetManyResponse, 
  CustomResponse,
  GetListParams,
  GetOneParams,
  CreateParams,
  UpdateParams,
  DeleteOneParams,
  GetManyParams,
  BaseKey
} from '@refinedev/core';
import { database } from '../utils/firebase';
import { ref, get, set, update, remove, push } from 'firebase/database';

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>({ resource, pagination, sorters }: GetListParams): Promise<GetListResponse<TData>> => {
    const dbRef = ref(database, resource);
    const snapshot = await get(dbRef);
    
    if (!snapshot.exists()) {
      return {
        data: [] as TData[],
        total: 0,
      };
    }

    const data: TData[] = [];
    snapshot.forEach((childSnapshot) => {
      data.push({
        id: childSnapshot.key as string,
        ...childSnapshot.val(),
      } as TData);
    });

    // Apply sorting
    if (sorters && sorters.length > 0) {
      const sorter = sorters[0];
      data.sort((a, b) => {
        const aVal = a[sorter.field as keyof TData];
        const bVal = b[sorter.field as keyof TData];
        if (sorter.order === 'asc') {
          return aVal > bVal ? 1 : -1;
        }
        return aVal < bVal ? 1 : -1;
      });
    }

    // Apply pagination
    let total = data.length;
    if (pagination && 'current' in pagination) {
      const current = (pagination as { current?: number }).current ?? 1;
      const pageSize = (pagination as { pageSize?: number }).pageSize ?? 10;
      const start = (current - 1) * pageSize;
      const end = start + pageSize;
      return {
        data: data.slice(start, end),
        total,
      };
    }

    return {
      data,
      total,
    };
  },

  getOne: async <TData extends BaseRecord = BaseRecord>({ resource, id }: GetOneParams): Promise<GetOneResponse<TData>> => {
    const dbRef = ref(database, `${resource}/${id}`);
    const snapshot = await get(dbRef);
    
    if (!snapshot.exists()) {
      throw new Error('Resource not found');
    }

    return {
      data: {
        id,
        ...snapshot.val(),
      } as TData,
    };
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({ resource, variables }: CreateParams<TVariables>): Promise<CreateResponse<TData>> => {
    const dbRef = ref(database, resource);
    const newRef = push(dbRef);
    const id = newRef.key;
    
    if (!id) {
      throw new Error('Failed to generate ID');
    }

    const data = {
      ...variables,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await set(newRef, data);

    return {
      data: {
        id,
        ...data,
      } as unknown as TData,
    };
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({ resource, id, variables }: UpdateParams<TVariables>): Promise<UpdateResponse<TData>> => {
    const dbRef = ref(database, `${resource}/${id}`);
    const updates = {
      ...variables,
      updated_at: Date.now(),
    };

    await update(dbRef, updates);

    return {
      data: {
        id,
        ...updates,
      } as unknown as TData,
    };
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = {}>({ resource, id }: DeleteOneParams<TVariables>): Promise<DeleteOneResponse<TData>> => {
    const dbRef = ref(database, `${resource}/${id}`);
    await remove(dbRef);

    return {
      data: { id } as unknown as TData,
    };
  },

  getMany: async <TData extends BaseRecord = BaseRecord>({ resource, ids }: GetManyParams): Promise<GetManyResponse<TData>> => {
    const promises = ids.map(async (id: BaseKey) => {
      const dbRef = ref(database, `${resource}/${id}`);
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        return {
          id,
          ...snapshot.val(),
        } as TData;
      }
      return null;
    });

    const results = await Promise.all(promises);
    const data = results.filter((item) => item !== null) as TData[];

    return {
      data,
    };
  },

  getApiUrl: () => '',

  custom: async <TData extends BaseRecord = BaseRecord>(): Promise<CustomResponse<TData>> => {
    return {
      data: {} as TData,
    };
  },
};