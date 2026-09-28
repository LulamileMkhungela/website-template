// LulaMile-HalfMachine — site behaviour layer.
// Contact details, brand marks, link handling, Lexark coming soon status,
// live app redirects, case study links, midnight mode, back to top, greeting voice, and copy protection.
// Editable content lives in lulamile/edits.js.
(function () {
  var CONFIG = {
    newName: 'LulaMile-HalfMachine',
    newEmail: 'mkhungela.l@gmail.com',
    newPhone: '+27 83 719 5064',
    newPhoneRaw: '+27837195064',
    newCalendly: 'https://calendly.com/lulamile_m/meet-lulamile',
    newResume: 'https://drive.google.com/file/d/1iNgauKhYevO53_D5daPcT5cM5wkpuYkP/view?usp=drive_link',
    newLinkedIn: 'https://www.linkedin.com/in/lulamile-mkhungela/'
  };

  var EDITS = window.LM_EDITS || {};
  var SET = EDITS.settings || {};
  if (SET.name) CONFIG.newName = SET.name;
  if (SET.email) CONFIG.newEmail = SET.email;
  if (SET.phone) CONFIG.newPhone = SET.phone;
  if (SET.phoneRaw) CONFIG.newPhoneRaw = SET.phoneRaw;
  if (SET.calendly) CONFIG.newCalendly = SET.calendly;
  if (SET.resume) CONFIG.newResume = SET.resume;
  if (SET.linkedin) CONFIG.newLinkedIn = SET.linkedin;
  CONFIG.location = SET.location || 'Johannesburg, Anywhere Remote';

  var basePath = './lulamile/';
  try {
    var scripts = document.querySelectorAll('script[src*="patch.js"]');
    var thisScript = scripts[scripts.length - 1];
    if (thisScript && thisScript.getAttribute('src')) {
      basePath = thisScript.getAttribute('src').split('?')[0].replace('patch.js', '');
    }
  } catch (e) {}

  var newBrands = ['dpsa.png', 'nerdma.png', 'addmore.png', 'toyota.png', 'voda.png', 'intelle.png',
                   'sasol.png', 'novelmed.png', 'uluntu.png', 'ioco.png', 'takeda.png', 'shaper.png'];
  var profilePic = basePath + 'meew.jpeg';

  var GH_BASE = '';
  try { GH_BASE = window.__GH_BASE__ || ''; } catch (e) {}
  function stripBase(href) {
    if (GH_BASE && href === GH_BASE) return '/';
    if (GH_BASE && href.indexOf(GH_BASE + '/') === 0) return href.slice(GH_BASE.length);
    return href;
  }

  // Live apps that are DIRECT REDIRECTS (no case study details)
  var DIRECT_REDIRECT_APPS = {
    'kinto-one': 'https://www.toyota.co.za/kinto-personal',
    'toyota-remote': 'https://play.google.com/store/apps/details?id=za.co.toyota.toyotaremote&hl=en_ZA&pli=1',
    'toyota-app': 'https://play.google.com/store/apps/details?id=com.eliance.toyotamobile&hl=en_ZA',
    'wandisplace-pwa': 'https://wandies.vercel.app/',
    'sk-finds-pwa': 'https://skautos.vercel.app/'
  };

  // Projects that HAVE Case Studies and also have a live site or GitHub URL
  // NOTE: 'foodiezone-pwa' is deliberately omitted from top hero injection
  // so the first link on foodiezone is removed, keeping only the conclusion link!
  var LIVE_STUDY_URLS = {
    'africa-cuisine-pwa': { url: 'https://africa-cuisine-pro.vercel.app', label: 'Open live PWA' },
    'nerdma-website': { url: 'https://www.nerdma.co.za', label: 'Visit live website' },
    'addmoredigital-website': { url: 'https://addmoredigital.co.za/', label: 'Visit live website' },
    'snb-website': { url: 'https://www.snbconsultancy.co.za', label: 'Visit live website' },
    'designops-design-system': { url: 'https://github.com/LulamileMkhungela/design-ops', label: 'Open on GitHub' },
    'lula-trustshield': { url: 'https://github.com/LulamileMkhungela/LulaUnifidMarket', label: 'Open on GitHub' }
  };

  // Ensure sliding logos are in their retrospective authentic brand colors
  function ensureLogosColors() {
    if (!document.getElementById('lm-logo-color-style')) {
      var s = document.createElement('style');
      s.id = 'lm-logo-color-style';
      s.textContent =
        '.lm-marquee-pill, [class*="animate-marquee"] .lm-marquee-pill {' +
        '  background-color: #ffffff !important;' +
        '  border: 1px solid rgba(0, 0, 0, 0.08) !important;' +
        '  border-radius: 12px !important;' +
        '  box-shadow: 0 1px 4px rgba(0,0,0,0.04) !important;' +
        '}\n' +
        '.animate-marquee-left img, .animate-marquee-right img, [class*="animate-marquee"] img, .lm-marquee-pill img {' +
        '  filter: none !important;' +
        '  opacity: 1 !important;' +
        '  -webkit-filter: none !important;' +
        '}';
      document.head.appendChild(s);
    }
    document.querySelectorAll('.animate-marquee-left img, .animate-marquee-right img, [class*="animate-marquee"] img, .lm-marquee-pill img').forEach(function (img) {
      img.style.filter = 'none';
      img.style.opacity = '1';
      img.style.webkitFilter = 'none';
    });
  }

  // Open internal case studies in place, never in a new tab
  // BUT leave external direct-redirect apps with target="_blank"
  function fixInternalLinks() {
    document.querySelectorAll('a[target="_blank"]').forEach(function (a) {
      var href = stripBase(a.getAttribute('href') || '');
      for (var id in DIRECT_REDIRECT_APPS) {
        if (href.indexOf(id) > -1) return;
      }
      if (href.indexOf('/project/') === 0 ||
          href.indexOf('/product-design') === 0 || href.indexOf('/website-design') === 0 ||
          href.indexOf('/microfinance') === 0 || href.indexOf('/brand-strategy') === 0 ||
          href.indexOf('/frontend-development') === 0 ||
          href.indexOf('/services') === 0 || href.indexOf('/about') === 0 || href.indexOf('/contact') === 0) {
        a.removeAttribute('target');
        a.removeAttribute('rel');
        a.style.cursor = 'pointer';
      }
    });
  }

  // Ensure direct-redirect cards go directly to their destination URLs
  function flagRedirectCards() {
    document.querySelectorAll('a[href]').forEach(function (card) {
      var href = card.getAttribute('href') || '';
      for (var id in DIRECT_REDIRECT_APPS) {
        if (href.indexOf('/project/' + id) > -1 || href.indexOf('/graphic/' + id) > -1 || href === id) {
          card.setAttribute('href', DIRECT_REDIRECT_APPS[id]);
          card.setAttribute('target', '_blank');
          card.setAttribute('rel', 'noopener noreferrer');
          card.style.cursor = 'pointer';
        }
      }
    });
  }

  // Lexark: say "Coming soon", disable product link, BUT keep case study details page!
  function flagLexark() {
    document.querySelectorAll('h3, h2, div, span, a').forEach(function (el) {
      var txt = (el.textContent || '');
      if (txt.indexOf('Lexark') === -1) return;
      var card = el.closest('a[href*="lexark"]') || el.closest('a[href*="/project/"]') || el.closest('div[class*="rounded-3xl"]');
      if (!card || !card.querySelector || !card.querySelector('img')) return;

      // Add "Coming soon" badge if not present
      if (!card.querySelector('.lm-available-badge')) {
        var badge = document.createElement('span');
        badge.className = 'lm-available-badge';
        badge.textContent = 'Coming soon';
        badge.style.cssText = 'position:absolute;top:20px;right:20px;z-index:20;background:hsl(var(--hero-accent));' +
          'color:hsl(var(--background));font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;' +
          'padding:7px 12px;border-radius:999px;box-shadow:0 4px 12px rgba(0,0,0,0.25);';
        if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
        card.appendChild(badge);
      }

      // Update CTA text to clarify case study is available while product is coming soon
      card.querySelectorAll('span').forEach(function (sub) {
        var st = (sub.textContent || '').trim();
        if (st === 'View case study' || st === 'Coming soon') {
          sub.textContent = 'Coming soon · Case study';
        }
      });
    });

    // On the Lexark case study page: show a prominent "Product Status: Coming Soon" notice
    if (window.location.pathname.indexOf('lexark') > -1) {
      var heading = document.querySelector('h1');
      if (heading && !document.getElementById('lm-lexark-status')) {
        var banner = document.createElement('div');
        banner.id = 'lm-lexark-status';
        banner.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-bottom:16px;padding:6px 14px;border-radius:999px;background:hsl(var(--hero-accent)/0.15);color:hsl(var(--hero-accent));font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;';
        banner.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block;"></span> Product In Development — Case Study Preview';
        heading.parentElement.insertBefore(banner, heading);
      }
    }
  }

  // Remove "What people say" and recommendations
  function removeTestimonials() {
    document.querySelectorAll('section').forEach(function (sec) {
      var txt = sec.textContent || '';
      if (txt.indexOf('What people say') > -1 && (txt.indexOf('Quiet confidence') > -1 || txt.indexOf('recommendations from') > -1 || txt.indexOf('Auto-advances') > -1)) {
        sec.style.display = 'none';
        sec.setAttribute('data-lm-hidden', '1');
      }
    });
  }

  // Ensure Back button safely navigates without 404 or blank screen
  function fixBackButton() {
    document.querySelectorAll('button, a').forEach(function (btn) {
      var txt = (btn.textContent || '').trim();
      if (txt === 'Back' || txt === '← Back') {
        btn.onclick = function (e) {
          e.preventDefault();
          if (window.history && window.history.length > 1 && document.referrer && document.referrer.indexOf(window.location.host) !== -1) {
            window.history.back();
          } else {
            window.location.href = (GH_BASE || '') + '/';
          }
        };
      }
    });
  }

  // Ensure favicon is always Lulamile's picture
  function ensureFavicon() {
    var favUrl = (GH_BASE || '') + '/favicon.webp?v=2';
    document.querySelectorAll('link[rel*="icon"]').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('favicon') > -1 && href !== favUrl) {
        link.setAttribute('href', favUrl);
        link.setAttribute('type', 'image/webp');
      }
    });
  }

  // Case study header live links for live apps and websites
  function enhanceCaseStudyLiveLinks() {
    var path = window.location.pathname;

    // Make sure FoodieZone has NO top hero live button
    if (path.indexOf('foodiezone') > -1) {
      var fzTop = document.getElementById('lm-live-btn-foodiezone-pwa');
      if (fzTop) { fzTop.style.display = 'none'; fzTop.setAttribute('data-lm-hidden', '1'); }
      // Remove any top hero link pointing to foodiezone live site
      var hero = document.querySelector('main section:first-of-type, main section:nth-of-type(2)');
      if (hero) {
        hero.querySelectorAll('a[href*="foodiezone"]').forEach(function (a) {
          if (a.textContent.indexOf('live') > -1 || a.textContent.indexOf('Open') > -1) {
            a.style.display = 'none';
            a.setAttribute('data-lm-hidden', '1');
          }
        });
      }
      return;
    }

    for (var id in LIVE_STUDY_URLS) {
      if (path.indexOf(id) > -1) {
        var info = LIVE_STUDY_URLS[id];
        var heading = document.querySelector('h1');
        if (heading && !document.getElementById('lm-live-btn-' + id)) {
          var container = heading.parentElement;
          if (container && !container.querySelector('.lm-live-app-btn')) {
            var row = document.createElement('div');
            row.id = 'lm-live-btn-' + id;
            row.className = 'lm-live-app-btn';
            row.style.cssText = 'margin-top:24px;display:flex;flex-wrap:wrap;align-items:center;gap:16px;';
            row.innerHTML = '<a href="' + info.url + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:999px;background:hsl(var(--primary));color:hsl(var(--primary-foreground));font-size:14px;font-weight:600;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,0.15);">' +
              info.label + ' <span style="font-size:16px">↗</span></a>' +
              '<a href="' + info.url + '" target="_blank" rel="noopener noreferrer" style="font-family:monospace;font-size:12px;color:hsl(var(--muted-foreground));text-decoration:underline;">' +
              info.url.replace(/^https?:\/\//, '').replace(/\/$/, '') + '</a>';
            container.appendChild(row);
          }
        }
      }
    }
  }

  // Render comprehensive Industries on Services page
  function renderServicesIndustries() {
    var p = window.location.pathname;
    if (p.indexOf('services') === -1) return;
    if (document.getElementById('lm-services-industries')) return;

    var faq = document.getElementById('services-faq') || document.querySelector('section[id*="faq"]') || document.querySelector('footer');
    if (!faq) return;

    var sec = document.createElement('section');
    sec.id = 'lm-services-industries';
    sec.className = 'py-20 lg:py-28 border-t border-border scroll-mt-20';
    sec.innerHTML =
      '<div class="container mx-auto px-6 lg:px-20 max-w-6xl">' +
        '<div class="mb-12 lg:mb-16">' +
          '<p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color:hsl(var(--hero-accent));">Sector Experience</p>' +
          '<h2 class="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight max-w-2xl">' +
            'Industries with direct delivery experience.' +
          '</h2>' +
          '<p class="text-muted-foreground text-base lg:text-lg mt-4 max-w-2xl leading-relaxed">' +
            'Working digital products, brand platforms, and operational systems shipped across South Africa.' +
          '</p>' +
        '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">' +
          '<div class="p-6 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">' +
            '<div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl" style="background:hsl(var(--hero-accent)/0.12);color:hsl(var(--hero-accent));">🚗</div>' +
            '<h3 class="font-display text-xl font-semibold mb-2">Automotive & Mobility</h3>' +
            '<p class="text-sm text-muted-foreground leading-relaxed mb-3">Subscription portals, connected car companion apps, and verified vehicle discovery.</p>' +
            '<div class="text-xs font-mono font-medium opacity-80" style="color:hsl(var(--hero-accent));">Toyota · KINTO One · SkFinds · AutoMark</div>' +
          '</div>' +
          '<div class="p-6 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">' +
            '<div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl" style="background:hsl(var(--hero-accent)/0.12);color:hsl(var(--hero-accent));">📶</div>' +
            '<h3 class="font-display text-xl font-semibold mb-2">Telecoms & Enterprise IT</h3>' +
            '<p class="text-sm text-muted-foreground leading-relaxed mb-3">Employee engagement platforms, internal search architectures, and enterprise tooling.</p>' +
            '<div class="text-xs font-mono font-medium opacity-80" style="color:hsl(var(--hero-accent));">Vodacom HRIT · iOCO · DPSA</div>' +
          '</div>' +
          '<div class="p-6 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">' +
            '<div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl" style="background:hsl(var(--hero-accent)/0.12);color:hsl(var(--hero-accent));">🍔</div>' +
            '<h3 class="font-display text-xl font-semibold mb-2">Food, Hospitality & QSR</h3>' +
            '<p class="text-sm text-muted-foreground leading-relaxed mb-3">Low-data mobile ordering PWAs, digital menus, kitchen operational flows, and culinary landmarks.</p>' +
            '<div class="text-xs font-mono font-medium opacity-80" style="color:hsl(var(--hero-accent));">FoodieZone Soweto · Wandie\'s Place · Africa Cuisine</div>' +
          '</div>' +
          '<div class="p-6 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">' +
            '<div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl" style="background:hsl(var(--hero-accent)/0.12);color:hsl(var(--hero-accent));">⚖️</div>' +
            '<h3 class="font-display text-xl font-semibold mb-2">Legal Tech & Search</h3>' +
            '<p class="text-sm text-muted-foreground leading-relaxed mb-3">Case law indexing, precedent discovery, and intelligent legal research interfaces.</p>' +
            '<div class="text-xs font-mono font-medium opacity-80" style="color:hsl(var(--hero-accent));">Lexark Legal Search</div>' +
          '</div>' +
          '<div class="p-6 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">' +
            '<div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl" style="background:hsl(var(--hero-accent)/0.12);color:hsl(var(--hero-accent));">🩺</div>' +
            '<h3 class="font-display text-xl font-semibold mb-2">Healthcare & Pharma</h3>' +
            '<p class="text-sm text-muted-foreground leading-relaxed mb-3">Digital health workflows, patient education tools, and medical communications.</p>' +
            '<div class="text-xs font-mono font-medium opacity-80" style="color:hsl(var(--hero-accent));">Takeda · Novelmed</div>' +
          '</div>' +
          '<div class="p-6 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">' +
            '<div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl" style="background:hsl(var(--hero-accent)/0.12);color:hsl(var(--hero-accent));">⚡</div>' +
            '<h3 class="font-display text-xl font-semibold mb-2">Energy & Industrial</h3>' +
            '<p class="text-sm text-muted-foreground leading-relaxed mb-3">Corporate systems, operational dashboards, and industrial brand touchpoints.</p>' +
            '<div class="text-xs font-mono font-medium opacity-80" style="color:hsl(var(--hero-accent));">Sasol</div>' +
          '</div>' +
          '<div class="p-6 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">' +
            '<div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl" style="background:hsl(var(--hero-accent)/0.12);color:hsl(var(--hero-accent));">🏛️</div>' +
            '<h3 class="font-display text-xl font-semibold mb-2">Civic Tech & Public Sector</h3>' +
            '<p class="text-sm text-muted-foreground leading-relaxed mb-3">Public governance portals, community platforms, and citizen-facing services.</p>' +
            '<div class="text-xs font-mono font-medium opacity-80" style="color:hsl(var(--hero-accent));">DPSA · Uluntu</div>' +
          '</div>' +
          '<div class="p-6 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">' +
            '<div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl" style="background:hsl(var(--hero-accent)/0.12);color:hsl(var(--hero-accent));">💼</div>' +
            '<h3 class="font-display text-xl font-semibold mb-2">Professional Services & B2B</h3>' +
            '<p class="text-sm text-muted-foreground leading-relaxed mb-3">High-converting agency and consulting sites, proposal workflows, and CRM pipeline automation.</p>' +
            '<div class="text-xs font-mono font-medium opacity-80" style="color:hsl(var(--hero-accent));">SnB Consultancy · Nerdma · AddmoreDigital</div>' +
          '</div>' +
          '<div class="p-6 rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">' +
            '<div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl" style="background:hsl(var(--hero-accent)/0.12);color:hsl(var(--hero-accent));">🛡️</div>' +
            '<h3 class="font-display text-xl font-semibold mb-2">Asset Verification & Escrow</h3>' +
            '<p class="text-sm text-muted-foreground leading-relaxed mb-3">Escrow locks, proof-of-funds verification, and fraud prevention for high-value peer transactions.</p>' +
            '<div class="text-xs font-mono font-medium opacity-80" style="color:hsl(var(--hero-accent));">Lula TrustShield (LulaUnifidMarket)</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    faq.parentElement.insertBefore(sec, faq);
  }

  // Back to Top floating button — positioned DIRECTLY ABOVE the song/music icon
  function initBackToTop() {
    if (document.getElementById('lm-back-to-top')) return;
    var btn = document.createElement('button');
    btn.id = 'lm-back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.setAttribute('title', 'Back to top');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';

    // Desktop: music icon is at bottom: 24px (h: 44px). Button sits at bottom: 80px (24 + 44 + 12).
    // Mobile: music icon is at bottom: 5.5rem / 88px (h: 44px). Button sits at bottom: 144px (88 + 44 + 12).
    btn.style.cssText = 'position:fixed;right:24px;bottom:80px;width:44px;height:44px;border-radius:50%;' +
      'display:flex;align-items:center;justify-content:center;z-index:65;' +
      'background:hsl(var(--foreground)/0.9);color:hsl(var(--background));' +
      'border:1px solid hsl(var(--border)/0.5);box-shadow:0 4px 20px -4px hsl(var(--foreground)/0.35);' +
      'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);' +
      'cursor:pointer;opacity:0;pointer-events:none;transform:translateY(8px) scale(0.95);' +
      'transition:opacity 0.25s ease, transform 0.25s ease, background-color 0.2s ease, color 0.2s ease;';

    if (!document.getElementById('lm-btt-style')) {
      var s = document.createElement('style');
      s.id = 'lm-btt-style';
      s.textContent =
        '@media (max-width: 639px) { #lm-back-to-top { bottom: 144px !important; right: 24px !important; } }\n' +
        '#lm-back-to-top:hover { transform: translateY(0) scale(1.08) !important; opacity: 1 !important; background: hsl(var(--hero-accent)) !important; color: #000 !important; }';
      document.head.appendChild(s);
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function updateBTT() {
      var top = window.pageYOffset || document.documentElement.scrollTop || 0;
      if (top > 120) {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        btn.style.transform = 'translateY(0) scale(1)';
      } else {
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
        btn.style.transform = 'translateY(8px) scale(0.95)';
      }
    }

    window.addEventListener('scroll', updateBTT, { passive: true });
    document.body.appendChild(btn);
    updateBTT();
  }

  // Greeting voice.
  //
  // The visitor hears "Good morning / afternoon / evening. Welcome." EVERY time
  // they arrive on the homepage — every page load and every in-app navigation
  // back to "/" (logo or Home link) — not just on the first ever visit.
  //
  // Two traps this code exists to avoid:
  //
  // 1. The React bundle's intro screen also speaks a greeting 250ms after it
  //    mounts and sets window.__GREETING_SPOKEN__ = TRUE at that moment — before
  //    any audio actually starts. patch.js used to treat that flag as "already
  //    greeted", so when Chrome blocked the cold autoplay call (no user gesture
  //    yet) the gesture fallback was disarmed and the site stayed silent for the
  //    whole page view. Here we adopt the bundle's audio only if it is really
  //    playing, and the fallback stays armed until the greeting is truly heard.
  // 2. Browsers refuse speech until the visitor interacts (Chrome/Safari autoplay
  //    policy). Nothing can bypass that; the answer is to speak on the visitor's
  //    first click / tap / key press of that page view. Scroll is not a valid
  //    activation for audio, which is why it is not in the list below.
  //
  // Mute: lulamile/edits.js -> settings.greetingVoice = false
  (function initGreetingVoice() {
    var spoken = false;     // audio for THIS homepage view actually started
    var pending = false;    // a speak() call is in flight right now
    var lastPath = null;

    function pathOf() {
      try { return stripBase(window.location.pathname) || '/'; } catch (e) { return '/'; }
    }
    function isHome() {
      var p = pathOf();
      return p === '/' || p === '' || p === '/index.html';
    }
    function muted() { return SET.greetingVoice === false; }

    function getGreeting() {
      var h = new Date().getHours();
      var w = (h >= 5 && h < 12) ? "Good Morning" :
              (h >= 12 && h < 17) ? "Good Afternoon" :
              (h >= 17 && h < 21) ? "Good Evening" :
              (h === 0 || h === 1) ? "It's Midnight" :
              (h < 5) ? "Still Awake?" : "Good Night";
      return w + ". Welcome.";
    }

    function markSpoken() { pending = false; spoken = true; window.__GREETING_SPOKEN__ = true; }

    // Is the bundle's own greeting already making sound? ('speaking' = audible,
    // 'pending' = queued but not started yet.)
    function bundleSpeech() {
      try {
        if (!window.speechSynthesis) return 'none';
        if (window.speechSynthesis.speaking) return 'speaking';
        if (window.speechSynthesis.pending) return 'pending';
      } catch (e) {}
      return 'none';
    }

    function speak() {
      if (muted() || spoken || pending || !isHome()) return;
      if (!('speechSynthesis' in window)) return;

      var state = bundleSpeech();
      if (state === 'speaking') { markSpoken(); return; }   // audible already — never double up
      if (state === 'pending') {                            // queued: check again shortly
        pending = true;
        setTimeout(function () { pending = false; speak(); }, 1200);
        return;
      }

      try {
        // Clear any stuck queue first (Chrome speech bug after a blocked call).
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(getGreeting());
        u.rate = 0.9;
        u.pitch = 1.05;
        u.volume = 1.0;
        var voices = window.speechSynthesis.getVoices() || [];
        for (var i = 0; i < voices.length; i++) {
          if (voices[i].lang && voices[i].lang.indexOf('en') === 0) { u.voice = voices[i]; break; }
        }
        // spoken only flips when the browser ACTUALLY starts the audio; a
        // blocked attempt ("not-allowed") leaves the fallback armed.
        pending = true;
        u.onstart = markSpoken;
        u.onend = markSpoken;
        u.onerror = function () { pending = false; };
        window.speechSynthesis.speak(u);
        // Safety: if the browser neither starts nor errors, allow a retry.
        setTimeout(function () { if (!spoken) pending = false; }, 2500);
      } catch (e) { pending = false; }
    }

    // Arriving on the homepage: greet. Called on page load and on every in-app
    // navigation into "/", so a return to the homepage always speaks.
    function arrive() {
      if (muted() || !isHome()) return;
      spoken = false;
      pending = false;
      speak();
      setTimeout(speak, 900);    // voices / autoplay state may settle late
      setTimeout(speak, 2200);
    }

    // First attempts wait for the bundle's intro greeting to have had its turn,
    // so we adopt that audio instead of talking over it.
    setTimeout(speak, 900);
    setTimeout(speak, 2200);
    setTimeout(speak, 4000);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = function () { speak(); };
    }

    // Fallback: first REAL user activation (click / tap / key press). These
    // listeners stay for the life of the document, because they must also serve
    // each later arrival at the homepage.
    var events = ['click', 'pointerup', 'touchend', 'keydown'];
    function onGesture() { speak(); }
    events.forEach(function (ev) { window.addEventListener(ev, onGesture, { capture: true, passive: true }); });

    // In-app (SPA) route changes: patch.js already re-runs on React's DOM
    // mutations, but the URL can also change on its own via history back/forward.
    window.addEventListener('popstate', function () { checkArrival(); });
    // Back/forward-cache restore of the homepage counts as an arrival too.
    window.addEventListener('pageshow', function (e) { if (e && e.persisted && isHome()) arrive(); });

    function checkArrival() {
      var here = pathOf();
      var home = isHome();
      // Only a CHANGE into the homepage counts — staying there must not replay.
      if (home && lastPath !== null && lastPath !== here) arrive();
      lastPath = here;
    }
    checkArrival();
    window.__LM_GREETING_CHECK__ = checkArrival;   // run by patch() on route changes
  })();

  // Midnight easter egg
  // Midnight Mode easter egg. Never rewrite a node React owns: clearing a
  // React-managed element with innerHTML = '' makes its reconciler throw
  // ("NotFoundError: removeChild") and re-render, patch() runs again from the
  // MutationObserver below, and the page locks up at 100% CPU with the intro
  // overlay stuck on screen ("loading forever", 23:00-01:59 local time).
  // The joke now lives in its own element on <body>, outside #root.
  function checkMidnight() {
    var h = new Date().getHours();
    var isMidnight = (h === 0 || h === 1 || h === 23);
    if (!isMidnight) return;
    if (document.getElementById('lm-midnight-egg')) return;

    var egg = document.createElement('div');
    egg.id = 'lm-midnight-egg';
    egg.setAttribute('data-lm-injected', '1');
    egg.style.cssText = 'text-align:center;padding:14px 16px;font-size:12px;color:hsl(var(--hero-accent));' +
      'font-family:monospace;border-top:1px dashed hsl(var(--border));opacity:0.85;position:relative;z-index:5;';
    egg.textContent = '🌙 Midnight Mode · Lula is probably pushing pixels in the dark. Go get some sleep! (Or book a call)';
    document.body.appendChild(egg);
  }

  // ---------------------------------------------------------------- protection
  // Visitors can read the site but not select or copy the wording.
  function protectContent() {
    if (SET.copyProtection === false) return;
    if (document.getElementById('lm-protect-style')) return;

    var style = document.createElement('style');
    style.id = 'lm-protect-style';
    style.textContent =
      'body{-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;' +
      '-webkit-touch-callout:none;}' +
      'input,textarea,select,[contenteditable="true"]{-webkit-user-select:text;user-select:text;}' +
      'img{-webkit-user-drag:none;user-drag:none;}';
    document.head.appendChild(style);

    if (!document.getElementById('lm-layout-style')) {
      var layout = document.createElement('style');
      layout.id = 'lm-layout-style';
      layout.textContent = 'html,body{overflow-x:hidden;overflow-x:clip;}';
      document.head.appendChild(layout);
    }

    var allowed = function (el) {
      if (!el || !el.tagName) return false;
      var t = el.tagName.toUpperCase();
      return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.isContentEditable;
    };

    var toast = null;
    function saySomething() {
      var msg = SET.copyMessage || 'This content is protected.';
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'lm-protect-toast';
        toast.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;' +
          'background:rgba(17,17,19,.96);color:#fff;font-size:13px;line-height:1.4;padding:12px 18px;' +
          'border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:88vw;text-align:center;' +
          'opacity:0;transition:opacity .25s ease;pointer-events:none;';
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.style.opacity = '1';
      clearTimeout(toast._lmTimer);
      toast._lmTimer = setTimeout(function () { toast.style.opacity = '0'; }, 1900);
    }

    document.addEventListener('copy', function (e) {
      if (allowed(e.target)) return;
      e.preventDefault(); saySomething();
    }, true);

    document.addEventListener('cut', function (e) {
      if (allowed(e.target)) return;
      e.preventDefault(); saySomething();
    }, true);

    document.addEventListener('contextmenu', function (e) {
      if (allowed(e.target)) return;
      e.preventDefault(); saySomething();
    }, true);

    document.addEventListener('selectstart', function (e) {
      if (allowed(e.target)) return;
      e.preventDefault();
    }, true);

    document.addEventListener('dragstart', function (e) {
      if (e.target && e.target.tagName === 'IMG') e.preventDefault();
    }, true);

    document.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var k = (e.key || '').toLowerCase();
      if (allowed(e.target)) return;
      if (k === 'c' || k === 'x' || k === 'a') {
        e.preventDefault();
        if (k !== 'a') saySomething();
      }
    }, true);
  }

  // Figma / resource archive cards open the real tools in a new tab
  function flagExternalCards() {
    document.querySelectorAll('a[href^="https://www.figma.com"], a[href*="portfolio.github.io/projects.html"]').forEach(function (card) {
      card.setAttribute('target', '_blank');
      card.setAttribute('rel', 'noopener noreferrer');
      if (!card.querySelector('img')) return;
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      if (card.querySelector('.lm-ext-badge')) return;
      var badge = document.createElement('span');
      badge.className = 'lm-ext-badge';
      badge.textContent = 'Opens externally';
      badge.style.cssText = 'position:absolute;top:20px;right:20px;z-index:20;background:hsl(var(--hero-accent));' +
        'color:hsl(var(--background));font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;' +
        'padding:7px 12px;border-radius:999px;';
      card.appendChild(badge);
    });
  }

  // ------------------------------------------------------------ your edits
  function applyEdits() {
    if (!EDITS || EDITS.__applied) return;
    try {
      (EDITS.text || []).forEach(function (rule) {
        if (!rule || !rule.find) { return; }
        document.querySelectorAll('h1,h2,h3,h4,p,span,li,div,a,button').forEach(function (el) {
          if (el.children.length) return;
          var v = el.textContent;
          if (v && v.indexOf(rule.find) > -1) el.textContent = v.split(rule.find).join(rule.replace);
        });
      });
      var imgs = EDITS.images || [];
      if (imgs.length) {
        document.querySelectorAll('img').forEach(function (im) {
          var src = im.getAttribute('src') || '';
          imgs.forEach(function (rule) {
            if (rule && rule.find && src.indexOf(rule.find) > -1) {
              im.setAttribute('src', src.split(rule.find).join(rule.replace));
            }
          });
        });
      }
      var links = EDITS.links || [];
      if (links.length) {
        document.querySelectorAll('a[href]').forEach(function (a) {
          var href = a.getAttribute('href') || '';
          links.forEach(function (rule) {
            if (rule && rule.find && href.indexOf(rule.find) > -1) {
              a.setAttribute('href', href.split(rule.find).join(rule.replace));
            }
          });
        });
      }
      EDITS.__applied = true;
    } catch (e) {}
  }

  function replaceTextNode(node) {
    if (!node || node.nodeType !== 3) return;
    var v = node.nodeValue;
    if (!v || !v.trim()) return;
    var o = v;
    if (v.indexOf('Anywhere Remote') > -1 && v.indexOf(CONFIG.location) === -1) {
      v = v.replace(/[A-Za-z ]+, Anywhere Remote/g, CONFIG.location);
    }
    if (o !== v) node.nodeValue = v;
  }

  function patch() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(replaceTextNode);

    document.querySelectorAll('a[href*="calendly.com"]').forEach(function (a) {
      if (a.getAttribute('href').indexOf(CONFIG.newCalendly) === -1) a.href = CONFIG.newCalendly;
    });
    document.querySelectorAll('a[href*="drive.google.com"]').forEach(function (a) {
      if (a.getAttribute('href').indexOf('1iNgauKhYevO53') === -1) a.href = CONFIG.newResume;
    });
    document.querySelectorAll('a[href*="linkedin.com"]').forEach(function (a) {
      if (a.getAttribute('href').indexOf('lulamile-mkhungela') === -1) a.href = CONFIG.newLinkedIn;
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      if (a.getAttribute('href') !== 'mailto:' + CONFIG.newEmail) {
        a.setAttribute('href', 'mailto:' + CONFIG.newEmail);
        if (a.textContent.indexOf('@') > -1) a.textContent = CONFIG.newEmail;
      }
    });
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      if (a.getAttribute('href') !== 'tel:' + CONFIG.newPhoneRaw) {
        a.setAttribute('href', 'tel:' + CONFIG.newPhoneRaw);
        if (a.textContent.indexOf('+') > -1) a.textContent = CONFIG.newPhone;
      }
    });

    // Profile photo
    document.querySelectorAll('img').forEach(function (img) {
      var src = img.getAttribute('src') || '';
      var isProfileSlot =
        img.hasAttribute('data-lm-portrait') ||
        /(^|\/)about\.[a-z]+$/i.test(src) ||
        /meew\.jpe?g$/i.test(src) ||
        /profile|portrait|headshot/i.test(img.getAttribute('alt') || '');
      if (!isProfileSlot) return;
      if (src !== profilePic) img.setAttribute('src', profilePic);
      if (img.getAttribute('srcset')) img.removeAttribute('srcset');
    });

    // Client marks
    document.querySelectorAll('img[data-lm-brand], img[src*="-logo.svg"], img[src*="worked-with"]').forEach(function (img, i) {
      img.src = basePath + newBrands[i % newBrands.length];
      img.style.filter = 'none';
      img.style.background = '#fff';
      img.style.padding = '4px 8px';
      img.style.borderRadius = '6px';
      img.style.height = '32px';
      img.style.objectFit = 'contain';
    });

    ensureLogosColors();
    fixInternalLinks();
    flagRedirectCards();
    applyEdits();
    flagLexark();
    flagExternalCards();
    removeTestimonials();
    fixBackButton();
    ensureFavicon();
    enhanceCaseStudyLiveLinks();
    renderServicesIndustries();
    initBackToTop();
    checkMidnight();
  }

  function runPass() {
    try { ensureLogosColors(); } catch (e) {}
    try { patch(); } catch (e) {}
    try { initBackToTop(); } catch (e) {}
  }

  function start() {
    protectContent();
    ensureLogosColors();
    runPass();
    initBackToTop();

    // One queued pass at a time, observer disconnected while a pass runs so
    // patch()'s own writes cannot schedule the next pass, plus a circuit
    // breaker if the page ever mutates pathologically.
    var quiet = null;
    var passTimes = [];
    var pausedUntil = 0;

    var observer = new MutationObserver(function () {
      if (quiet) return;
      quiet = setTimeout(function () {
        quiet = null;
        var now = Date.now();
        passTimes = passTimes.filter(function (t) { return now - t < 10000; });
        if (now < pausedUntil) return;
        if (passTimes.length > 30) { pausedUntil = now + 10000; passTimes = []; return; }
        passTimes.push(now);
        observer.disconnect();
        runPass();
        observer.observe(document.body, { childList: true, subtree: true });
      }, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    [150, 400, 900, 1800, 3200].forEach(function (t) {
      setTimeout(function () {
        observer.disconnect();
        runPass();
        observer.observe(document.body, { childList: true, subtree: true });
      }, t);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
