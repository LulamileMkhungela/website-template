// GitHub Pages project vs user site base-path fix
// Handles both https://username.github.io/ (user site, repo = username.github.io)
// and https://username.github.io/repo/ (project site, e.g. /new/)
// Site uses root-absolute URLs like /assets/, /lulamile/, /favicon.webp
// This script rewrites them to include the repo base when needed.
(function () {
  try {
    var loc = window.location;
    var host = loc.hostname;
    var pathname = loc.pathname;

    // Detect repo base from pathname
    // Known site sections that should NOT be treated as repo name
    var siteSections = {
      'about': 1, 'contact': 1, 'services': 1,
      'product-design-strategy': 1, 'brand-strategy-and-growth': 1,
      'microfinance-impact-consulting': 1, 'frontend-development': 1,
      'website-design-conversion': 1, 'project': 1, 'graphic': 1,
      'assets': 1, 'lulamile': 1, 'projects': 1, 'lulamile-FINAL-FIXED': 1
    };

    var segments = pathname.split('/').filter(Boolean);
    var repoBase = '';
    var first = segments[0] || '';

    // If first segment is not a known site section and not empty, it's likely the repo name (project pages)
    // e.g. /new/ -> first = "new" -> repoBase = "/new"
    // e.g. /new/about/ -> first = "new" -> repoBase = "/new"
    // For user site lulamilemkhungela.github.io, pathname starts with about, etc -> no base
    if (first && !siteSections[first]) {
      repoBase = '/' + first;
    }

    // Also allow override via meta tag <meta name="gh-repo" content="new">
    try {
      var meta = document.querySelector('meta[name="gh-repo"]');
      if (meta && meta.content) {
        repoBase = '/' + meta.content.replace(/^\/|\/$/g, '');
      }
    } catch (e) {}

    // If we are on custom domain or user site, repoBase stays empty -> root "/"
    if (!repoBase) {
      window.__GH_BASE__ = '';
      return;
    }

    window.__GH_BASE__ = repoBase;
    // console.log('[base-fix] repoBase =', repoBase);

    // Helper to prefix if needed
    function needsPrefix(url) {
      if (!url) return false;
      if (url.indexOf('//') === 0) return false; // protocol-relative
      if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) return false;
      if (url.indexOf('data:') === 0 || url.indexOf('mailto:') === 0 || url.indexOf('tel:') === 0) return false;
      if (url.charAt(0) !== '/') return false; // only absolute
      if (url.indexOf(repoBase + '/') === 0) return false; // already prefixed
      if (url === repoBase) return false;
      // Only fix site-internal paths
      var internalPrefixes = ['/assets/', '/lulamile/', '/projects/', '/project/', '/graphic/', '/about', '/contact', '/services', '/product-design', '/brand-strategy', '/microfinance', '/frontend-development', '/website-design', '/favicon'];
      for (var i = 0; i < internalPrefixes.length; i++) {
        if (url.indexOf(internalPrefixes[i]) === 0) return true;
      }
      // Also root "/" should be prefixed to repo base
      if (url === '/' || url === '/index.html') return true;
      return false;
    }

    function prefixUrl(url) {
      if (!needsPrefix(url)) return url;
      if (url === '/') return repoBase + '/';
      return repoBase + url;
    }

    // Patch setAttribute to auto-prefix future elements
    var origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if ((name === 'href' || name === 'src' || name === 'action') && typeof value === 'string') {
        if (needsPrefix(value)) {
          value = prefixUrl(value);
        }
      }
      return origSetAttr.call(this, name, value);
    };

    // Fix existing elements in DOM (runs early, but also on DOMContentLoaded)
    function fixExisting() {
      var selectors = [
        ['link[href^="/"]', 'href'],
        ['script[src^="/"]', 'src'],
        ['img[src^="/"]', 'src'],
        ['a[href^="/"]', 'href'],
        ['source[src^="/"]', 'src'],
        ['video[src^="/"]', 'src'],
        ['form[action^="/"]', 'action']
      ];
      selectors.forEach(function (pair) {
        var sel = pair[0], attr = pair[1];
        document.querySelectorAll(sel).forEach(function (el) {
          var v = el.getAttribute(attr);
          if (v && needsPrefix(v)) {
            el.setAttribute(attr, prefixUrl(v));
          }
        });
      });
      // Fix inline style url(/...)
      // Fix canonical, og:url, etc if needed? Leave canonical as is for SEO
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fixExisting);
    } else {
      fixExisting();
    }
    // Also run again after a short delay for dynamically injected content
    setTimeout(fixExisting, 500);
    setTimeout(fixExisting, 1500);

  } catch (e) {
    console.warn('[base-fix] error', e);
  }
})();
