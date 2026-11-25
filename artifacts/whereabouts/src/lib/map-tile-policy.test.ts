import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('OSM tile layers identify the site without revealing report paths',()=>{
  for(const file of ['geographic-confidence-map','lead-location-map']){
    const source=readFileSync(new URL(`../components/${file}.tsx`,import.meta.url),'utf8');
    assert.match(source,/referrerPolicy="strict-origin"/);
    if(file==='geographic-confidence-map'){
      assert.match(source,/https:\/\/\{s\}\.tile\.opentopomap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
      assert.match(source,/SRTM/);assert.match(source,/CC-BY-SA/);
      assert.match(source,/maxZoom=\{17\}/);
      assert.doesNotMatch(source,/cartocdn|dark_/);
    }else assert.match(source,/https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
    assert.match(source,/openstreetmap\.org\/copyright/);
    assert.doesNotMatch(source,/referrerPolicy="no-referrer"/);
  }
});
