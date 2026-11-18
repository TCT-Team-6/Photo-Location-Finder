import assert from 'node:assert/strict';
import test from 'node:test';
import { constrainLibrarySearch, LIBRARY_SEARCH_MAX_LENGTH } from './library-search';
test('library searches respect the API limit for typed and pasted input', () => {
  assert.equal(LIBRARY_SEARCH_MAX_LENGTH, 120);
  for (const length of [0, 119, 120, 121, 1000]) {
    assert.equal(constrainLibrarySearch('a'.repeat(length)).length, Math.min(length, 120));
  }
  assert.equal(constrainLibrarySearch('Zoë 東京 %_'), 'Zoë 東京 %_');
});
