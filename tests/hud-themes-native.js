/* SPDX-License-Identifier: GPL-3.0-or-later; Copyright (C) 2026 Tablelight contributors. */
'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { BrowserWindow } = require('electron');
const TL = require('../core'),
  Themes = require('../hud-themes');
const { png, dataUrl } = require('./icon-fixtures');
module.exports = async ({ app, controller, getOverlay, getState, setOverlay, store }) => {
  const directory = path.dirname(store.directory),
    results = [];
  const run = (code) =>
    controller.webContents.executeJavaScript(`(async()=>{${code}})()`).catch((error) => {
      throw Error('DM: ' + error.message + ' / ' + code.slice(0, 180));
    });
  const tv = (code) =>
    getOverlay()
      .webContents.executeJavaScript(`(async()=>{const render=paint;${code}})()`)
      .catch((error) => {
        throw Error('TV: ' + error.message + ' / ' + code.slice(0, 180));
      });
  const wait = async (check) => {
    const start = Date.now();
    while (!(await check())) {
      if (Date.now() - start > 10000) throw Error('Theme check timed out');
      await new Promise((r) => setTimeout(r, 40));
    }
  };
  const shot = async (win, name) => {
    for (let i = 0; ; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        fs.writeFileSync(
          path.join(directory, name + '.png'),
          (await win.webContents.capturePage()).toPNG()
        );
        return;
      } catch (e) {
        if (i === 3) throw e;
      }
    }
  };
  // Read the final browser colors, including inherited opacity and composited backings.
  const inspect = `
    const root=document.querySelector('.hud-position');
    const rgba=s=>{const a=s.match(/[\\d.]+/g)?.map(Number)||[0,0,0,0];return [a[0],a[1],a[2],a[3]??1];};
    const over=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
    const lum=a=>a.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    function bg(el){const chain=[];for(let n=el;n;n=n.parentElement)chain.unshift(n);return chain.reduce((b,n)=>over(rgba(getComputedStyle(n).backgroundColor),b),[255,255,255]);}
    let minimum=100, worst='', samples=0;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const text=walker.currentNode,el=text.parentElement;if(!text.textContent.trim()||!el.getClientRects().length)continue;
      const css=getComputedStyle(el);if(css.visibility==='hidden'||css.display==='none')continue;
      let opacity=1;for(let n=el;n;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity);
      const background=bg(el),fg=rgba(css.color);fg[3]*=opacity;const value=ratio(over(fg,background),background);samples++;
      if(value<minimum){minimum=value;worst=text.textContent.trim().slice(0,60)+' / '+el.className+' / '+css.color;}
    }
    const controls=[...root.querySelectorAll('button:not(:disabled),input,.hud-option')].map(el=>{const css=getComputedStyle(el),background=bg(el);return {border:Math.max(ratio(over(rgba(css.borderTopColor),background),background),ratio(over(rgba(css.borderTopColor),bg(el.parentElement)),bg(el.parentElement))),text:ratio(over(rgba(css.color),background),background),name:el.textContent.trim().slice(0,30)};});
    return {minimum,worst,samples,controls};
  `;
  const signature = `document.getAnimations().forEach(a=>{a.pause();a.currentTime=0;});const root=document.querySelector('.hud-position');return [...root.querySelectorAll('*')].map(el=>{const s=getComputedStyle(el);return [el.tagName,el.className,s.color,s.backgroundColor,s.backgroundImage,s.borderColor,s.fontSize,s.opacity,s.filter,el.offsetWidth,el.offsetHeight];});`;
  const pose = `return [...document.querySelectorAll('.hud-position')].map(el=>({width:el.offsetWidth,height:el.offsetHeight,left:el.style.left,top:el.style.top,transform:el.style.transform,cardWidth:el.querySelector('.hud-card')?.offsetWidth,cardHeight:el.querySelector('.hud-card')?.offsetHeight}));`;
  let gallery;
  try {
    controller.setBounds({ width: 1440, height: 950 });
    controller.showInactive();
    const fixture = TL.empty();
    fixture.settings.soloExpand = false;
    fixture.settings.overlayInteractive = true;
    fixture.library = [
      TL.libraryEntry({
        id: 'art',
        name: 'Shared illustrated technique',
        icon: dataUrl(png(2, 1, { pixel: [245, 245, 245, 255] })),
        economy: 'action',
      }),
    ];
    fixture.characters = Array.from({ length: 8 }, (_, i) => {
      const c = TL.character(i);
      c.name = 'Theme player ' + (i + 1);
      c.className = 'Any class or subclass';
      c.hp = 24;
      c.maxHp = 38;
      c.tempHp = 6;
      c.turn.bonus = false;
      c.concentrating = true;
      c.concentration = 'Prismatic beacon';
      c.resources = [
        {
          id: 'dark',
          name: 'Dark resource',
          color: '#080808',
          icon: 'star',
          current: 2,
          max: 4,
          reset: 'long',
        },
        {
          id: 'light',
          name: 'Light resource',
          color: '#FAFAFA',
          icon: 'diamond',
          current: 1,
          max: 3,
          reset: 'short',
        },
      ];
      c.items = [
        TL.item({
          name: 'Available technique',
          description: 'Synthetic ability text. '.repeat(120),
        }),
        TL.item({ name: 'Unavailable technique', disabled: true }),
      ];
      c.slots[0] = { level: 1, max: 4, current: 2 };
      c.skills.Acrobatics.rank = 2;
      c.hud = {
        ...c.hud,
        expanded: i === 0,
        visible: true,
        panel: 'action',
        x: i === 0 ? 35 : 75,
        y: i === 0 ? 50 : 10 + i * 11,
        rotation: i === 0 ? 0 : (i % 4) * 90,
        scale: 0.6,
      };
      return c;
    });
    TL.attachItem(fixture, fixture.characters[0].id, 'art');
    await run(
      `await commit(()=>{state=TL.normalize(${JSON.stringify(fixture)});},'Theme fixture');view='display';render();`
    );
    await setOverlay(true);
    await wait(() => tv(`return document.querySelectorAll('.hud-position').length===8;`));
    const savedBefore = TL.toBackup(getState());
    await tv(
      `window.themeRoot=document.querySelector('.hud-position');window.themeLink=document.querySelector('link[href="hud-themes.css"]');themeLink.disabled=true;`
    );
    const original = await tv(signature);
    await tv(`themeLink.disabled=false;HUDThemes.apply(themeRoot,'default');`);
    assert.deepEqual(await tv(signature), original);
    await tv(`HUDThemes.apply(themeRoot,'future-theme');`);
    assert.deepEqual(await tv(signature), original);
    await tv(`HUDThemes.apply(themeRoot,'wizard');HUDThemes.apply(themeRoot,'default');`);
    assert.deepEqual(await tv(signature), original);
    results.push(
      'Default, missing and unknown themes preserve the original computed appearance; returning from a class theme removes only theme decoration.'
    );

    const basePose = await tv(pose),
      contrasts = [],
      defaultLimitations = [];
    for (const theme of Themes.choices) {
      for (const opacity of [0.4, 0.94, 1])
        for (const map of ['#ffffff', '#000000', 'pattern']) {
          await tv(
            `state.characters[0].theme=${JSON.stringify(theme.id)};state.settings.opacity=${opacity};render();document.getElementById('overlay-stage').style.background=${JSON.stringify(map === 'pattern' ? 'repeating-conic-gradient(#fff 0% 25%,#000 0% 50%) 0 / 40px 40px' : map)};`
          );
          const report = await tv(inspect);
          if (theme.id === 'default') {
            if (report.minimum < 4.5)
              defaultLimitations.push({ opacity, map, ...report, controls: undefined });
          } else {
            assert.ok(report.samples > 60);
            assert.ok(
              report.minimum >= 4.5,
              theme.name + ' ' + opacity + ' ' + map + ' text ' + JSON.stringify(report)
            );
            for (const c of report.controls)
              assert.ok(c.border >= 3, theme.name + ' ' + c.name + ' border ' + c.border);
            contrasts.push({ theme: theme.id, opacity, map, minimum: report.minimum });
          }
          assert.deepEqual(await tv(pose), basePose);
        }
      await run(
        `state.characters[0].theme=${JSON.stringify(theme.id)};state.settings.opacity=1;render();`
      );
      await tv(`state.settings.opacity=1;render();`);
      const colors = `const root=document.querySelector('.hud-position');return ['.hud-card','.hud-collapsed','.hud-economy','.hud-option','.hud-nav .chosen','.hud-resource'].map(sel=>{const el=root.querySelector(sel);if(!el)return null;const s=getComputedStyle(el);return [s.color,s.backgroundColor,s.borderColor];});`;
      await wait(() => run(`return !!document.querySelector('.hud-position');`));
      assert.deepEqual(await run(colors), await tv(colors));
    }
    results.push(
      'All 13 class themes pass rendered text and control-boundary checks across three frame opacities and bright, dark and patterned maps; DM/TV colors and HUD dimensions/placements match.'
    );

    for (const panel of ['sheet', 'resources', 'detail']) {
      for (const theme of Object.values(Themes.palettes)) {
        await tv(
          `state.characters[0].theme=${JSON.stringify(theme.id)};state.characters[0].hud.panel=${JSON.stringify(panel === 'detail' ? 'action' : panel)};state.characters[0].hud.detailId=${panel === 'detail' ? 'state.characters[0].items[0].id' : "''"};render();`
        );
        const report = await tv(inspect);
        assert.ok(report.minimum >= 4.5, theme.name + ' ' + panel + ' ' + JSON.stringify(report));
      }
    }
    await tv(
      `state.characters[0].hud.panel='action';state.characters[0].hud.detailId='';state.characters.forEach((c,i)=>c.theme=HUDThemes.choices[i+1].id);render();`
    );
    const independent = await tv(
      `return [...document.querySelectorAll('.hud-position')].map(el=>({id:el.dataset.hudTheme,accent:el.style.getPropertyValue('--accent'),text:getComputedStyle(el.querySelector('.portrait>span')).color,ring:getComputedStyle(el.querySelector('.portrait')).backgroundImage}));`
    );
    assert.equal(new Set(independent.map((c) => c.id)).size, 8);
    for (let i = 0; i < 8; i++)
      assert.equal(independent[i].accent, getState().characters[i].accent);
    const resourceColors = await tv(
      `return [...document.querySelectorAll('.hud-resource-icon-frame .resource-icon')].map(el=>[el.style.color,getComputedStyle(el).clipPath]);`
    );
    assert.ok(resourceColors.some(([color]) => color === 'rgb(8, 8, 8)'));
    assert.ok(resourceColors.some(([color]) => color === 'rgb(250, 250, 250)'));
    assert.equal(
      await tv(`return document.querySelector('.ability-thumbnail img').src;`),
      getState().library[0].icon
    );
    assert.equal(
      await tv(`return getComputedStyle(document.querySelector('.ability-thumbnail img')).filter;`),
      'none'
    );
    await tv(`HUDThemes.apply(document.querySelector('.hud-position'),'wizard');`);
    assert.deepEqual(
      (
        await tv(
          `return [...document.querySelectorAll('.hud-position')].map(el=>({id:el.dataset.hudTheme,accent:el.style.getPropertyValue('--accent'),text:getComputedStyle(el.querySelector('.portrait>span')).color,ring:getComputedStyle(el.querySelector('.portrait')).backgroundImage}));`
        )
      ).slice(1),
      independent.slice(1)
    );
    assert.deepEqual(TL.toBackup(getState()), savedBefore);
    results.push(
      'Skills, saves and long details stay readable; eight independently themed bubbles retain player rings, artwork, resource colors/shapes, gameplay data and backups.'
    );

    const wc = getOverlay().webContents;
    wc.debugger.attach('1.3');
    await wc.debugger.sendCommand('DOM.enable');
    await wc.debugger.sendCommand('CSS.enable');
    for (const theme of Object.values(Themes.palettes)) {
      await tv(
        `HUDThemes.apply(document.querySelector('.hud-position'),${JSON.stringify(theme.id)});`
      );
      const { root } = await wc.debugger.sendCommand('DOM.getDocument');
      const { nodeId } = await wc.debugger.sendCommand('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: '.hud-position .hud-toolstrip button',
      });
      await wc.debugger.sendCommand('CSS.forcePseudoState', {
        nodeId,
        forcedPseudoClasses: ['hover', 'focus-visible'],
      });
      await new Promise((r) => setTimeout(r, 170));
      const report = await tv(inspect);
      assert.ok(report.minimum >= 4.5, theme.name + ' hover ' + report.worst);
      assert.equal(
        await tv(
          `return getComputedStyle(document.querySelector('.hud-toolstrip button')).outlineStyle;`
        ),
        'solid'
      );
      await wc.debugger.sendCommand('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
    }
    wc.debugger.detach();
    await tv(
      `state.characters[0].pendingRequests=[{id:'request',name:'Reaction awaiting approval',urgent:true,slotLevel:1}];state.characters[0].theme='artificer';render();`
    );
    assert.ok((await tv(inspect)).minimum >= 4.5);
    await tv(
      `document.querySelector('.hud-position').insertAdjacentHTML('beforeend','<div class="hud-use-warning-backdrop"><div class="hud-use-warning"><h3>Switch concentration?</h3><p>Your current concentration will end.</p><div class="row"><button>Cancel</button><button>Continue</button></div></div></div>');`
    );
    assert.ok((await tv(inspect)).minimum >= 4.5);
    results.push(
      'Hovered/focused controls, selected navigation, spent/disabled labels, concentration, damage reminders, approval notices and warning dialogs retain readable treatments. Message unread indicators remain for milestone 6.'
    );

    await tv(`state.characters[0].hud.visible=false;render();`);
    assert.equal(await tv(`return document.querySelectorAll('.hud-position').length;`), 7);
    await tv(
      `state.settings.overlayInteractive=false;state.characters[0].hud.visible=true;render();`
    );
    assert.equal(
      await tv(`return document.querySelectorAll('.hud-toolstrip,.bubble-controls').length;`),
      0
    );
    assert.equal(
      await tv(`return getComputedStyle(document.querySelector('.hud-position')).pointerEvents;`),
      'none'
    );
    results.push(
      'Hidden and collapsed characters remain independent; click-through removes interaction while preserving the theme. Geometry tests retain the existing map hit-region behavior.'
    );

    gallery = new BrowserWindow({
      show: false,
      width: 1600,
      height: 2600,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    await gallery.loadFile(path.join(__dirname, '../docs/theme-preview.html'));
    await wait(() =>
      gallery.webContents.executeJavaScript(
        `document.querySelectorAll('.theme-sample').length===14`
      )
    );
    const fullGallery = async (name) => {
      // Native windows can be smaller than the gallery on this monitor; review every row.
      for (const [page, index] of [0, 6, 12].entries()) {
        await gallery.webContents.executeJavaScript(
          `window.scrollTo(0,${index === 0 ? 0 : `document.querySelectorAll('.theme-sample')[${index}].offsetTop-20`});`
        );
        await shot(gallery, name + (page ? '-' + (page + 1) : ''));
      }
    };
    await fullGallery('class-palette-gallery');
    await gallery.webContents.executeJavaScript(
      `document.getElementById('map').value='pattern';document.getElementById('opacity').value=40;renderGallery();`
    );
    await fullGallery('class-palettes-patterned');
    await gallery.webContents.executeJavaScript(
      `document.querySelectorAll('.theme-sample').forEach((el,i)=>el.hidden=i!==13);document.getElementById('theme-gallery').style.display='block';document.querySelectorAll('.theme-stage')[13].style.height='800px';document.getElementById('panel').value='detail';renderGallery();const selectedSample=gallerySamples[13];selectedSample.state.characters[0].hud.scale=1;selectedSample.state.characters[0].hud.y=65;HUD.mount(selectedSample.stage,selectedSample.state,selectedSample.stage.clientWidth,800,1,'','preview');`
    );
    await gallery.webContents.executeJavaScript('window.scrollTo(0,0);');
    await shot(gallery, 'wizard-detail-preview');
    fs.writeFileSync(
      path.join(directory, 'hud-themes-results.json'),
      JSON.stringify(
        {
          passed: true,
          results,
          contrasts,
          defaultLimitations,
          physicalViewingDistance: 'Not measured; requires the intended TV and seating distance.',
        },
        null,
        2
      )
    );
  } catch (error) {
    await shot(controller, 'theme-failure').catch(() => {});
    fs.writeFileSync(
      path.join(directory, 'hud-themes-results.json'),
      JSON.stringify({ passed: false, results, error: error.stack }, null, 2)
    );
  } finally {
    gallery?.destroy();
    setOverlay(false);
    app.quit();
  }
};
