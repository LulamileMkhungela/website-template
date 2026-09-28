// Static-path and base-path regression tests. No build step or server needed.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const root = fileURLToPath(new URL('../', import.meta.url));
const published = 'https://lulamilemkhungela.github.io/website-template/';
const adapter = readFileSync(path.join(root, 'lulamile/base-path-fix.js'), 'utf8');

export function htmlFiles(directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'node_modules', 'lulamile-FINAL-FIXED', 'qa-results'].includes(entry.name)) return [];
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(name) : name.endsWith('.html') ? [name] : [];
  });
}

function existsAt(url, base, label) {
  assert.ok(url.pathname.startsWith(base.pathname), `${label}: URL escapes the site: ${url}`);
  const relative = decodeURIComponent(url.pathname.slice(base.pathname.length));
  const file = path.join(root, relative);
  assert.ok(existsSync(file), `${label}: missing ${relative}`);
  if (statSync(file).isDirectory()) {
    assert.ok(existsSync(path.join(file, 'index.html')), `${label}: no index.html in ${relative}`);
  }
}

test('GitHub Pages has a real homepage and bypasses Jekyll', () => {
  assert.ok(existsSync(path.join(root, '.nojekyll')));
  const { window } = new JSDOM(readFileSync(path.join(root, 'index.html'), 'utf8'));
  assert.ok(window.document.querySelector('#root'));
  assert.ok(window.document.querySelector('script[type="module"][src]'));
  assert.ok(window.document.querySelector('link[rel="stylesheet"][href*="assets/"]'));
  window.close();
});

test('every published HTML asset, internal link and metadata URL resolves', () => {
  let checked = 0;
  for (const file of htmlFiles()) {
    const relative = path.relative(root, file);
    const html = readFileSync(file, 'utf8');
    assert.ok(!html.includes('portfolio.github.io'), `${relative}: stale repository URL`);
    for (const mount of ['/', '/website-template/', '/preview/nested/']) {
      const base = new URL(mount, 'https://preview.test');
      const { window } = new JSDOM(html, { url: new URL(relative, base).href });
      const document = window.document;
      const refs = [...document.querySelectorAll('[src], [href], [action], [poster]')]
        .flatMap(el => ['src', 'href', 'action', 'poster'].filter(attr => el.hasAttribute(attr))
          .map(attr => el.getAttribute(attr)));
      document.querySelectorAll('meta[http-equiv="refresh" i]').forEach(meta => {
        const target = meta.content.match(/url\s*=\s*(.+)/i)?.[1];
        if (target) refs.push(target);
      });
      document.querySelectorAll('meta[property="og:url"], meta[property="og:image"], meta[name="twitter:image"]')
        .forEach(meta => refs.push(meta.content));
      for (const ref of refs) {
        const url = new URL(ref, document.URL);
        if (url.origin === base.origin) existsAt(url, base, relative);
        else if (url.href.startsWith(published)) existsAt(url, new URL(published), relative);
        checked++;
      }
      const scripts = [...document.scripts].filter(script => script.src);
      const app = scripts.findIndex(script => script.type === 'module');
      if (app !== -1) {
        assert.ok(scripts[0].src.includes('/lulamile/base-path-fix.js'), `${relative}: base must load before React`);
        assert.ok(app > 0);
      }
      window.close();
    }
  }
  console.log(`Checked ${htmlFiles().length} HTML files and ${checked} URLs at three mount paths.`);
});

test('images referenced in the compiled application exist', () => {
  const bundle = readFileSync(path.join(root, 'assets/index-DL0drac2.js'), 'utf8');
  const images = new Set([...bundle.matchAll(/["'](\/(?:projects|lulamile|uploads|certificates)\/[^"']+)["']/g)]
    .map(match => match[1]));
  assert.ok(images.size > 20);
  for (const image of images) {
    assert.ok(existsSync(path.join(root, image)), `Missing bundle image: ${image}`);
  }
});

for (const [mount, route, clean] of [
  ['', '/', '/'],
  ['', '/index.html?ref=test#home', '/?ref=test#home'],
  ['', '/about/', '/about/'],
  ['/website-template', '/', '/'],
  ['/website-template', '/index.html?q=test#work', '/?q=test#work'],
  ['/website-template', '/about/index.html?tab=bio#skills', '/about/?tab=bio#skills'],
  ['/website-template', '/project/foodiezone-pwa.html?ref=test#case', '/project/foodiezone-pwa?ref=test#case'],
  ['/preview/nested', '/project/foodiezone-pwa/', '/project/foodiezone-pwa/'],
  ['/preview/nested', '/unknown-route/', '/unknown-route/'],
]) {
  test(`base detection and URL rewriting: ${mount || '(root)'}${route}`, async () => {
    const { window } = new JSDOM('<!doctype html><head></head><body></body>', {
      url: `https://preview.test${mount}${route}`, runScripts: 'outside-only'
    });
    try {
      const script = window.document.createElement('script');
      script.src = `${mount}/lulamile/base-path-fix.js?v=2`;
      Object.defineProperty(window.document, 'currentScript', { value: script });
      window.eval(adapter);
      assert.equal(window.__GH_BASE__, mount);
      assert.equal(window.location.pathname + window.location.search + window.location.hash, mount + clean);
      for (const [input, output] of [
        ['/', `${mount}/`],
        ['/about?tab=bio#skills', `${mount}/about?tab=bio#skills`],
        ['/uploads/wireframe.png', `${mount}/uploads/wireframe.png`],
        ['/certificates/UX%20Design.pdf', `${mount}/certificates/UX%20Design.pdf`],
        [`${mount}/projects/cover.png`, `${mount}/projects/cover.png`],
        [`${mount}/?q=test`, `${mount}/?q=test`],
        ['https://example.com/projects/image.png', 'https://example.com/projects/image.png'],
        ['//cdn.example.com/image.png', '//cdn.example.com/image.png'],
        ['mailto:hello@example.com', 'mailto:hello@example.com'],
        ['tel:+27837195064', 'tel:+27837195064'],
        ['#section', '#section'],
        ['?tab=email', '?tab=email'],
        ['../assets/site.css', '../assets/site.css'],
        ['data:image/png;base64,AAAA', 'data:image/png;base64,AAAA'],
      ]) {
        for (const attr of ['href', 'src', 'action', 'poster']) {
          const element = window.document.createElement('div');
          element.setAttribute(attr, input);
          assert.equal(element.getAttribute(attr), output, `${attr}: ${input}`);
          element.setAttribute(attr, output);
          assert.equal(element.getAttribute(attr), output, 'rewriting must be idempotent');
        }
      }
      window.document.body.innerHTML = '<a href="/contact">Contact</a><img src="/lulamile/meew.jpeg">';
      await new Promise(resolve => window.setTimeout(resolve, 0));
      assert.equal(window.document.querySelector('a').getAttribute('href'), `${mount}/contact`);
      assert.equal(window.document.querySelector('img').getAttribute('src'), `${mount}/lulamile/meew.jpeg`);
    } finally {
      window.close();
    }
  });
}
