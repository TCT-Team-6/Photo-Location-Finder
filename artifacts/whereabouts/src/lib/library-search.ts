/** Matches the API's ListInvestigationsQueryParams maximum (UTF-16 units). */
export const LIBRARY_SEARCH_MAX_LENGTH = 120;
export function constrainLibrarySearch(value: string): string {
  return value.slice(0, LIBRARY_SEARCH_MAX_LENGTH);
}
