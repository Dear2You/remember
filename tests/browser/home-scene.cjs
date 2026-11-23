'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

test('六套首页插画铺满视口，日期与收支可分别点选', async t => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || undefined});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
  const html = process.env.APP_HTML || path.join(__dirname, '../../app/index.html');
  await page.goto(pathToFileURL(path.resolve(html)).href);
  const nav = route => page.locator('#tabbar [data-route="'+route+'"]').click();
  const cover = page.getByRole('button', {name: /今天.*打开日历/});
  const scenes = {ink:'summer-scroll', starry:'starry-shore', coast:'coastal-sky',
    future:'future-horizon', forest:'forest-mist', sunset:'sunset-glow'};
  for (const [id,image] of Object.entries(scenes)) {
    await nav('settings');
    await page.getByRole('combobox', {name: '界面主题'}).selectOption(id);
    assert.equal(await page.locator('#app.home-scene').count(), 0);
    await nav('home');
    await cover.waitFor();
    for (const viewport of [{width:390,height:844}, {width:844,height:390}]) {
      await page.setViewportSize(viewport);
      const expected = id === 'ink' && viewport.width > viewport.height ? 'summer-mist' : image;
      await page.waitForFunction(({expected,width,height})=>{
        const css=getComputedStyle(document.getElementById('app'),'::before');
        return css.backgroundImage.endsWith('/'+expected+'.webp")') &&
          parseFloat(css.width)===width && parseFloat(css.height)===height;
      },{expected,...viewport},{timeout:5000});
      const scene = await page.locator('#app').evaluate(el => {
        const css = getComputedStyle(el, '::before');
        return {file:css.backgroundImage, width:parseFloat(css.width), height:parseFloat(css.height),
          size:css.backgroundSize, repeat:css.backgroundRepeat, pointer:css.pointerEvents};
      });
      assert.ok(scene.file.endsWith('/'+expected+'.webp")'), scene.file);
      assert.deepEqual([scene.width, scene.height, scene.size, scene.repeat, scene.pointer],
        [viewport.width, viewport.height, 'cover', 'no-repeat', 'none']);
      const framedImages = await cover.evaluate(el => [el,...el.querySelectorAll('*')].filter(node =>
        node.matches('img,picture,canvas') || ['', '::before', '::after'].some(pseudo =>
          getComputedStyle(node, pseudo || null).backgroundImage.includes('url('))).length);
      assert.equal(framedImages, 0);
    }
    await page.setViewportSize({width:390,height:844});
    const bounds = await cover.boundingBox();
    await cover.click({position:{x:bounds.width-12,y:bounds.height/2}});
    assert.equal(await page.locator('.lc-cell.selected').getAttribute('data-date'), await page.evaluate(()=>U.todayStr()));
    assert.equal(await page.locator('#app.home-scene').count(), 0);
    await nav('home');
    await page.getByRole('button', {name: '隐藏金额'}).click();
    assert.deepEqual(await page.locator('.folio-metrics b').allInnerTexts(), ['••••','••••','••••']);
    await page.getByRole('button', {name: '显示金额'}).click();
    await page.locator('.folio-metrics').click();
    assert.equal(await page.locator('.j-top [aria-pressed="true"]').innerText(), '收支分析');
  }
});
