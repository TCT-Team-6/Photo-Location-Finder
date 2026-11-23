import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('OSM tile layers identify the site without revealing report paths',()=>{
  for(const file of ['geographic-confidence-map','lead-location-map']){
    const source=readFileSync(new URL(`../components/${file}.tsx`,import.meta.url),'utf8');
    assert.match(source,/referrerPolicy="strict-origin"/);
    assert.match(source,/https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
    assert.match(source,/openstreetmap\.org\/copyright/);
    assert.doesNotMatch(source,/referrerPolicy="no-referrer"/);
  }
});
