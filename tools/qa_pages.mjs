// Real Chromium QA against a strict static server: no SPA fallback that could
// hide missing GitHub Pages files. External services/fonts are stubbed, not tested.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import chromium, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const screenshots = path.join(root, 'qa-results');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.pdf': 'application/pdf' };
let mount = '/website-template';
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://preview.test');
  if (mount && url.pathname === mount) {
    response.writeHead(301, { Location: mount + '/' + url.search }).end();
    return;
  }
  if (mount && !url.pathname.startsWith(mount + '/')) {
    response.writeHead(404).end('Outside site mount');
    return;
  }
  try {
    let file = path.resolve(root, '.' + decodeURIComponent(url.pathname.slice(mount.length)));
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error('Outside site root');
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        response.writeHead(301, { Location: url.pathname + '/' + url.search }).end();
        return;
      }
      file = path.join(file, 'index.html');
    }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// Use the package's bundled NSS libraries in minimal Linux containers as well.
if (process.platform === 'linux') {
  const libs = await inflate(fileURLToPath(new URL('../bin/al2023.tar.br', import.meta.resolve('@sparticuz/chromium'))));
  setupLambdaEnvironment(path.join(libs, 'lib'));
}
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || await chromium.executablePath(),
  args: chromium.args.filter(flag => flag !== '--single-process').map(flag =>
    flag.startsWith('--disable-features=') ? flag + ',BackForwardCache' : flag),
  headless: true
});
const page = await browser.newPage();
// Keep the visual effects from dominating CPU-only CI; use the site's supported
// accessibility preference rather than changing its DOM or hiding the loader.
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
// Speech is an OS service, not part of the static-site/path smoke test. A real
// speech backend is unavailable in CI; do not let it block the greeting animation.
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    cancel() {}, speak() {}, resume() {}, pause() {}, getVoices() { return []; },
    addEventListener() {}, removeEventListener() {}, speaking: false, pending: false, paused: false
  } });
});
let errors = [];
const checkedLinks = new Set();
let externalRequests = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.url().startsWith(origin + '/') && response.status() >= 400) {
    errors.push(`${response.status()} ${response.url()}`);
  }
});
page.on('requestfailed', request => {
  if (request.url().startsWith(origin + '/') && request.failure()?.errorText !== 'net::ERR_ABORTED') {
    errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  }
});
await page.setRequestInterception(true);
page.on('request', request => {
  if (request.url().startsWith(origin + '/') || /^(data|blob):/.test(request.url())) {
    void request.continue();
  } else {
    externalRequests++;
    void request.respond({ status: 200,
      contentType: request.resourceType() === 'stylesheet' ? 'text/css' : 'text/html',
      body: request.isNavigationRequest() ? '<h1>External destination</h1>' : '' });
  }
});

async function ready() {
  await page.bringToFront();
  await page.waitForFunction(() => {
    const heading = document.querySelector('h1');
    const loader = document.querySelector('[aria-label="Loading"]');
    const transitioning = [...document.querySelectorAll('[aria-hidden="true"]')]
      .some(element => element.style.zIndex === '8888' && element.style.pointerEvents === 'all');
    return heading && !/^(Opening|404)/i.test(heading.textContent.trim()) && !transitioning &&
      (!loader || loader.style.display === 'none');
  }, { timeout: 120000, polling: 'mutation' });
  await page.evaluate(async () => {
    await Promise.all([...document.images].map(image => {
      image.loading = 'eager';
      return image.decode().catch(() => {});
    }));
  });
  await page.waitForNetworkIdle({ idleTime: 150, timeout: 15000 });
}

async function checkRendered(label) {
  await ready();
  const metrics = await page.evaluate(() => ({
    base: window.__GH_BASE__,
    heading: document.querySelector('h1')?.textContent.trim(),
    textLength: document.body.innerText.length,
    styled: document.styleSheets.length > 0,
    width: window.innerWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    brokenImages: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
    links: [...document.querySelectorAll('a[href]')].map(link => link.href)
  }));
  assert.equal(metrics.base, mount, `${label}: router basename`);
  assert.ok(metrics.textLength > 200, `${label}: empty page`);
  assert.ok(metrics.styled, `${label}: stylesheet missing`);
  assert.ok(metrics.scrollWidth <= metrics.width + 2, `${label}: horizontal overflow ${metrics.scrollWidth}/${metrics.width}`);
  assert.deepEqual(metrics.brokenImages, [], `${label}: broken images`);
  assert.deepEqual(errors, [], `${label}: browser/network errors`);
  for (const link of metrics.links) {
    const url = new URL(link);
    if (url.origin !== origin) continue;
    assert.ok(!mount || url.pathname === mount || url.pathname.startsWith(mount + '/'), `${label}: link escapes repo: ${link}`);
    url.hash = '';
    if (checkedLinks.has(url.href)) continue;
    const response = await fetch(url, { method: 'HEAD' });
    assert.ok(response.ok, `${label}: broken link ${url} (${response.status})`);
    checkedLinks.add(url.href);
  }
  return metrics;
}

function routeFiles(directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'node_modules', 'lulamile-FINAL-FIXED', 'qa-results'].includes(entry.name)) return [];
    const name = path.join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(name) : name.endsWith('.html')
      ? ['/' + path.relative(root, name).replace(/index\.html$/, '')] : [];
  });
}

let checked = 0;
try {
  const desktop = [...new Set([...routeFiles(), '/index.html?source=qa#home',
    '/about/index.html?source=qa#skills', '/project/foodiezone-pwa/index.html', '/about',
    '/project/lula-gazette', '/project/foodiezone-pwa.html?source=qa#case'])];
  const phone = ['/', '/about/', '/contact/', '/services/', '/frontend-development/',
    '/product-design-strategy/', '/website-design-conversion/', '/microfinance-impact-consulting/',
    '/brand-strategy-and-growth/', '/project/foodiezone-pwa/', '/project/lula-gazette/', '/project/service-waze/'];
  const viewports = process.argv.includes('--navigation-only') ? [] : [[1440, desktop], [390, phone]];
  for (const [width, routes] of viewports) {
    await page.setViewport({ width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 0.5 });
    for (const route of routes) {
      errors = [];
      await page.goto(origin + mount + route, { waitUntil: 'load', timeout: 20000 });
      const external = /^\/(?:project|graphic)\/(?:kinto-one|toyota-remote|toyota-app|wandisplace-pwa|sk-finds-pwa|snb-website)(?:\/|\.html)/.test(route);
      if (external) {
        await page.waitForFunction(localOrigin => location.origin !== localOrigin, { timeout: 10000 }, origin);
        assert.deepEqual(errors, [], `${route}: redirect errors`);
      } else {
        await checkRendered(`${width}px ${route}`);
      }
      checked++;
      console.log(`OK ${width}px ${route}${external ? ' (external redirect)' : ''}`);
    }
  }

  // Genuine clicks: SPA navigation, back/forward, static case studies and reloads.
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 0.5 });
  errors = [];
  await page.goto(origin + mount + '/');
  await checkRendered('homepage before navigation');
  mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, 'homepage-desktop.png') });
  await page.click(`header a[href="${mount}/about"]`);
  await page.waitForFunction(() => location.pathname.endsWith('/about') && document.querySelector('h1')?.textContent.includes('About'));
  await checkRendered('Home → About');
  assert.ok((await page.$eval('link[rel="canonical"]', element => element.href)).endsWith('/website-template/about/'));
  await page.goBack();
  await checkRendered('Back → Home');
  await page.goForward();
  await checkRendered('Forward → About');
  await page.reload({ waitUntil: 'load' });
  await checkRendered('Reload About');
  await page.goto(origin + mount + '/');
  await ready();
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    page.click(`a[href="${mount}/project/foodiezone-pwa"]`)
  ]);
  await checkRendered('Home → standalone FoodieZone case study');
  assert.equal(await page.$('#root'), null, 'case-study link must open its real HTML document');

  // Mobile navigation must also keep its paths inside the repository.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 0.5 });
  await page.goto(origin + mount + '/');
  await ready();
  await page.screenshot({ path: path.join(screenshots, 'homepage-mobile.png') });
  const toggle = await page.$('button[aria-label="Open menu"]');
  assert.ok(toggle, 'mobile menu toggle exists');
  await toggle.click();
  await page.waitForSelector('.fixed.inset-y-0.translate-x-0', { visible: true });
  await page.click(`.fixed.inset-y-0 a[href="${mount}/about"]`);
  await page.waitForFunction(() => location.pathname.endsWith('/about'));
  await checkRendered('Mobile Home → About');

  for (const otherMount of ['', '/preview/nested']) {
    mount = otherMount;
    for (const route of ['/', '/index.html', '/about/index.html', '/project/foodiezone-pwa/', '/project/lula-gazette.html']) {
      errors = [];
      await page.goto(origin + mount + route, { waitUntil: 'load' });
      await checkRendered(`${mount || '(root)'}${route}`);
      checked++;
    }
  }
  console.log(`PASS: ${checked} route/viewport checks, desktop/mobile navigation, reloads, and ${checkedLinks.size} local link destinations.`);
  console.log(`External services/fonts were stubbed (${externalRequests} requests); no external form was submitted.`);
  console.log('Screenshots: qa-results/homepage-desktop.png and qa-results/homepage-mobile.png');
} catch (error) {
  console.error('Failed at:', page.url(), 'Browser errors:', errors);
  console.error(await page.evaluate(() => ({
    heading: document.querySelector('h1')?.textContent,
    loader: document.querySelector('[aria-label="Loading"]')?.outerHTML.slice(0, 200),
    visibility: document.visibilityState,
    elapsed: performance.now(),
    loaderDisplay: document.querySelector('[aria-label="Loading"]') && getComputedStyle(document.querySelector('[aria-label="Loading"]')).display,
    curtains: [...document.querySelectorAll('[aria-hidden="true"]')].filter(element => element.style.zIndex === '8888').map(element => element.style.cssText),
    text: document.body.innerText.slice(0, 1200)
  })).catch(() => 'Page unavailable'));
  throw error;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
