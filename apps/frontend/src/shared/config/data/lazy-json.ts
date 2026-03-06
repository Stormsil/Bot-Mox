const jsonDataCache = new Map<string, unknown>();
const jsonRequestCache = new Map<string, Promise<unknown>>();

export async function loadLazyJson<T>(url: string): Promise<T> {
  const cachedData = jsonDataCache.get(url);
  if (cachedData !== undefined) {
    return cachedData as T;
  }

  const cachedRequest = jsonRequestCache.get(url);
  if (cachedRequest) {
    return cachedRequest as Promise<T>;
  }

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load JSON data from ${url}: ${response.status}`);
      }

      return (await response.json()) as T;
    })
    .then((data) => {
      jsonDataCache.set(url, data);
      jsonRequestCache.delete(url);
      return data;
    })
    .catch((error) => {
      jsonRequestCache.delete(url);
      throw error;
    });

  jsonRequestCache.set(url, request as Promise<unknown>);
  return request;
}
