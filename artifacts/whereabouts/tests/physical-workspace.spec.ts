import { test, expect, type Page } from '@playwright/test';

// Supply a real signed-in Playwright storage state. Never bypass authentication.
test.describe('authenticated physical field desk',()=>{
  test.skip(!process.env.WHEREABOUTS_AUTH_STATE,'Requires a real signed-in WHEREABOUTS_AUTH_STATE; no auth bypass.');
  test.use({storageState:process.env.WHEREABOUTS_AUTH_STATE});
  const fixture={id:'instrument-fixture',title:'Investigations — Field notes',desk:'original',status:'done',contentType:'image/png',context:'',shotAt:null,summary:'Fixture report',candidates:[],clues:[],createdAt:'2026-07-16T10:14:00Z',updatedAt:'2026-07-16T10:14:00Z'};
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1sAAAAASUVORK5CYII=','base64');
  async function mocks(page:Page){
    await page.route('**/api/locator-health',r=>r.fulfill({json:{video_enabled:true}}));
    await page.route(/\/api\/investigations\/summary(?:\?.*)?$/,r=>r.fulfill({json:{total:3,thisMonth:2,latest:fixture}}));
    await page.route(/\/api\/investigations(?:\?.*)?$/,r=>r.request().method()==='GET'?r.fulfill({json:[fixture,{...fixture,id:'recreation-fixture',desk:'recreation'},{...fixture,id:'journalism-fixture',desk:'fake-news'}]}):r.fallback());
    await page.route('**/api/storage/uploads/request-url',r=>r.fulfill({json:{uploadURL:new URL('/__instrument-test-transfer',page.url()).href,objectPath:'/objects/instrument-fixture'}}));
    await page.route('**/__instrument-test-transfer',r=>r.fulfill({status:200,body:''}));
  }
  test('dial clicks and keyboard preserve the grid; keys filter independently',async({page})=>{
    await mocks(page);const shifts:string[]=[];page.on('console',message=>{if(message.type()==='warning'&&message.text().includes('[Control layout shift]'))shifts.push(message.text());});
    await page.goto('/investigate');await page.evaluate(()=>document.fonts.ready);
    const source=page.locator('.fd-source-desk'),initial=await source.boundingBox();
    for(let round=0;round<3;round++)for(const label of ['A · INVESTIGATIONS','B · RECREATION','C · JOURNALISM']){
      await page.getByRole('button',{name:label,exact:true}).focus();await page.keyboard.press('Enter');const next=await source.boundingBox();expect(next?.x).toBe(initial?.x);expect(next?.width).toBe(initial?.width);expect(next?.height).toBe(initial?.height);
    }
    await page.getByRole('slider',{name:'Desk',exact:true}).focus();await page.keyboard.press('Home');await expect(page.getByRole('slider',{name:'Desk',exact:true})).toHaveAttribute('aria-valuenow','0');await page.keyboard.press('ArrowRight');await expect(page.getByRole('slider',{name:'Desk',exact:true})).toHaveAttribute('aria-valuenow','1');
    expect(shifts).toEqual([]);
    await page.locator('[data-testid="nav-my-library"]:visible').click();
    await page.getByTestId('button-filter-desk-0').focus();await page.keyboard.press('Space');await expect(page.getByTestId('card-investigation-recreation-fixture')).toHaveCount(0);
    await page.getByTestId('button-filter-desk-2').focus();await page.keyboard.press('Space');await expect(page.getByTestId('card-investigation-journalism-fixture')).toBeVisible();
    await page.getByTestId('button-filter-desk-0').focus();await page.keyboard.press('ArrowRight');await expect(page.getByTestId('button-filter-desk-1')).toBeFocused();await page.keyboard.press('Space');await expect(page.getByTestId('button-filter-desk-1')).toHaveAttribute('aria-checked','true');
  });
  test('background navigation retains files; cancel discloses server limits; retry does not create duplicates',async({page})=>{
    await mocks(page);let creates=0,release:()=>void=()=>{};const accepted=new Promise<void>(resolve=>{release=resolve;});
    await page.route(/\/api\/investigations$/,async r=>{if(r.request().method()!=='POST'){await r.fallback();return;}creates++;await accepted;await r.fulfill({json:fixture});});
    await page.goto('/investigate');await page.getByTestId('input-photo-file').setInputFiles({name:'field-frame.png',mimeType:'image/png',buffer:png});
    await page.getByTestId('button-investigation-next-photo').click();await page.getByTestId('input-investigation-title').fill('Retained field notes');await page.getByRole('button',{name:'Next →',exact:true}).click();await page.getByTestId('button-analyze-photo-desks').focus();await page.keyboard.press('Space');
    await expect(page.getByTestId('panel-report-sheet')).toBeVisible();await expect(page.locator('.report-stage-list li[data-state=running]')).toContainText('READ SCENE');
    await page.getByTestId('button-report-background').click();await page.locator('[data-testid="nav-my-library"]:visible').click();await expect(page).toHaveURL(/\/library$/);
    await page.locator('[data-testid="button-report-progress"]:visible').click();await expect(page.getByTestId('panel-report-sheet')).toContainText('Retained field notes');await page.keyboard.press('Escape');await expect(page.getByTestId('panel-report-sheet')).toHaveCount(0);
    await page.locator('[data-testid="button-report-progress"]:visible').click();await page.getByTestId('button-report-cancel').click();await expect(page.getByRole('alertdialog')).toContainText('Already accepted server analysis cannot be stopped');await page.getByTestId('button-confirm-stop').click();
    await expect(page.getByTestId('button-report-retry')).toBeDisabled();release();await expect(page.getByTestId('button-report-retry')).toBeEnabled();
    await page.getByTestId('button-report-close').click();await page.locator('[data-testid="nav-new-investigation"]:visible').click();
    await expect(page.getByTestId('input-investigation-title')).toHaveValue('Retained field notes');await expect(page.getByTestId('list-original-items')).toContainText('field-frame.png');
    await page.locator('[data-testid="button-report-progress"]:visible').click();await page.getByTestId('button-report-retry').click();await expect(page.getByTestId('button-open-report')).toBeVisible();expect(creates).toBe(1);
  });
});
