# LulaMile-HalfMachine — portfolio site

Static site. No build step, no framework install, no database. Every page is a plain
HTML file, and all wording, images and links can be changed without touching code.

---

## 1. Preview it locally

```bash
cd lulamile-FINAL-FIXED
python3 serve.py            # http://localhost:8000
```

`serve.py` is only a small static server with a route fallback so that URLs like
`/about` and `/project/foodiezone-pwa` open correctly while you review. It is not
needed for hosting.

After editing, hard-refresh the browser: **Ctrl + Shift + R** (Windows/Linux) or
**Cmd + Shift + R** (macOS).

---

## 2. Editing content

There are two ways in, depending on what you want to change.

### A. Wording, links and images — `lulamile/edits.js`

This is the everyday edit surface. It is one plain JavaScript file, no Python:

```js
window.LM_EDITS = {
  settings: { name, role, location, email, phone, linkedin, calendly, resume,
              copyProtection, copyMessage },
  text:   [ { find: 'the wording on the site', replace: 'your wording' } ],
  images: [ { find: '/projects/lulamile/old-cover.png', replace: '/projects/lulamile/new-cover.png' } ],
  links:  [ { find: 'https://calendly.com/lulamile_m/meet-lulamile', replace: 'https://calendly.com/new' } ]
};
```

* `text` — copy a phrase exactly as it reads on the site into `find`, put the new
  wording in `replace`. Add as many entries as you like.
* `images` — drop your new file into `projects/lulamile/` and point the old path at it.
* `links` — same idea for any URL on the site.
* `settings` — your identity and contact details in one place. Setting
  `copyProtection: false` switches off the no-copy behaviour described in section 4.

`lulamile/patch.js` reads this file and applies your changes on every page load
(it also keeps contact links, the portrait, client marks and internal links correct).
Nothing else needs rebuilding.

### B. Page structure — the HTML files

Each route is a real HTML file: `about/index.html` (and its `about.html` twin),
`project/<name>/index.html`, and so on. Titles, meta descriptions, Open Graph tags,
the JSON-LD identity block and the font links all live there and can be edited
directly. Keep the `.html` file and the `folder/index.html` twin in step — some hosts
serve one, some the other.

### C. Long-form case-study copy

Case-study detail text lives in the application bundle
`assets/index-DL0drac2.js`, which is one long line of compiled code. Two safe options:

1. Use a `text` rule in `edits.js` to replace the exact sentence (recommended).
2. Back the file up first, then search and replace the exact string in the bundle.
   Keep the quotes and commas around the string intact.

---

## 3. What is in the folder

| Path | What it is |
| --- | --- |
| `index.html`, `about/`, `contact/`, `services/`, `product-design-strategy/`, `brand-strategy-and-growth/`, `microfinance-impact-consulting/`, `frontend-development/`, `website-design-conversion/` | Main pages |
| `project/<name>/` | Case studies. Live products (`kinto-one`, `toyota-remote`, `toyota-app`, `wandisplace-pwa`, `sk-finds-pwa`) are redirect pages that open the real product instead of a write-up |
| `graphic/<name>/` | Same redirects, kept so older links keep working |
| `assets/` | Compiled application + stylesheet |
| `projects/lulamile/` | All case-study imagery, brand marks and the portrait |
| `lulamile/edits.js` | Your content edits (section 2A) |
| `lulamile/patch.js` | Behaviour layer: applies your edits, copy protection, link fixes |
| `sitemap.xml`, `robots.txt` | Search-engine files |
| `serve.py` | Local preview server only |

---

## 4. Copy protection

`patch.js` stops visitors from selecting or copying the site's wording: text selection,
right-click, copy/cut, `Ctrl/Cmd + C`, `Ctrl/Cmd + X`, `Ctrl/Cmd + A` and image
dragging are all blocked, and a short message appears instead. Form fields (name,
email, message) stay fully usable.

Turn it off with `copyProtection: false` in `edits.js`, and change the message with
`copyMessage`. This deters casual copying; it cannot stop someone who views the page
source, which is true of every website.

---

## 5. Publishing

Upload the contents of this folder as-is to any static host (GitHub Pages, Netlify,
Vercel, cPanel) — no server language required. Page URLs are root-absolute
(`/assets/…`, `/lulamile/…`), so publish it at the root of the domain or subdomain.

---

## 6. Verified

Checked in a real headless browser (Chromium) at 1440, 1280, 768 and 390 px wide across
every page: no console errors, no failed requests, no sideways scrolling, no broken
images, and the mobile menu works. See the repo's `tools/qa_browser.mjs` to re-run the
same check.
