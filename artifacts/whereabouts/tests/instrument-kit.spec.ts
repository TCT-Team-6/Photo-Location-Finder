import {test,expect} from '@playwright/test';

// Uses the public local-only scene export harness, not an auth bypass.
test('genuine scene meshes mount, PNG frames export, and the swatch remains fixed while closing and changing themes',async({page})=>{
  await page.setViewportSize({width:1500,height:1500});
  const proof:string[]=[],errors:string[]=[];
  page.on('console',message=>{if(message.text().startsWith('[3D] '))proof.push(message.text());if(message.type()==='error'&&message.text().includes('[InstrumentKit]'))errors.push(message.text());});
  await page.goto('/?instrument-kit=export');
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('[data-instrument-kind][data-rendered=true]')).toHaveCount(12,{timeout:45000});
  const book=page.locator('.physical-swatch'),before=await book.boundingBox();
  for(let round=0;round<3;round++){
    await page.mouse.move(1490,1490);await book.hover();await expect(book).toHaveAttribute('data-fan-state','open');
    await page.getByTestId('button-theme-rescue').focus();await page.keyboard.press('Escape');await expect(book).toHaveAttribute('data-fan-state','closed');
    const box=await book.boundingBox();expect(box?.width).toBe(before?.width);expect(box?.height).toBe(before?.height);
  }
  for(const id of['field','ocean']){
    const radio=page.getByTestId(`button-theme-${id}`);await radio.focus();await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-app-theme',id,{timeout:6000});
  }
  await expect(page.locator('[data-instrument-kind][data-rendered=true]')).toHaveCount(12);
  const frames=await page.evaluate(async()=>{if(!window.InstrumentKitExport)throw new Error('The real renderer export is unavailable.');return window.InstrumentKitExport();});
  expect(frames).toHaveLength(12);for(const frame of frames)expect(frame.png).toMatch(/^data:image\/png;base64,/);
  expect(proof.filter(line=>/\d+ meshes, \d+ triangles$/.test(line)).length).toBeGreaterThanOrEqual(12);
  expect(errors).toEqual([]);
});
