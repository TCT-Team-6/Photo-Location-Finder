import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PerspectiveCamera,Vector3} from 'three';
import {projectStagePoint,lensSurface} from './loupe-projection';
import {ODOMETER_CELL_EM,odometerTransform} from './odometer-layout';
import {dataGlyphSamplingRatio,dataGlyphRasterRatio,wallGlyphLayout} from './loupe-wall';

test('world-stage projection remains valid over the headline, photo and panel independently of overlay viewport/scroll',()=>{
  const stage={width:1440,height:900},photo={width:1160,height:900};
  const z=stage.height/(2*Math.tan(35*Math.PI/360)),camera=new PerspectiveCamera(35,stage.width/stage.height,.1,12000);
  camera.position.z=z;camera.updateMatrixWorld();
  for(const expected of[{x:540,y:-350},{x:500,y:300},{x:1300,y:400},{x:-80,y:100}]){
    for(const lift of[28,220]){
      const factor=z/(z-lift),world={x:(expected.x-stage.width/2)/factor,y:(stage.height/2-expected.y)/factor,z:lift};
      const actual=projectStagePoint(world,stage,z),projected=new Vector3(world.x,world.y,world.z).project(camera);
      assert.ok(Math.abs(actual.x-expected.x)<1e-8&&Math.abs(actual.y-expected.y)<1e-8);
      assert.ok(Math.abs((projected.x*.5+.5)*stage.width-actual.x)<1e-8);
      assert.ok(Math.abs((.5-projected.y*.5)*stage.height-actual.y)<1e-8);
    }
  }
  assert.equal(lensSurface({x:540,y:-350},stage,photo),'page');
  assert.equal(lensSurface({x:500,y:300},stage,photo),'data');
  assert.equal(lensSurface({x:1300,y:400},stage,photo),'scene');
  const code=readFileSync(new URL('./optical-loupe.ts',import.meta.url),'utf8');
  assert.ok(code.includes('vec2 screen=projectStagePoint(vWorld)'));
  assert.ok(!code.includes('vec2 screen=vec2(gl_FragCoord'));
  assert.ok(code.indexOf('if(inStage<.5||inHeader>.5||onPaper(p)>.5)return')<code.indexOf('vec3 scene=texture2D(uScene'));
  assert.ok(code.includes("document.querySelector('.wa-hero-title')"));
  assert.ok(code.includes('uHeaderBottom||onPaper(p)>.5)return 0.'));
});
test('data glyphs have 10+ meaningful source rows, retain 20px perceived height and roughly twelve columns at 6x',()=>{
  const glyph=wallGlyphLayout({actualBoundingBoxAscent:8,actualBoundingBoxDescent:0});
  for(const dpr of[1,1.25,1.75,2,3]){
    assert.ok(glyph.glyphHeight*dataGlyphSamplingRatio(dpr)>=10);
    assert.ok(glyph.glyphHeight*dataGlyphRasterRatio(dpr)>=20);
    assert.equal(glyph.glyphHeight*6,20);
    const columns=178/(glyph.fontSize*.6*6);assert.ok(columns>=10&&columns<=14);
  }
  const code=readFileSync(new URL('./optical-loupe.ts',import.meta.url),'utf8');
  assert.ok(code.includes('floor(wallPoint*uDataDpr)'));
});
test('all ten odometer offsets use the same padded em cell; 72px digits have room for 86px font ink',()=>{
  assert.ok(72*ODOMETER_CELL_EM>=86+10);
  for(let digit=0;digit<10;digit++)assert.equal(odometerTransform(digit),`translateY(${-digit*140/100}em)`);
  assert.equal(odometerTransform(NaN),'translateY(0em)');
  const css=readFileSync(new URL('../styles/desk-refinements.css',import.meta.url),'utf8');
  assert.ok(css.includes('flex:0 0 var(--fd-digit-height,1.4em)'));
  assert.ok(css.includes('.wa-dashboard .wa-stat,.wa-settings>.fd-preference-section{border:0!important'));
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  assert.ok(app.includes('(rows.length>0||!investigations.isSuccess)&&<Link'));
  const settings=app.slice(app.indexOf('function SettingsPage()'));
  assert.equal((settings.match(/<section className="fd-preference-section/g)||[]).length,4);
});
