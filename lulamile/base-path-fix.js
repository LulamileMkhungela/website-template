// The site is published at /website-template/ on GitHub Pages, but also works
// at / on a local server or under another directory. Load this classic script
// with a page-relative URL BEFORE the application bundle on every HTML page.
(function () {
  'use strict';

  // Derive the mount point from this file, NOT the first URL segment. Guessing
  // from location.pathname mistakes /index.html and unknown routes for a repo.
  var script = document.currentScript;
  var siteRoot = new URL('../', script.src);
  var base = siteRoot.pathname.replace(/\/$/, '');
  window.__GH_BASE__ = base;

  // React Router needs clean route IDs for the existing .html aliases. Removing
  // a filename this way keeps its directory unchanged, so relative CSS, JS and
  // image paths still resolve correctly. Preserve query strings and fragments.
  var path = window.location.pathname;
  var clean = path.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
  if (clean !== path) {
    window.history.replaceState(window.history.state, '',
      clean + window.location.search + window.location.hash);
  }

  function siteUrl(value) {
    if (!base || typeof value !== 'string' || value.charAt(0) !== '/' ||
        value.charAt(1) === '/') return value;
    // Do not prefix an already scoped URL, including ?query and #fragment forms.
    if (value === base || value.indexOf(base + '/') === 0 ||
        value.indexOf(base + '?') === 0 || value.indexOf(base + '#') === 0) return value;
    return base + value;
  }

  // The repository contains a prebuilt React bundle, not its original sources.
  // Its router/images already use __GH_BASE__; this adapter also handles plain
  // root-relative anchors and user edits before they make a network request.
  var setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    if (/^(href|src|action|poster)$/i.test(name)) value = siteUrl(value);
    return setAttribute.call(this, name, value);
  };

  function fixElement(element) {
    ['href', 'src', 'action', 'poster'].forEach(function (attr) {
      var value = element.getAttribute(attr);
      var fixed = siteUrl(value);
      if (value !== fixed) setAttribute.call(element, attr, fixed);
    });
  }

  function fixTree(node) {
    if (node.nodeType !== 1) return;
    fixElement(node);
    node.querySelectorAll('[href],[src],[action],[poster]').forEach(fixElement);
  }

  // Cover parser-created markup once it is available. Initial HTML asset URLs
  // are page-relative; do not rely on a late rewrite to load the app. Runtime
  // React elements use setAttribute above, and patch.js scopes its own markup.
  if (base) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        fixTree(document.documentElement);
      });
    } else {
      fixTree(document.documentElement);
    }
  }

  // These are standalone HTML case studies, not pages in the React bundle.
  // Let their links perform a real navigation instead of React swallowing the
  // click and rendering an older page (or redirecting back to the homepage).
  function isStaticRoute(route) {
    return route === '/brand-strategy-and-growth' ||
      /^\/(project|graphic)\/[^/]+$/.test(route);
  }
  document.addEventListener('click', function (event) {
    var anchor = event.target.closest && event.target.closest('a[href]');
    if (!anchor || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        anchor.hasAttribute('download') ||
        (anchor.target && anchor.target !== '_self')) return;
    var url = new URL(anchor.href);
    if (url.origin !== window.location.origin ||
        (base && url.pathname.indexOf(base + '/') !== 0)) return;
    var route = url.pathname.slice(base.length)
      .replace(/\/index\.html$/i, '').replace(/\.html$/i, '').replace(/\/$/, '');
    if (isStaticRoute(route)) {
      anchor.setAttribute('href', base + route + '/' + url.search + url.hash);
      event.stopPropagation();
    }
  }, true);
})();
