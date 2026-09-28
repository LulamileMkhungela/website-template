// LulaMile-HalfMachine — site behaviour layer v36
// Adds: screen-aware FAQ headings, project-unique process wording, external-link tags,
// real certificate covers + scrollable multi-page certificate popup (ascending), plus a
// client-route SEO layer (document.title, meta description, canonical & OG) and an
// accessibility hydrator (skip link, landmark labels, H1 seeding, focus rings, reduced-
// motion guard). Keeps v26/v27/v28 behaviour.
(function () {
  'use strict';

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
  if (SET.name)     CONFIG.newName     = SET.name;
  if (SET.email)    CONFIG.newEmail    = SET.email;
  if (SET.phone)    CONFIG.newPhone    = SET.phone;
  if (SET.phoneRaw) CONFIG.newPhoneRaw = SET.phoneRaw;
  if (SET.calendly) CONFIG.newCalendly = SET.calendly;
  if (SET.resume)   CONFIG.newResume   = SET.resume;
  if (SET.linkedin) CONFIG.newLinkedIn = SET.linkedin;
  CONFIG.location = SET.location || 'Johannesburg, Anywhere Remote';

  // Resolve once to an absolute path. A relative ../lulamile/ URL changes its
  // meaning after client-side navigation to a page at a different depth.
  var basePath = (window.__GH_BASE__ || '') + '/lulamile/';
  if (document.currentScript) {
    basePath = new URL('.', document.currentScript.src).pathname;
  }

  var newBrands = ['dpsa.png','nerdma.png','addmore.png','toyota.png','voda.png','intelle.png',
                   'sasol.png','novelmed.png','uluntu.png','ioco.png','takeda.png','shaper.png'];
  var profilePic = basePath + 'meew.jpeg';

  var GH_BASE = '';
  try { GH_BASE = window.__GH_BASE__ || ''; } catch (e) {}
  function stripBase(href) {
    if (GH_BASE && href === GH_BASE) return '/';
    if (GH_BASE && href.indexOf(GH_BASE + '/') === 0) return href.slice(GH_BASE.length);
    return href;
  }

  // ─── Direct-redirect apps (no case study) ────────────────────────────────
  var DIRECT_REDIRECT_APPS = {
    'kinto-one':      'https://www.toyota.co.za/kinto-personal',
    'toyota-remote':  'https://play.google.com/store/apps/details?id=za.co.toyota.toyotaremote&hl=en_ZA&pli=1',
    'toyota-app':     'https://play.google.com/store/apps/details?id=com.eliance.toyotamobile&hl=en_ZA',
    'wandisplace-pwa':'https://wandies.vercel.app/',
    'sk-finds-pwa':   'https://skautos.vercel.app/',
    'snb-website':    'https://www.snbconsultancy.co.za'
  };

  // ─── Projects with case studies + live URL ───────────────────────────────
  var LIVE_STUDY_URLS = {
    'africa-cuisine-pwa':       { url: 'https://africa-cuisine-pro.vercel.app',                                  label: 'Open live PWA' },
    'nerdma-website':           { url: 'https://www.nerdma.co.za',                                               label: 'Visit live website' },
    'addmoredigital-website':   { url: 'https://addmoredigital.co.za/',                                          label: 'Visit live website' },
    'designops-design-system':  { url: 'https://lulamilemkhungela.github.io/design-ops/',                        label: 'Open live site' },
    'lula-trustshield':         { url: 'https://github.com/LulamileMkhungela/LulaUnifidMarket',                  label: 'Open on GitHub' },
    'lula-gazette':             { url: 'https://lulamilemkhungela.github.io/LulaGazette/index.html',             label: 'Open live site' },
    'service-waze':             { url: 'https://lulamilemkhungela.github.io/ServiceWaze/',                       label: 'Open live site' },
    'foodiezone-pwa':           { url: 'https://loux91.github.io/foodiezone/',                                   label: 'Open live PWA' }
  };

  // ─── SNB: not a case study — the URL itself redirects to the live site ──
  function snbRedirect() {
    var p = window.location.pathname || '';
    if (p.indexOf('/project/snb-website') > -1) {
      window.location.replace(DIRECT_REDIRECT_APPS['snb-website']);
    }
  }

  // ─── NDA: disable links ──────────────────────────────────────────────────
  var NDA_PROJECTS = ['digital-visitors', 'engage-admin'];

  // ─────────────────────────────────────────────────────────────────────────
  // GLASSMORPHISM — applied to the whole site, not just the header.
  // Uses CSS custom properties so dark mode gets its own darker frost.
  // ─────────────────────────────────────────────────────────────────────────
  function glassPass() {
    if (document.getElementById('lm-glass-style')) return;
    var s = document.createElement('style');
    s.id = 'lm-glass-style';
    s.textContent = [
      // ── tokens ──
      ':root{',
      '  --lmg-bg:hsl(var(--background)/0.65);',
      '  --lmg-card:hsl(var(--card)/0.58);',
      '  --lmg-brd:hsl(var(--foreground)/0.09);',
      '  --lmg-sh:0 8px 32px -10px hsl(var(--foreground)/0.18);',
      '  --lmg-blur:blur(18px) saturate(1.5);',
      '}',
      '.dark{',
      '  --lmg-bg:hsl(var(--card)/0.48);',
      '  --lmg-card:hsl(var(--card)/0.52);',
      '  --lmg-brd:hsl(var(--background)/0.22);',
      '  --lmg-sh:0 10px 40px -12px rgba(0,0,0,0.55);',
      '  --lmg-blur:blur(18px) saturate(1.35);',
      '}',
      // ── sticky header ──
      'header[class*="sticky"],header[class*="fixed"]{',
      '  background:var(--lmg-bg) !important;',
      '  -webkit-backdrop-filter:var(--lmg-blur);',
      '  backdrop-filter:var(--lmg-blur);',
      '  border-color:var(--lmg-brd) !important;',
      '  box-shadow:var(--lmg-sh) !important;',
      '}',
      // ── dropdowns / popovers ──
      'header .absolute,header [class*="dropdown"],[class*="popover"],[class*="dropdown-menu"]{',
      '  background:var(--lmg-card) !important;',
      '  -webkit-backdrop-filter:blur(16px) saturate(1.4);',
      '  backdrop-filter:blur(16px) saturate(1.4);',
      '  border-color:var(--lmg-brd) !important;',
      '  box-shadow:0 18px 44px -18px hsl(var(--foreground)/.35) !important;',
      '}',
      // ── opt-in glass cards (testimonials, certs, CTA cards, contact panels) ──
      '.lm-glass-card{',
      '  background:var(--lmg-card) !important;',
      '  -webkit-backdrop-filter:blur(14px) saturate(1.35);',
      '  backdrop-filter:blur(14px) saturate(1.35);',
      '  border:1px solid var(--lmg-brd) !important;',
      '  box-shadow:var(--lmg-sh);',
      '}',
      // ── nav dropdown: let React control sizing, just ensure glassmorphism ──
      // Do NOT override min/max-width — the bundle's own dropdown fits naturally.
      // ── section/page whitespace fix ──
      // The brand-strategy page used the React SPA and left large gaps.
      // Now it is a static page, but we still collapse orphan padding on the React pages.
      'main > section:empty,main > div:empty{display:none !important;}',
      // About page: remove the large empty block after the Picasso quote
      '.lm-about-gap-fix + *{margin-top:0 !important;padding-top:0 !important;}',
      // Services: collapse whitespace between CTA grid and "How I work"
      '#lm-svc-cta-gap{display:none !important;}',
      // ── site-wide frosted glass (UI shape untouched, content stays readable) ──
      // Solid shadcn card surfaces become frosted panels
      'main .bg-card,aside .bg-card{background:var(--lmg-card) !important;-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);}',
      // Already-translucent card tints get a real frost
      'main .bg-card\\/20,main .bg-card\\/40,main .bg-card\\/50,main .bg-card\\/60,main .bg-card\\/70,main .bg-card\\/80,main .bg-card\\/95,main .bg-background\\/60,main .bg-background\\/80{-webkit-backdrop-filter:blur(10px) saturate(1.3);backdrop-filter:blur(10px) saturate(1.3);}',
      // Form fields
      'main input:not([type="checkbox"]):not([type="radio"]),main select,main textarea{background:var(--lmg-card) !important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);}',
      // Footer panel
      'footer{background:var(--lmg-bg) !important;-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);}',
    ].join('\n');
    document.head.appendChild(s);

    // Opt-in glass for existing React-rendered cards
    document.querySelectorAll('header .absolute,.backdrop-blur-md,.backdrop-blur-sm').forEach(function (el) {
      el.classList.add('lm-glass-card');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NAV: rename "Expertise" → "Expertise & Works", fix dropdown, active states
  // ─────────────────────────────────────────────────────────────────────────
  function fixNav() {
    var here = stripBase(window.location.pathname);

    // Active-page map
    var NAV_ACTIVE = {
      '/product-design':   true,
      '/brand-strategy':   true,
      '/website-design':   true,
      '/frontend-develop': true,
      '/microfinance':     true,
      '/services':         true,
      '/about':            true,
      '/contact':          true
    };

    document.querySelectorAll('nav a, header a').forEach(function (a) {
      var txt = (a.textContent || '').trim();
      // Rename label
      if (txt === 'Expertise') a.textContent = 'Expertise \u0026 Works';
      // Active state
      var href = a.getAttribute('href') || '';
      var active = false;
      for (var frag in NAV_ACTIVE) {
        if (here.indexOf(frag) > -1 && href.indexOf(frag) > -1) { active = true; break; }
      }
      if ((here === '/' || here === '' || here === '/index.html') &&
          (href === '/' || href === GH_BASE + '/' || href === GH_BASE || href === './')) {
        active = true;
      }
      if (active) { a.style.color = 'hsl(var(--hero-accent))'; a.style.fontWeight = '700'; }
    });

    // Fix "Expertise" button/summary text
    document.querySelectorAll('button,summary').forEach(function (btn) {
      var txt = (btn.textContent || '').trim();
      if (txt === 'Expertise' || txt === 'Expertise\u25be') {
        // replace only the text node, not child elements
        btn.childNodes.forEach(function (n) {
          if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim() === 'Expertise') {
            n.nodeValue = 'Expertise \u0026 Works';
          }
        });
      }
    });

    // Highlight "Expertise & Works" button when on an expertise sub-page
    var expertiseFrags = ['/product-design','/brand-strategy','/website-design','/frontend-develop','/microfinance'];
    if (expertiseFrags.some(function(f){return here.indexOf(f)>-1;})) {
      document.querySelectorAll('button[aria-haspopup],details summary').forEach(function(btn){
        if ((btn.textContent||'').indexOf('Expertise')>-1) {
          btn.style.color = 'hsl(var(--hero-accent))';
          btn.style.fontWeight = '700';
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DROPDOWN: remove duplicate "Frontend Development" injected by old code
  // ─────────────────────────────────────────────────────────────────────────
  function fixDropdownDuplicates() {
    // The React bundle already shows "Frontend Development" in the nav.
    // Remove any dynamically-injected duplicate with id lm-fe-nav-item.
    var dupe = document.getElementById('lm-fe-nav-item');
    if (dupe) dupe.remove();

    // Also deduplicate by href: keep first, hide subsequent occurrences
    var seenHrefs = {};
    var container = document.querySelector('header .absolute, header [class*="dropdown"]');
    if (!container) return;
    container.querySelectorAll('a[href]').forEach(function (a) {
      var h = (a.getAttribute('href') || '').split('?')[0];
      if (seenHrefs[h]) {
        a.style.display = 'none';
      } else {
        seenHrefs[h] = true;
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WHITESPACE FIX — collapse blank sections/divs + fix about-page gap
  // ─────────────────────────────────────────────────────────────────────────
  function fixWhitespace() {
    // 1. Collapse React sections that have no content (empty padding blocks)
    document.querySelectorAll('main > section, main > div').forEach(function (el) {
      var txt = (el.textContent || '').trim();
      if (!txt && !el.querySelector('img,svg,canvas,iframe,video')) {
        el.style.display = 'none';
        el.style.margin = '0';
        el.style.padding = '0';
      }
    });

    // 2. About page: large whitespace after Picasso quote
    //    The quote block sits inside a <section> with large padding-bottom.
    //    Find it and collapse the bottom padding.
    var here = stripBase(window.location.pathname);
    if (here.indexOf('about') > -1) {
      document.querySelectorAll('blockquote, figure').forEach(function (el) {
        var txt = (el.textContent || '');
        if (txt.indexOf('Picasso') > -1 || txt.indexOf('I am always doing') > -1) {
          // Walk up to the containing section and trim its bottom padding
          var sec = el.closest('section');
          if (sec) {
            sec.style.paddingBottom = '0';
            sec.style.marginBottom = '0';
            // Also trim the next sibling's top padding
            var next = sec.nextElementSibling;
            if (next) {
              next.style.paddingTop = '0';
              next.style.marginTop = '0';
            }
          }
          // Mark so the CSS rule can also target the next sibling
          el.closest('section') && el.closest('section').classList.add('lm-about-gap-fix');
        }
      });
    }

    // 3. Services: the CTA section leaves a big gap before "How I work"
    if (here.indexOf('services') > -1) {
      // Find the section containing "Let's talk"
      var ltSec = null;
      document.querySelectorAll('p').forEach(function (p) {
        if (!ltSec && (p.textContent || '').trim() === "Let's talk") {
          ltSec = p.closest('section');
        }
      });
      if (ltSec && !ltSec.hasAttribute('data-lm-tight')) {
        ltSec.setAttribute('data-lm-tight', '1');
        ltSec.style.paddingBottom = '0';
        ltSec.style.marginBottom = '0';
        // Collapse any empty sibling between CTA and How I work
        var sib = ltSec.nextElementSibling;
        for (var i = 0; i < 5 && sib; i++) {
          var stxt = (sib.textContent || '').trim();
          if (!stxt) {
            sib.style.display = 'none';
          } else if (stxt.indexOf('How I work') > -1 || sib.tagName === 'SECTION') {
            sib.style.paddingTop = window.innerWidth < 1024 ? '28px' : '44px';
            break;
          }
          sib = sib.nextElementSibling;
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GREETING — plays ONCE on very first visit, stops when page fully loads,
  // time-aware message matching the welcome on screen.
  // ─────────────────────────────────────────────────────────────────────────
  (function installGreetingGate() {
    if (!('speechSynthesis' in window)) return;
    var KEY = 'lmGreeted';
    var alreadyGreeted = false;
    try { alreadyGreeted = localStorage.getItem(KEY) === '1'; } catch (e) {}

    window.__LM_GREET_MUTED__  = function () { return alreadyGreeted; };
    window.__LM_GREET_LOCK__   = function () {
      if (alreadyGreeted) return;
      alreadyGreeted = true;
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
    };

    var synth = window.speechSynthesis;
    var realSpeak = synth.speak.bind(synth);
    synth.speak = function (u) {
      if (alreadyGreeted) {
        try { synth.cancel(); } catch (e) {}
        window.__GREETING_SPOKEN__ = true;
        return;
      }
      var origStart = u && u.onstart;
      try {
        u.onstart = function () {
          window.__LM_GREET_LOCK__();
          if (typeof origStart === 'function') { try { origStart.apply(this, arguments); } catch (e) {} }
        };
      } catch (e) {}
      return realSpeak(u);
    };
  })();

  (function initGreeting() {
    var KEY = 'lmGreeted';
    // If already greeted in a previous session, never speak again.
    try { if (localStorage.getItem(KEY) === '1') return; } catch (e) {}
    if (!('speechSynthesis' in window)) return;

    var spoken  = false;
    var pending = false;
    var uRef    = null; // keep reference so we can cancel when page loads

    function isHome() {
      var p = stripBase(window.location.pathname);
      return p === '/' || p === '' || p === '/index.html';
    }
    function isMuted() { return SET.greetingVoice === false; }
    function isGateMuted() {
      try { return !!(window.__LM_GREET_MUTED__ && window.__LM_GREET_MUTED__()); } catch (e) { return false; }
    }

    function getGreeting() {
      var h = new Date().getHours();
      // Mirrors the welcome splash on screen (word + sub-line), so what is
      // spoken is exactly what is displayed.
      if (h >= 5  && h < 12) return 'Good morning. The day is yours. Welcome.';
      if (h >= 12 && h < 17) return 'Good afternoon. Let\u2019s make it count. Welcome.';
      if (h >= 17 && h < 21) return 'Good evening. Great things take time. Welcome.';
      if (h === 0 || h === 1) return 'It\u2019s midnight. Great things take time \u2014 and the site will still be here tomorrow. Welcome.';
      if (h >= 2  && h < 5)  return 'Still awake? You and the servers. Go to bed. Welcome.';
      if (h >= 21)           return 'Good night. Still here. So are we. Welcome.';
      return 'Welcome.';
    }

    function markSpoken() {
      pending = false;
      spoken  = true;
      uRef    = null;
      window.__GREETING_SPOKEN__ = true;
    }

    // Stop speech once the page content is fully loaded and visible
    function stopOnLoad() {
      if (spoken || !uRef) return;
      try { window.speechSynthesis.cancel(); } catch (e) {}
      markSpoken();
    }

    function bundleState() {
      try {
        if (window.speechSynthesis.speaking) return 'speaking';
        if (window.speechSynthesis.pending)  return 'pending';
      } catch (e) {}
      return 'none';
    }

    function speak() {
      if (isMuted() || isGateMuted() || spoken || pending || !isHome()) return;
      var state = bundleState();
      if (state === 'speaking') { markSpoken(); return; }
      if (state === 'pending')  { pending = true; setTimeout(function(){ pending=false; speak(); }, 1200); return; }
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(getGreeting());
        u.rate   = 0.88;
        u.pitch  = 1.05;
        u.volume = 1.0;
        // Pick an English voice
        (window.speechSynthesis.getVoices() || []).forEach(function (v) {
          if (!u.voice && v.lang && v.lang.indexOf('en') === 0) u.voice = v;
        });
        uRef      = u;
        pending   = true;
        u.onstart = markSpoken;
        u.onend   = markSpoken;
        u.onerror = function () { pending = false; uRef = null; };
        window.speechSynthesis.speak(u);
        // Safety timeout: if no onstart after 2.5 s allow retry
        setTimeout(function () { if (!spoken) pending = false; }, 2500);
      } catch (e) { pending = false; }
    }

    // Attempt to speak as soon as possible (first visit, home page only)
    if (isHome()) {
      setTimeout(speak, 600);
      setTimeout(speak, 1800);
      setTimeout(speak, 3500);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = function () { speak(); };
      }
      // Gesture fallback for browsers that block autoplay until interaction
      ['click','pointerup','touchend','keydown'].forEach(function (ev) {
        window.addEventListener(ev, speak, { capture:true, passive:true });
      });
      // Stop speaking once the page content appears (DOMContentLoaded or load)
      window.addEventListener('load', function () { setTimeout(stopOnLoad, 1200); });
      if (document.readyState !== 'loading') { setTimeout(stopOnLoad, 1500); }
    }

    window.__LM_GREETING_CHECK__ = function () {};
  })();

  // ─────────────────────────────────────────────────────────────────────────
  // BACK BUTTON — always goes to the real previous page
  // ─────────────────────────────────────────────────────────────────────────
  function fixBackButton() {
    document.querySelectorAll('button,a').forEach(function (el) {
      var txt = (el.textContent || '').trim();
      if (txt !== 'Back' && txt !== '\u2190 Back' && txt !== '← Back') return;
      if (el.getAttribute('data-lm-back')) return;
      el.setAttribute('data-lm-back', '1');
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.history && window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = (GH_BASE || '') + '/';
        }
      }, true);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ABOUT: Skills & Tools (replaces testimonials) + Certifications (popup)
  // + contact form inside the "Let's connect" section.
  // ─────────────────────────────────────────────────────────────────────────
  function injectAboutSections() {
    var p = stripBase(window.location.pathname);
    if (p.indexOf('about') === -1) return;
    if (document.getElementById('lm-about-skills')) return;
    var linked = document.querySelector('section[aria-label="LinkedIn Recommendations"]');
    if (!linked) return;
    // Anchor directly on the section so inserts land beside it no matter how the
    // React tree mounted (its parent may be body — inserting 'beforebegin' on a
    // <body> child would push content outside <body> into <html>).
    var anchor = linked;
    var imgBase = GH_BASE + '/projects/lulamile/certs/';

    // What replaces "What people say" — skills grouped by discipline.
    var skills = [
      { title: 'Product & UX Design', desc: 'Research, information architecture, wireframing, prototyping, user testing and UI design — from first conversation to a tested product.' },
      { title: 'Brand & Strategy', desc: 'Positioning, identity systems and launch assets, so the visual work always carries a clear, agreed strategy.' },
      { title: 'Web & Conversion Design', desc: 'Sites designed from the first scroll to earn trust and turn visitors into enquiries — with SEO built in, not bolted on.' },
      { title: 'PWA & Product Build', desc: 'Live, installable progressive web apps — offline-first, built for mid-range phones and patchy signal.' },
      { title: 'Design Systems', desc: 'Token architecture, component libraries and documentation that keep design and code in step.' },
      { title: 'CRM & Pipeline Ops', desc: 'Enquiry capture, pipeline stages, ownership rules and follow-up automation behind the work.' }
    ];

    var tools = [
      'Figma', 'Notion', 'React', 'Next.js', 'Vue', 'TypeScript', 'JavaScript',
      'HTML', 'CSS', 'Tailwind CSS', 'Bootstrap', 'Storybook', 'HubSpot', 'Zoho', 'GitHub'
    ];

    // The real certificates the studio holds. `pages` is the list of full-size
    // images shown in the popup — multi-page certificates simply add more
    // entries and the popup becomes scrollable.
    var certList = [
      { title:'Become a Software Developer', sub:'Learning Path · LinkedIn Learning', year:'2021', pages:['certificateofcompletion_become-a-software-developer.png'] },
      { title:'Data-Driven Product Research and Design', sub:'Course · LinkedIn Learning', year:'2025', pages:['certificateofcompletion_datadriven-product-research-and-design.png'] },
      { title:'Interaction Design: Software & Web Design Patterns', sub:'Course · LinkedIn Learning', year:'2023', pages:['certificateofcompletion_interaction-design-software-and-web-design-patterns.png'] },
      { title:'Programming Foundations: Databases', sub:'Course · LinkedIn Learning', year:'2020', pages:['certificateofcompletion_programming-foundations-databases.png'] },
      { title:'Succeeding in Web Development: Full Stack & Front End', sub:'Course · LinkedIn Learning', year:'2020', pages:['certificateofcompletion_succeeding-in-web-development-full-stack-and-front-end.png'] },
      { title:'The AI-Driven Product Designer', sub:'Course · LinkedIn Learning', year:'2025', pages:['certificateofcompletion_the-aidriven-product-designer.png'] },
      { title:'Using AI for UX Design and Research', sub:'Course · LinkedIn Learning', year:'2025', pages:['certificateofcompletion_using-ai-for-ux-design-and-research--1.png'] },
      { title:'Principles of UX/UI Design', sub:'Course · Meta via Coursera', year:'2024', url:'https://coursera.org/verify/U2JMPYF87F9X', pages:['coursera-principle-of-ux.png'] },
      { title:'UX & Interaction Design for AR/VR/MR/XR', sub:'University of Michigan · Coursera', year:'2024', url:'https://coursera.org/verify/QSXYNJ89H9FH', pages:['coursera-vr-mr-ar-design.png'] },
      { title:'Microsoft Data Science Skills Programme', sub:'Microsoft Official Course', year:'2020', pages:['lulamile-mkhungela---microsoft-certificate-1.png'] },
      { title:'Full Stack Development', sub:'FNB App of the Year Academy', year:'2025', pages:['fnb-certificate.png'] },
      { title:'MTN Business App Academy', sub:'NQF Level 5', year:'2021', pages:['mtn-business-app-academy-lulamile-mkhungela.png'] },
      { title:'Google UX Design', sub:'Professional Certificate · Google via Coursera', year:'2023', url:'https://coursera.org/verify/professional-cert/QLAGF9WDV2BA', pages:['ux-design-g.png'] },
      { title:'Google AI Essentials', sub:'Course · Google via Coursera', year:'2024', url:'', pages:['ai-google.jpeg'] },
      { title:'Google Project Management', sub:'Professional Certificate · Coursera', year:'2023', pages:['project-management.jpeg'] },
      { title:'UX Experience Design', sub:'JCSE · Wits', year:'2017', pages:['jcse---copy.png'] },
      { title:'Digital Academy Certificate', sub:'Certified programme', year:'2019', pages:['dacertificateoriginal.png'] },
      { title:'Beginner Tutorials', sub:'C#, HTML, CSS, Java & SQL · SoloLearn', year:'2017', url:'', pages:['soloc.png','soloc-p2.png','soloc-p3.png','soloc-p4.png','soloc-p5.png'] },
      { title:'Udemy Certificate', sub:'Course completion · Udemy', year:'2026', pages:['uc-3d757af2-c1d8-4c4f-b442-3a60acbf23a6--1.png'] }
    ];

    // Latest first (descending); any undated entries sit at the very end.
    certList.sort(function (a, b) {
      var ya = parseInt(a.year, 10); var yb = parseInt(b.year, 10);
      if (isNaN(ya) && isNaN(yb)) return 0;
      if (isNaN(ya)) return 1;   // undated goes last
      if (isNaN(yb)) return -1;
      return yb - ya;            // newest first
    });

    var matricNote = '<p style="font-size:13px;line-height:1.6;color:hsl(var(--muted-foreground));margin-top:24px;padding:12px 16px;border:1px dashed hsl(var(--border));border-radius:12px;background:hsl(var(--muted)/0.3);">' +
      '<strong style="color:hsl(var(--foreground));">School-leaving certificate:</strong> the Grade 12 (matric) certificate is available on request.' +
      '</p>';

    // ─ Skills & tools ─
    var skillsBox = document.createElement('section');
    skillsBox.id = 'lm-about-skills';
    skillsBox.className = 'lm-rv';
    skillsBox.style.cssText = 'padding:clamp(40px,6vw,60px) 0;border-top:1px solid hsl(var(--border)/0.6);';
    skillsBox.innerHTML =
      '<div class="container mx-auto px-6 lg:px-20 max-w-6xl">' +
        '<div class="flex items-center gap-3 mb-5">' +
          '<span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold" style="background:hsl(var(--hero-accent)/0.14);color:hsl(var(--hero-accent));">\u2605</span>' +
          '<p class="text-xs font-semibold uppercase tracking-widest" style="color:hsl(var(--hero-accent));">Skills &amp; Tools</p>' +
        '</div>' +
        '<h2 class="font-display font-bold leading-tight mb-4 max-w-2xl" style="font-size:clamp(24px,4vw,44px);">What I bring to the <span style="color:hsl(var(--hero-accent));">room</span>.</h2>' +
        '<p class="text-base text-muted-foreground leading-relaxed max-w-2xl mb-10">The disciplines I work across end to end — and the tools I reach for every day.</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;">' +
          skills.map(function(s){
            return '<div class="lm-glass-card" style="border-radius:16px;padding:20px 22px;">' +
              '<h3 style="font-size:15px;font-weight:700;margin:0 0 8px;color:hsl(var(--foreground));">' + s.title + '</h3>' +
              '<p style="margin:0;font-size:13px;line-height:1.6;color:hsl(var(--muted-foreground));">' + s.desc + '</p>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<p class="text-xs font-semibold uppercase tracking-widest" style="color:hsl(var(--hero-accent));margin-top:34px;">The toolbox</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">' +
          tools.map(function(t){
            return '<span class="lm-glass-card" style="display:inline-flex;align-items:center;padding:8px 15px;border-radius:999px;font-size:12.5px;font-weight:600;color:hsl(var(--foreground));">' + t + '</span>';
          }).join('') +
        '</div>' +
      '</div>';

    // ─ Certifications (each card opens a full-size, scrollable popup) ─
    var certs = document.createElement('section');
    certs.id = 'lm-about-certs';
    certs.className = 'lm-rv';
    certs.style.cssText = 'padding:clamp(40px,6vw,60px) 0;border-top:1px solid hsl(var(--border)/0.6);';
    certs.innerHTML =
      '<style>' +
        '.lmc-thumb{position:relative;background:linear-gradient(135deg,hsl(var(--muted)/0.5),hsl(var(--card)/0.3));aspect-ratio:16/10;overflow:hidden;}' +
        '.lmc-thumb::before{content:"";position:absolute;inset:0;background-image:repeating-linear-gradient(135deg,hsl(var(--border)/0.3) 0 1px,transparent 1px 13px);}' +
        '.lmc-missing::after{content:attr(data-init);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:3rem;font-weight:700;color:hsl(var(--hero-accent)/0.4);}' +
        '.lmc-card{cursor:pointer;transition:transform .25s ease,box-shadow .25s ease;}' +
        '.lmc-card:hover{transform:translateY(-3px);box-shadow:0 18px 40px -18px hsl(var(--foreground)/0.32);}' +
        '.lmc-view{position:absolute;top:10px;right:10px;z-index:2;padding:5px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:hsl(var(--hero-accent));color:hsl(var(--background));opacity:0;transition:opacity .2s ease;}' +
        '.lmc-card:hover .lmc-view{opacity:1;}' +
      '</style>' +
      '<div class="container mx-auto px-6 lg:px-20 max-w-6xl">' +
        '<div class="flex items-center gap-3 mb-5">' +
          '<span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold" style="background:hsl(var(--hero-accent)/0.14);color:hsl(var(--hero-accent));">\u2713</span>' +
          '<p class="text-xs font-semibold uppercase tracking-widest" style="color:hsl(var(--hero-accent));">Certifications</p>' +
        '</div>' +
        '<h2 class="font-display font-bold leading-tight mb-4 max-w-2xl" style="font-size:clamp(24px,4vw,44px);">The credentials behind the <span style="color:hsl(var(--hero-accent));">work</span>.</h2>' +
        '<p class="text-base text-muted-foreground leading-relaxed max-w-2xl mb-10">Shown newest first. Click any certificate to open it in full — multi-page ones scroll, so you can read every page.</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;">' +
          certList.map(function(c, i){
            return '<div role="button" tabindex="0" class="lm-glass-card lmc-card" data-idx="' + i + '" aria-label="View ' + c.title + ' certificate" style="border-radius:16px;overflow:hidden;">' +
              '<div class="lmc-thumb" data-init="' + c.title.charAt(0) + '">' +
                '<span class="lmc-view">View \u2197</span>' +
                '<img src="' + imgBase + c.pages[0] + '" alt="' + c.title + ' certificate" loading="lazy" decoding="async" ' +
                  'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'lmc-missing\')" ' +
                  'style="width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s ease;" ' +
                  'onmouseover="this.style.transform=\'scale(1.04)\'" onmouseout="this.style.transform=\'scale(1)\'" />' +
              '</div>' +
              '<div style="padding:16px 18px;">' +
                '<h3 style="font-size:14px;font-weight:700;line-height:1.3;color:hsl(var(--foreground));">' + c.title + '</h3>' +
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:5px;">' +
                  '<p style="font-size:12px;color:hsl(var(--muted-foreground));">' + c.sub + '</p>' +
                  (c.year ? '<span style="font-size:11px;font-family:monospace;font-weight:600;color:hsl(var(--hero-accent));flex-shrink:0;">' + c.year + '</span>' : '') +
                '</div>' +
              '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
        matricNote +
      '</div>';

    // ─ Full-screen certificate popup (scrollable, multi-page aware) ─
    var modal = document.createElement('div');
    modal.id = 'lm-cert-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.style.cssText = 'position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:16px;background:hsl(var(--foreground)/0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
    modal.innerHTML =
      '<div class="lmc-panel" style="position:relative;max-width:min(880px,96vw);width:100%;height:min(94vh,900px);display:flex;flex-direction:column;background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:18px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,.55);">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid hsl(var(--border)/0.6);flex-shrink:0;">' +
          '<div style="min-width:0;">' +
            '<h3 id="lm-cert-modal-title" style="font-size:15px;font-weight:700;margin:0;color:hsl(var(--foreground));font-family:inherit;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Certificate</h3>' +
            '<p id="lm-cert-modal-meta" style="font-size:11px;color:hsl(var(--muted-foreground));margin:2px 0 0;"></p>' +
            '<a id="lm-cert-modal-url" href="#" target="_blank" rel="noopener noreferrer" class="btn btn-outline-primary btn-sm mt-1" style="display:none;font-size:11px;">Verify certificate \u2197</a>' +
          '</div>' +
          '<button type="button" id="lm-cert-modal-close" aria-label="Close certificate" style="flex-shrink:0;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid hsl(var(--border));background:hsl(var(--card));color:hsl(var(--foreground));cursor:pointer;font-size:18px;line-height:1;">&times;</button>' +
        '</div>' +
        '<div id="lm-cert-modal-body" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:0;background:hsl(var(--muted)/0.35);"></div>' +
      '</div>';
    document.body.appendChild(modal);

    var modalTitle = modal.querySelector('#lm-cert-modal-title');
    var modalMeta = modal.querySelector('#lm-cert-modal-meta');
    var modalBody = modal.querySelector('#lm-cert-modal-body');
    var modalUrl = modal.querySelector('#lm-cert-modal-url');

    function buildPages(idx) {
      var c = certList[idx];
      var multi = c.pages.length > 1;
      var html = '';
      if (multi) {
        html += '<div style="position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;background:hsl(var(--card)/0.9);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid hsl(var(--border)/0.5);">' +
                '<span id="lm-cert-hint" style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:hsl(var(--muted-foreground));">Scroll to view all ' + c.pages.length + ' pages</span>' +
                '</div>';
      }
      c.pages.forEach(function (src, pi) {
        html += '<figure style="margin:0;padding:' + (multi ? '10px 16px' : '16px') + ';">' +
                  '<img src="' + imgBase + src + '" alt="' + c.title + ' — page ' + (pi + 1) + '" class="lmc-page-img" loading="eager" decoding="async" ' +
                    'onerror="this.parentNode.style.display=\'none\';" ' +
                    'style="display:block;width:100%;max-width:820px;height:auto;margin:0 auto;border-radius:10px;background:#fff;" />' +
                  (multi ? '<figcaption style="text-align:center;font-size:11px;color:hsl(var(--muted-foreground));margin-top:8px;font-family:monospace;">Page ' + (pi + 1) + ' of ' + c.pages.length + '</figcaption>' : '') +
                '</figure>';
      });
      modalBody.innerHTML = html;
      modalBody.scrollTop = 0;
    }

    function openCert(idx) {
      var c = certList[idx];
      if (!c) return;
      buildPages(idx);
      modalTitle.textContent = c.title;
      modalMeta.textContent = c.sub + (c.year ? ' · ' + c.year : '') + (c.pages.length > 1 ? ' · ' + c.pages.length + ' pages' : '');
      if (c.url) { modalUrl.style.display = 'inline-block'; modalUrl.setAttribute('href', c.url); }
      else { modalUrl.style.display = 'none'; modalUrl.removeAttribute('href'); }
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      try { modal.querySelector('#lm-cert-modal-close').focus(); } catch (e) {}
    }
    function closeCert() {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      // Clear heavy multi-page image DOM when closed.
      modalBody.innerHTML = '';
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.id === 'lm-cert-modal-close') closeCert();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.style.display === 'flex') closeCert();
    });

    certs.querySelectorAll('.lmc-card').forEach(function (card) {
      card.addEventListener('click', function () {
        openCert(parseInt(card.getAttribute('data-idx'), 10));
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openCert(parseInt(card.getAttribute('data-idx'), 10));
        }
      });
    });

    anchor.insertAdjacentElement('beforebegin', certs);
    anchor.insertAdjacentElement('beforebegin', skillsBox);
    linked.style.display = 'none';
    linked.setAttribute('data-lm-hidden', '1');
  }


  // ─────────────────────────────────────────────────────────────────────────
  // ABOUT — contact form inside the "Let's connect" section (replaces the
  // three CTA buttons so the form lives right under the heading).
  // ─────────────────────────────────────────────────────────────────────────
  function injectAboutContactForm() {
    var p = stripBase(window.location.pathname);
    if (p.indexOf('about') === -1) return;
    if (document.getElementById('lm-about-connect')) return;
    var h2 = null;
    document.querySelectorAll('h2').forEach(function (h) {
      if (!h2 && (h.textContent || '').replace(/\s+/g, ' ').trim() === "Let's connect") h2 = h;
    });
    if (!h2) return;
    var container = h2.parentElement;
    if (!container) return;

    var wrap = document.createElement('div');
    wrap.id = 'lm-about-connect';
    wrap.style.cssText = 'max-width:560px;margin-top:26px;';
    wrap.innerHTML =
      '<h2 id="lm-about-connect-heading" style="font-size:16px;font-weight:700;margin:0 0 12px;color:hsl(var(--foreground));">Send a message</h2>' +
      '<form id="lm-about-brief-form" style="display:grid;grid-template-columns:1fr;gap:12px;" novalidate>' +
        '<label style="display:block;">' +
          '<span style="display:block;font-size:12px;font-weight:600;color:hsl(var(--muted-foreground));margin-bottom:5px;">Your name *</span>' +
          '<input type="text" name="name" placeholder="Your name" required aria-label="Your name" style="width:100%;background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:12px;padding:11px 14px;font-size:14px;color:hsl(var(--foreground));outline:none;font-family:inherit;box-sizing:border-box;" />' +
        '</label>' +
        '<label style="display:block;">' +
          '<span style="display:block;font-size:12px;font-weight:600;color:hsl(var(--muted-foreground));margin-bottom:5px;">Email *</span>' +
          '<input type="email" name="email" placeholder="you@company.co.za" required aria-label="Email" style="width:100%;background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:12px;padding:11px 14px;font-size:14px;color:hsl(var(--foreground));outline:none;font-family:inherit;box-sizing:border-box;" />' +
        '</label>' +
        '<label style="display:block;">' +
          '<span style="display:block;font-size:12px;font-weight:600;color:hsl(var(--muted-foreground));margin-bottom:5px;">Message *</span>' +
          '<textarea name="message" rows="4" placeholder="What are you building, or what needs fixing?" required aria-label="Message" style="width:100%;background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:12px;padding:11px 14px;font-size:14px;color:hsl(var(--foreground));outline:none;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>' +
        '</label>' +
        '<input type="hidden" name="_subject" value="Portfolio brief from About page" />' +
        '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:4px;">' +
          '<button type="submit" id="lm-about-bf-btn" style="padding:12px 26px;border:none;border-radius:999px;background:hsl(var(--hero-accent));color:hsl(var(--background));font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;transition:transform .2s,box-shadow .2s,opacity .2s;">Send message</button>' +
          '<span style="font-size:12px;color:hsl(var(--muted-foreground));">No lists, no bots.</span>' +
        '</div>' +
        '<p id="lm-about-bf-done" style="display:none;margin:0;color:hsl(var(--hero-accent));font-weight:600;font-size:14px;">\u2705 Message sent \u2014 thank you. I\u2019ll reply within one working day.</p>' +
        '<p id="lm-about-bf-fail" style="display:none;margin:0;color:hsl(0 62% 45%);font-weight:600;font-size:14px;">The wire ate it, sorry. Email me directly: <a href="mailto:' + CONFIG.newEmail + '" style="color:inherit;">' + CONFIG.newEmail + '</a></p>' +
        '<p style="font-size:13px;color:hsl(var(--muted-foreground));margin:10px 0 0;">Straight to my inbox — I reply within one working day.</p>' +
      '</form>' +
      '<div id="lm-about-other-links" style="margin-top:32px;padding-top:20px;border-top:1px dashed hsl(var(--border));">' +
        '<p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:hsl(var(--muted-foreground));margin:0 0 12px;">Prefer to talk first?</p>' +
      '</div>';

    // Place the form right under the intro line, and park the quick links
    // (book a call / LinkedIn / resume) in their own, clearly separated row
    // beneath it — so "Send message" never reads as attached to "Book a call".
    var btnRow = null;
    Array.prototype.forEach.call(container.children, function (ch) {
      if (ch === h2) return;
      if (!btnRow && ch.tagName === 'DIV' && ch.querySelectorAll('a').length >= 2 &&
          !ch.querySelector('p, h1, h2, h3, form, textarea')) {
        btnRow = ch;
      }
    });
    var otherLinks = wrap.querySelector('#lm-about-other-links');
    if (btnRow) {
      container.insertBefore(wrap, btnRow);
      if (otherLinks) { otherLinks.appendChild(btnRow); }
    }
    else { container.appendChild(wrap); }

    var form = wrap.querySelector('#lm-about-brief-form');
    var btn = wrap.querySelector('#lm-about-bf-btn');
    var done = wrap.querySelector('#lm-about-bf-done');
    var fail = wrap.querySelector('#lm-about-bf-fail');

    form.querySelectorAll('input:not([type=hidden]),textarea').forEach(function (el) {
      el.addEventListener('focus', function () {
        el.style.borderColor = 'hsl(var(--hero-accent))';
        el.style.boxShadow = '0 0 0 3px hsl(var(--hero-accent)/0.14)';
      });
      el.addEventListener('blur', function () {
        el.style.borderColor = 'hsl(var(--border))';
        el.style.boxShadow = 'none';
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      fail.style.display = 'none';
      done.style.display = 'none';
      var name = form.querySelector('[name="name"]');
      var mail = form.querySelector('[name="email"]');
      var msg = form.querySelector('[name="message"]');
      if (!name.value.trim() || !/.+@.+\..+/.test(mail.value) || !msg.value.trim()) {
        [name, mail, msg].forEach(function (el) {
          if (!el.value.trim() || (el === mail && !/.+@.+\..+/.test(el.value))) {
            el.style.borderColor = 'hsl(var(--hero-accent))';
          }
        });
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sending\u2026';
      btn.style.opacity = '0.7';
      fetch(SET.formspree || 'https://formspree.io/f/mknadbag', {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (r) {
        if (r.ok) {
          form.style.display = 'none';
          done.style.display = 'block';
        } else {
          btn.disabled = false;
          btn.textContent = 'Send message';
          btn.style.opacity = '1';
          fail.style.display = 'block';
        }
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = 'Send message';
        btn.style.opacity = '1';
        fail.style.display = 'block';
      });
    });
  }
  // ─────────────────────────────────────────────────────────────────────────
  // SERVICES: remove Logistics sector card, collapse whitespace
  // ─────────────────────────────────────────────────────────────────────────
  function fixServices() {
    var here = stripBase(window.location.pathname);
    if (here.indexOf('services') === -1) return;

    // Remove Logistics/Supply Chain card
    document.querySelectorAll('h3').forEach(function (h) {
      var txt = (h.textContent || '');
      if (txt.indexOf('Logistics') > -1 || txt.indexOf('Supply Chain') > -1) {
        var card = h.closest('[class*="p-6"],[class*="rounded"],[class*="card"],li,div');
        if (card && card !== document.body) {
          card.style.display = 'none';
          card.setAttribute('data-lm-removed', '1');
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SERVICES: industries section (injected after FAQ/footer)
  // ─────────────────────────────────────────────────────────────────────────
  function renderServicesIndustries() {
    var here = window.location.pathname;
    if (here.indexOf('services') === -1) return;
    if (document.getElementById('lm-services-industries')) return;
    var faq = document.getElementById('services-faq') ||
              document.querySelector('section[id*="faq"]') ||
              document.querySelector('footer');
    if (!faq) return;

    var sec = document.createElement('section');
    sec.id = 'lm-services-industries';
    sec.className = 'py-20 lg:py-28 border-t border-border scroll-mt-20';
    sec.innerHTML =
      '<div class="container mx-auto px-6 lg:px-20 max-w-6xl">' +
        '<div class="mb-12">' +
          '<p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color:hsl(var(--hero-accent));">Sector Experience</p>' +
          '<h2 class="font-display font-bold leading-tight max-w-2xl" style="font-size:clamp(24px,4vw,44px);">Industries with direct delivery experience.</h2>' +
          '<p class="text-muted-foreground mt-4 max-w-2xl leading-relaxed">Working digital products, brand platforms and operational systems shipped across South Africa.</p>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;">' +
          iCard('&#x1F697;','Automotive &amp; Mobility','Subscription portals, connected car companion apps, and verified vehicle discovery.') +
          iCard('&#x1F4F6;','Telecoms &amp; Enterprise IT','Employee engagement platforms, internal search architectures, and enterprise tooling.') +
          iCard('&#x1F354;','Food, Hospitality &amp; QSR','Low-data mobile ordering PWAs, digital menus, kitchen operational flows, and culinary landmarks.') +
          iCard('&#x2696;&#xFE0F;','Legal Tech &amp; Search','Case law indexing, precedent discovery, and intelligent legal research interfaces.') +
          iCard('&#x1FA7A;','Healthcare &amp; Pharma','Digital health workflows, patient education tools, and medical communications.') +
          iCard('&#x26A1;','Energy &amp; Industrial','Corporate systems, operational dashboards, and industrial brand touchpoints.') +
          iCard('&#x1F3DB;&#xFE0F;','Civic Tech &amp; Public Sector','Public governance portals, community platforms, and citizen-facing services.') +
          iCard('&#x1F4BC;','Professional Services &amp; B2B','High-converting agency and consulting sites, proposal workflows, and CRM pipeline automation.') +
          iCard('&#x1F6E1;&#xFE0F;','Asset Verification &amp; Escrow','Escrow locks, proof-of-funds verification, and fraud prevention for high-value peer transactions.') +
          iCard('&#x1F5A5;&#xFE0F;','ICT Services &amp; Digital Transformation','Enterprise ICT advisory, managed-service rollouts, automation and workforce-solution platforms.') +
          iCard('&#x1F9E9;','Software Development','Product-grade software designed and built end to end — PWAs, web apps and dashboards, with CRM and API integrations.') +
          iCard('&#x1F3E6;','Financial Services &amp; Fintech','Customer apps, onboarding flows and reporting for banking teams — built for regulated, high-trust environments.') +
        '</div>' +
      '</div>';
    faq.parentElement.insertBefore(sec, faq);
  }

  function iCard(icon, h, p) {
    return '<div class="lm-glass-card" style="padding:22px;border-radius:16px;">' +
      '<div style="width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:14px;background:hsl(var(--hero-accent)/0.12);">' + icon + '</div>' +
      '<h3 style="font-size:16px;font-weight:700;margin-bottom:7px;">' + h + '</h3>' +
      '<p style="font-size:13px;color:hsl(var(--muted-foreground));line-height:1.6;">' + p + '</p>' +
    '</div>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BALANCE OFFERING — home + services cluster E
  // ─────────────────────────────────────────────────────────────────────────
  function balanceOffering() {
    if (document.getElementById('lm-area-frontend')) return;
    var here = stripBase(window.location.pathname);
    var onHome = (here === '/' || here === '' || here === '/index.html');

    var lastRow = onHome ? document.querySelector('a[href*="/website-design-conversion"]') : null;
    if (lastRow && lastRow.parentElement) {
      var row = document.createElement('a');
      row.id = 'lm-area-frontend';
      row.className = 'relative block w-full lm-rv';
      row.setAttribute('href', GH_BASE + '/frontend-development');
      row.innerHTML =
        '<div class="container mx-auto px-6 lg:px-20 max-w-6xl">' +
          '<div class="flex items-center gap-6 lg:gap-12 py-7 lg:py-9">' +
            '<div class="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-black font-mono" style="color:hsl(var(--muted-foreground));border:1.5px solid hsl(var(--border));">05</div>' +
            '<div class="flex-1 min-w-0">' +
              '<h3 class="font-display font-bold text-xl lg:text-2xl xl:text-3xl leading-tight tracking-tight text-foreground">Frontend Engineering &amp; AI Integration</h3>' +
              '<p class="text-sm text-muted-foreground mt-1">The person who designs it builds it. Production front-end code — PWAs, web apps, dashboards — wired into your CRM and APIs.</p>' +
            '</div>' +
            '<div class="shrink-0 w-9 h-9 rounded-full border flex items-center justify-center" style="border-color:hsl(var(--border));color:hsl(var(--muted-foreground));"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></div>' +
          '</div>' +
        '</div>';
      lastRow.insertAdjacentElement('afterend', row);
    }

    if (onHome && !document.getElementById('lm-work-note')) {
      document.querySelectorAll('h2').forEach(function (h) {
        if ((h.textContent || '').trim() === 'Selected Work') {
          var note = document.createElement('p');
          note.id = 'lm-work-note';
          note.className = 'text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mt-4 lm-rv';
          note.style.display = 'none'; // dupe copy removed \u2014 the limited-edition line now carries this
          h.insertAdjacentElement('afterend', note);
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LEXARK → LulaGazette
  // ─────────────────────────────────────────────────────────────────────────
  var GAZETTE_URL = GH_BASE + '/project/lula-gazette/';

  function relabelLexark() {
    if (window.location.pathname.indexOf('lexark') > -1 &&
        window.location.pathname.indexOf('lula-gazette') === -1) {
      window.location.replace(GAZETTE_URL);
      return;
    }
    document.querySelectorAll('a[href*="lexark"]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href.indexOf('lexark.org') > -1) return;
      if (a.getAttribute('href') !== GAZETTE_URL) a.setAttribute('href', GAZETTE_URL);
    });
    document.querySelectorAll('h1,h2,h3,h4,p,span,div,a,button').forEach(function (el) {
      if ((el.textContent || '').indexOf('Lexark') === -1) return;
      if (el.children && el.children.length) return;
      var t = el.textContent;
      t = t.replace(/Lexark Legal Search/g, 'LulaGazette \u2014 Legal Resource Search Engine');
      t = t.replace(/Lexark/g, 'LulaGazette');
      if (el.textContent !== t) el.textContent = t;
    });
    // "Coming soon" badge on cards
    document.querySelectorAll('a[href*="lula-gazette"],a[href*="lexark"]').forEach(function (card) {
      if (!card.querySelector('img')) return;
      if (card.querySelector('.lm-cs-badge')) return;
      var b = document.createElement('span');
      b.className = 'lm-cs-badge';
      b.textContent = 'Coming Soon';
      b.style.cssText = 'position:absolute;top:12px;left:12px;z-index:20;background:hsl(var(--hero-accent));' +
        'color:hsl(var(--background));font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
        'padding:4px 10px;border-radius:999px;';
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      card.appendChild(b);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NDA CARDS
  // ─────────────────────────────────────────────────────────────────────────
  function handleNdaCards() {
    NDA_PROJECTS.forEach(function (slug) {
      document.querySelectorAll('a[href*="' + slug + '"]').forEach(function (card) {
        card.removeAttribute('href');
        card.style.cursor = 'default';
        card.style.pointerEvents = 'none';
        if (!card.querySelector('.lm-nda-b')) {
          var b = document.createElement('span');
          b.className = 'lm-nda-b';
          b.textContent = 'NDA — Protected';
          b.style.cssText = 'position:absolute;top:12px;right:12px;z-index:20;' +
            'background:hsl(var(--foreground)/.75);color:hsl(var(--background));' +
            'font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;' +
            'padding:4px 10px;border-radius:999px;';
          if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
          card.appendChild(b);
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REDIRECT CARDS → direct apps
  // ─────────────────────────────────────────────────────────────────────────
  function fixInternalLinks() {
    document.querySelectorAll('a[target="_blank"]').forEach(function (a) {
      var href = stripBase(a.getAttribute('href') || '');
      for (var id in DIRECT_REDIRECT_APPS) { if (href.indexOf(id) > -1) return; }
      if (/^\/(project|product-design|website-design|microfinance|brand-strategy|frontend-development|services|about|contact)/.test(href)) {
        a.removeAttribute('target'); a.removeAttribute('rel');
      }
    });
  }

  function flagRedirectCards() {
    if (!document.getElementById('lm-ext-badge-style')) {
      var bs = document.createElement('style');
      bs.id = 'lm-ext-badge-style';
      bs.textContent =
        '.lm-ext-badge{position:absolute;top:14px;right:14px;z-index:6;display:inline-flex;align-items:center;gap:5px;' +
        'padding:6px 12px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;' +
        'background:rgba(255,255,255,.94);color:#141417;border:1px solid rgba(0,0,0,.14);' +
        'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 4px 16px rgba(0,0,0,.16);pointer-events:none;}' +
        '.lm-ext-badge .lm-ext-ico{font-size:11px;line-height:1;}';
      document.head.appendChild(bs);
    }
    function tagExternal(card) {
      card.setAttribute('target', '_blank');
      card.setAttribute('rel', 'noopener noreferrer');
      card.setAttribute('title', 'External link \u2014 opens in a new tab');
      if (!card.querySelector('.lm-ext-badge')) {
        if (!card.style.position) card.style.position = 'relative';
        var b = document.createElement('span');
        b.className = 'lm-ext-badge';
        b.innerHTML = '<span class="lm-ext-ico">\u2197</span> External \u00b7 Opens a new tab';
        card.appendChild(b);
      }
    }
    document.querySelectorAll('a[href]').forEach(function (card) {
      var href = card.getAttribute('href') || '';
      for (var id in DIRECT_REDIRECT_APPS) {
        if (href.indexOf('/project/' + id) > -1 || href.indexOf('/graphic/' + id) > -1) {
          card.setAttribute('href', DIRECT_REDIRECT_APPS[id]);
          tagExternal(card);
        }
      }
      // Any other work card that links straight out (Figma, Notion, live apps)
      // gets the same tag so visitors know it leaves the portfolio.
      href = card.getAttribute('href') || '';
      if (/^https?:\/\//.test(href) && card.querySelector('img') && !card.querySelector('.lm-ext-badge')) {
        tagExternal(card);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // "LIMITED EDITION" note under every Selected work(s)/builds heading
  // ─────────────────────────────────────────────────────────────────────────
  function limitedEditionPass() {
    // Heads covered: "Selected Work" (home), "Selected work" (expertise pages),
    // "Selected works"/"Selected builds" (service pages). The wording follows
    // where the visitor is standing instead of repeating one line everywhere.
    var HEADS = /^(selected works?|selected builds?)$/i;
    var notes = {
      home: 'The racks are fuller than this page. This is the limited-edition view \u2014 a few shelves, not the whole warehouse. The full run, including the NDA work, sits just off-camera. I\u2019m not limited to what you see here.',
      services: 'This page is an edit, not the inventory. The limited-edition cut fits here; the full catalogue \u2014 more products, the NDA work, the ones that never made it to a case study \u2014 comes out in conversation. I\u2019m not limited to what you see.',
      project: 'You\u2019re looking at one piece of a longer run. This is the limited-edition view of what I publish \u2014 the full catalogue is much longer, and I\u2019m not limited to what fits on a page.'
    };
    document.querySelectorAll('h2').forEach(function (h) {
      var t = (h.textContent || '').replace(/\s+/g, ' ').trim();
      if (!HEADS.test(t)) return;
      var here = stripBase(window.location.pathname) || '';
      var scope = here.indexOf('/project/') > -1
        ? 'project'
        : ((here === '/' || here === '' || here === '/index.html') ? 'home' : 'services');
      var next = h.nextElementSibling;
      if (next && next.classList && next.classList.contains('lm-limited-note')) return;
      var p = document.createElement('p');
      p.className = 'lm-limited-note';
      p.style.cssText = 'margin:10px 0 34px;font-size:13px;line-height:1.65;font-style:italic;' +
        'color:hsl(var(--muted-foreground));border-left:2px solid hsl(var(--hero-accent)/0.55);' +
        'padding-left:12px;max-width:620px;';
      p.textContent = notes[scope];
      h.insertAdjacentElement('afterend', p);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIVE LINKS on case study pages
  // ─────────────────────────────────────────────────────────────────────────
  function enhanceCaseStudyLiveLinks() {
    var path = window.location.pathname;
    if (path.indexOf('foodiezone') > -1) return;
    for (var id in LIVE_STUDY_URLS) {
      if (path.indexOf(id) > -1) {
        var info = LIVE_STUDY_URLS[id];
        var h1 = document.querySelector('h1');
        if (h1 && !document.getElementById('lm-live-' + id)) {
          var container = h1.parentElement;
          if (container && !container.querySelector('.lm-live-btn')) {
            var row = document.createElement('div');
            row.id = 'lm-live-' + id;
            row.className = 'lm-live-btn';
            row.style.cssText = 'margin-top:22px;display:flex;flex-wrap:wrap;align-items:center;gap:14px;';
            row.innerHTML =
              '<a href="' + info.url + '" target="_blank" rel="noopener noreferrer" ' +
                'style="display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border-radius:999px;' +
                'background:hsl(var(--primary));color:hsl(var(--primary-foreground));font-size:14px;font-weight:600;' +
                'text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.14);">' +
                info.label + ' <span>\u2197</span>' +
              '</a>';
            container.appendChild(row);
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRUSTSHIELD WIP badge
  // ─────────────────────────────────────────────────────────────────────────
  function trustshieldStatus() {
    var p = stripBase(window.location.pathname);
    if (p.indexOf('lula-trustshield') > -1 && !document.getElementById('lm-ts-wip')) {
      var h1 = document.querySelector('h1');
      if (h1) {
        var wrap = document.createElement('div');
        wrap.id = 'lm-ts-wip';
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 16px;';
        wrap.innerHTML =
          '<span style="display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:999px;' +
            'background:hsl(var(--hero-accent)/0.14);color:hsl(var(--hero-accent));font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">' +
            '<span style="width:7px;height:7px;border-radius:50%;background:currentColor;"></span>Work in progress</span>' +
          '<a href="' + (SET.trustshieldFigma || 'https://www.figma.com/design/z28iI0zJV1u1cL1wQ4HMrx/Lula-Fig-Studio?node-id=0-1') + '" target="_blank" rel="noopener noreferrer" ' +
            'style="padding:6px 14px;border-radius:999px;border:1px solid hsl(var(--border));font-size:12px;font-weight:600;text-decoration:none;color:hsl(var(--muted-foreground));">Design files \u2197</a>';
        h1.parentElement.insertBefore(wrap, h1);
      }
    }
    document.querySelectorAll('a[href*="lula-trustshield"]').forEach(function (card) {
      if (card.querySelector('.lm-wip-b') || !card.querySelector('img')) return;
      var b = document.createElement('span');
      b.className = 'lm-wip-b';
      b.textContent = 'Work in progress';
      b.style.cssText = 'position:absolute;top:14px;right:14px;z-index:20;background:hsl(var(--hero-accent));' +
        'color:hsl(var(--background));font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;' +
        'padding:5px 11px;border-radius:999px;';
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      card.appendChild(b);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONTACT FORMS
  // ─────────────────────────────────────────────────────────────────────────
  // (v30) The React contact form already POSTs to Formspree. The old injected
  // duplicate and the form-hijacker below are retired so the "Send a message"
  // tab on /contact is the single source of truth.
  function contactFormspree() {
    return;
    if (document.getElementById('lm-contact-form')) return;
    var footer = document.querySelector('footer');
    if (!footer) return;
    var sec = document.createElement('section');
    sec.id = 'lm-contact-form';
    sec.className = 'py-20 lg:py-28 border-t lm-rv';
    sec.style.borderColor = 'hsl(var(--border)/0.6)';
    sec.innerHTML =
      '<div class="container mx-auto px-6 lg:px-20 max-w-4xl">' +
        '<p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color:hsl(var(--hero-accent));">Send a brief</p>' +
        '<h2 class="font-display font-bold leading-tight mb-4" style="font-size:clamp(24px,4vw,48px);">Tell me what you\'re building.</h2>' +
        '<p class="text-base text-muted-foreground leading-relaxed max-w-2xl mb-8">A paragraph is plenty. I reply within one working day.</p>' +
        '<form id="lm-brief-form" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;" novalidate>' +
          cFld('Your name','name','text','Naledi Dlamini',true) +
          cFld('Email','email','email','you@company.co.za',true) +
          cFld('Company (optional)','company','text','Company or practice',false) +
          cFld('What do you need?','topic','text','Website, product design, PWA, CRM…',false) +
          '<div style="grid-column:1/-1;">' + cFld('The brief','message','textarea','What exists today, what should exist in 3 months, and what is in the way.',true) + '</div>' +
          '<div style="grid-column:1/-1;display:flex;flex-wrap:wrap;align-items:center;gap:14px;">' +
            '<input type="submit" value="Send message" id="lm-bf-btn" style="padding:13px 28px;border:none;border-radius:999px;background:hsl(var(--hero-accent));color:hsl(var(--background));font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;transition:transform .2s,box-shadow .2s,opacity .2s;" />' +
            '<span style="font-size:12px;color:hsl(var(--muted-foreground));">Straight to my inbox. No lists, no bots.</span>' +
          '</div>' +
          '<input type="hidden" name="_subject" value="Portfolio brief" />' +
          '<p id="lm-bf-done" style="grid-column:1/-1;display:none;color:hsl(var(--hero-accent));font-weight:600;font-size:15px;">\u2705 Message sent \u2014 thank you. I\'ll reply within one working day.</p>' +
          '<p id="lm-bf-fail" style="grid-column:1/-1;display:none;color:hsl(0 62% 45%);font-weight:600;">The wire ate it, sorry. Email me: <a href="mailto:mkhungela.l@gmail.com" style="color:inherit;">mkhungela.l@gmail.com</a></p>' +
        '</form>' +
      '</div>';
    footer.parentElement.insertBefore(sec, footer);

    var form = sec.querySelector('#lm-brief-form');
    var btn  = sec.querySelector('#lm-bf-btn');
    var inputSty = 'width:100%;background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:12px;padding:11px 14px;font-size:14px;color:hsl(var(--foreground));outline:none;transition:border-color .2s,box-shadow .2s;font-family:inherit;';
    form.querySelectorAll('input:not([type=submit]):not([type=hidden]),textarea').forEach(function(el){
      el.style.cssText += inputSty;
      el.addEventListener('focus',function(){el.style.borderColor='hsl(var(--hero-accent))';el.style.boxShadow='0 0 0 3px hsl(var(--hero-accent)/0.14)';});
      el.addEventListener('blur',function(){el.style.borderColor='hsl(var(--border))';el.style.boxShadow='none';});
    });
    btn.addEventListener('mouseenter',function(){btn.style.transform='translateY(-2px)';btn.style.boxShadow='0 10px 26px -10px hsl(var(--hero-accent)/.65)';});
    btn.addEventListener('mouseleave',function(){btn.style.transform='none';btn.style.boxShadow='none';});

    form.addEventListener('submit',function(e){
      e.preventDefault();
      var done=sec.querySelector('#lm-bf-done');
      var fail=sec.querySelector('#lm-bf-fail');
      var n=form.querySelector('[name="name"]');
      var m=form.querySelector('[name="email"]');
      var mg=form.querySelector('[name="message"]');
      fail.style.display='none';
      if(!n.value.trim()||!m.value.trim()||!/.+@.+\..+/.test(m.value)||!mg.value.trim()){
        [n,m,mg].forEach(function(el){if(!el.value.trim()||(el===m&&!/.+@.+\..+/.test(el.value)))el.style.borderColor='hsl(var(--hero-accent))';});
        return;
      }
      btn.disabled=true;btn.value='Sending\u2026';btn.style.opacity='0.7';
      fetch(SET.formspree||'https://formspree.io/f/mknadbag',{
        method:'POST',body:new FormData(form),headers:{Accept:'application/json'}
      }).then(function(r){
        if(r.ok){form.style.display='none';done.style.display='block';}
        else{btn.disabled=false;btn.value='Send message';btn.style.opacity='1';fail.style.display='block';}
      }).catch(function(){btn.disabled=false;btn.value='Send message';btn.style.opacity='1';fail.style.display='block';});
    });

    function cFld(lbl,nm,tp,ph,req){
      var id='lm-cf-'+nm;
      var label='<label for="'+id+'" style="display:block;font-size:12px;font-weight:600;color:hsl(var(--muted-foreground));margin-bottom:5px;">'+lbl+(req?' *':'')+'</label>';
      if(tp==='textarea') return '<div style="grid-column:1/-1;">'+label+'<textarea id="'+id+'" name="'+nm+'" rows="5" placeholder="'+ph+'"'+(req?' required':'')+'></textarea></div>';
      return '<div>'+label+'<input id="'+id+'" type="'+tp+'" name="'+nm+'" placeholder="'+ph+'"'+(req?' required':'')+'></div>';
    }
  }

  function fixContactForm() {
    // (v30) Retired: the React contact form now posts straight to Formspree.
    return;
    var form=null,sendBtn=null;
    document.querySelectorAll('form').forEach(function(f){
      var b=f.querySelector('button[type="submit"],input[type="submit"]');
      if(b&&(b.textContent||b.value||'').indexOf('Send message')>-1){form=f;sendBtn=b;}
    });
    if(!form||form.hasAttribute('data-lm-fixed')) return;
    form.setAttribute('data-lm-fixed','1');
    var panel=document.createElement('div');
    panel.id='lm-cf-panel';
    panel.style.cssText='display:none;margin-bottom:16px;padding:16px 18px;border-radius:14px;border:1px solid hsl(var(--hero-accent)/0.35);background:hsl(var(--hero-accent)/0.07);font-size:14px;line-height:1.6;';
    form.parentElement.insertBefore(panel,form);
    function show(h,t){
      panel.style.borderColor=t==='fail'?'hsl(0 62% 45%/.4)':'hsl(var(--hero-accent)/0.35)';
      panel.style.background=t==='fail'?'hsl(0 62% 45%/.07)':'hsl(var(--hero-accent)/0.07)';
      panel.innerHTML=h;panel.style.display='block';
    }
    function rst(){panel.style.display='none';panel.innerHTML='';}
    function restBtn(){if(!sendBtn)return;sendBtn.disabled=false;if(sendBtn.textContent)sendBtn.textContent='Send message';}
    form.addEventListener('submit',function(e){
      e.preventDefault();e.stopImmediatePropagation();rst();
      var nameEl=form.querySelector('#name'),mailEl=form.querySelector('#email'),msgEl=form.querySelector('#message');
      var topicEl=form.querySelector('#lookingFor');
      var name=nameEl?nameEl.value.trim():'',mail=mailEl?mailEl.value.trim():'',msg=msgEl?msgEl.value.trim():'';
      var topic=topicEl?(topicEl.value||'').trim():'';
      if(!name||!mail||!msg){show('Add your <strong>name</strong>, <strong>email</strong> and <strong>message</strong> first.','fail');return;}
      if(!/.+@.+\..+/.test(mail)){show('That email doesn\'t look right — check and try again.','fail');return;}
      var fd=new FormData();fd.append('name',name);fd.append('email',mail);
      if(topic)fd.append('looking for',topic);
      fd.append('message',msg);fd.append('_subject','Portfolio enquiry from '+name);
      if(sendBtn){sendBtn.disabled=true;if(sendBtn.textContent)sendBtn.textContent='Sending\u2026';}
      show('Sending your message\u2026','ok');
      fetch(SET.formspree||'https://formspree.io/f/mknadbag',{method:'POST',body:fd,headers:{Accept:'application/json'}})
        .then(function(r){
          if(!r.ok)throw new Error('err');
          form.style.display='none';
          show('\u2705 <strong>Message sent \u2014 thank you.</strong><br>It has landed in my inbox. I\'ll reply within one working day.<br><br><a href="mailto:'+CONFIG.newEmail+'" style="font-weight:600;color:hsl(var(--hero-accent));">Email me directly</a> if it\'s urgent.','ok');
          restBtn();
        }).catch(function(){
          restBtn();
          show('The wire ate it \u2014 email me directly:<br><br><a href="mailto:'+CONFIG.newEmail+'?subject='+encodeURIComponent('Portfolio enquiry from '+name)+'&body='+encodeURIComponent(msg)+'" style="display:inline-block;margin-top:6px;padding:9px 20px;border-radius:999px;background:hsl(var(--hero-accent));color:hsl(var(--background));font-weight:700;text-decoration:none;">Open in email app \u2192 '+CONFIG.newEmail+'</a>','fail');
        });
      return false;
    },true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MIDNIGHT EASTER EGG
  // ─────────────────────────────────────────────────────────────────────────
  function checkMidnight() {
    var h = new Date().getHours();
    if (h !== 0 && h !== 1 && h !== 23) return;
    if (document.getElementById('lm-midnight-egg')) return;
    var msgs = [
      '\uD83C\uDF19 Midnight Mode. Lula is probably pushing pixels in the dark. Close the laptop and get some sleep!',
      '\uD83E\uDD89 Still up? Bold move. The designer is awake too. Just saying.',
      '\uD83C\uDF03 Midnight portfolio browsing? Lula approves. Also: book a call while you\'re here.',
      '\uD83C\uDF55 It\'s midnight \u2014 either you\'re debugging or ordering pizza. Lula is doing both.',
      '\uD83D\uDE34 The responsible thing is sleep. The designer thing is to keep scrolling. Your call.',
      '\uD83D\uDD26 Dark hours, great ideas. Hit that Book a Call button before you fall asleep.'
    ];
    var egg = document.createElement('div');
    egg.id = 'lm-midnight-egg';
    egg.style.cssText = 'text-align:center;padding:13px 16px;font-size:12px;color:hsl(var(--hero-accent));font-family:monospace;border-top:1px dashed hsl(var(--border));opacity:.85;cursor:pointer;';
    egg.textContent = msgs[Math.floor(Math.random() * msgs.length)];
    egg.addEventListener('click', function(){egg.style.opacity='0';setTimeout(function(){egg.remove();},300);});
    document.body.appendChild(egg);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COPY PROTECTION
  // ─────────────────────────────────────────────────────────────────────────
  function protectContent() {
    if (SET.copyProtection === false) return;
    if (document.getElementById('lm-prot-style')) return;
    var s = document.createElement('style');
    s.id = 'lm-prot-style';
    s.textContent = 'body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}input,textarea,select,[contenteditable="true"]{-webkit-user-select:text;user-select:text;}img{-webkit-user-drag:none;}html,body{overflow-x:hidden;}';
    document.head.appendChild(s);
    var allowed = function(el){ if(!el||!el.tagName)return false; var t=el.tagName.toUpperCase(); return t==='INPUT'||t==='TEXTAREA'||t==='SELECT'||el.isContentEditable; };
    document.addEventListener('copy',function(e){if(!allowed(e.target))e.preventDefault();},true);
    document.addEventListener('cut',function(e){if(!allowed(e.target))e.preventDefault();},true);
    document.addEventListener('contextmenu',function(e){if(!allowed(e.target))e.preventDefault();},true);
    document.addEventListener('selectstart',function(e){if(!allowed(e.target))e.preventDefault();},true);
    document.addEventListener('dragstart',function(e){if(e.target&&e.target.tagName==='IMG')e.preventDefault();},true);
    document.addEventListener('keydown',function(e){
      if(!(e.ctrlKey||e.metaKey))return;
      var k=(e.key||'').toLowerCase();
      if(!allowed(e.target)&&(k==='c'||k==='x'||k==='a'))e.preventDefault();
    },true);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PERFORMANCE + ANIMATION
  // ─────────────────────────────────────────────────────────────────────────
  function perfPass() {
    document.querySelectorAll('img').forEach(function(img){
      if(img.closest('header'))return;
      if(!img.getAttribute('loading'))img.loading='lazy';
      if(!img.getAttribute('decoding'))img.decoding='async';
    });
  }

  function animPass() {
    if (!document.getElementById('lm-anim-style')) {
      var s = document.createElement('style');
      s.id = 'lm-anim-style';
      s.textContent =
        '.lm-rv{opacity:0;transform:translateY(14px);transition:opacity .65s ease,transform .65s ease;}\n' +
        '.lm-rv.in{opacity:1;transform:none;}\n' +
        '.lm-lift{transition:transform .25s ease,box-shadow .25s ease;}\n' +
        '.lm-lift:hover{transform:translateY(-3px);box-shadow:0 18px 40px -18px hsl(var(--foreground)/0.32);}\n' +
        '@media(prefers-reduced-motion:reduce){.lm-rv{opacity:1;transform:none;transition:none}.lm-lift:hover{transform:none}}';
      document.head.appendChild(s);
    }
    var els = document.querySelectorAll('.lm-rv:not(.in)');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function(el){el.classList.add('in');});
      return;
    }
    // One persistent observer. React commits its DOM after DOMContentLoaded,
    // so content this patch injects (About certs/quotes, services industries,
    // contact form) lands on a LATER pass than the first. A one-time observer
    // would never see it and it would stay opacity:0 forever — so we observe
    // any not-yet-revealed element on every pass (observe is idempotent).
    if (!window.__lmIO) {
      window.__lmIO = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if(en.isIntersecting){en.target.classList.add('in');window.__lmIO.unobserve(en.target);}
        });
      },{threshold:0.08});
    }
    els.forEach(function(el){window.__lmIO.observe(el);});
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TESTIMONIALS REMOVAL (old homepage carousel)
  // ─────────────────────────────────────────────────────────────────────────
  function removeTestimonials() {
    document.querySelectorAll('section').forEach(function(sec){
      if((sec.textContent||'').indexOf('Quiet confidence')>-1){
        var here = stripBase(window.location.pathname) || '';
        if (here.indexOf('about') === -1) {
          sec.style.display = 'none';
          sec.setAttribute('data-lm-hidden', '1');
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MISC: dedup social, favicon, back-to-top, profile pic, brands
  // ─────────────────────────────────────────────────────────────────────────
  function dedupeSocial() {
    var seen={};
    document.querySelectorAll('a[href*="linkedin.com"]').forEach(function(a){
      var lbl=(a.textContent||'').trim();
      if(lbl!=='LinkedIn')return;
      if(seen[lbl]){a.style.display='none';}else{seen[lbl]=true;}
    });
  }

  function ensureFavicon() {
    var u=(GH_BASE||'')+'/favicon.webp?v=2';
    document.querySelectorAll('link[rel*="icon"]').forEach(function(l){
      if((l.getAttribute('href')||'').indexOf('favicon')>-1&&l.getAttribute('href')!==u){
        l.setAttribute('href',u);l.setAttribute('type','image/webp');
      }
    });
  }

  function ensureLogosColors() {
    if(document.getElementById('lm-logo-sty'))return;
    var s=document.createElement('style');
    s.id='lm-logo-sty';
    s.textContent='.lm-marquee-pill,[class*="animate-marquee"] .lm-marquee-pill{background:#fff !important;border:1px solid rgba(0,0,0,.08) !important;border-radius:12px !important;}'+
      '.animate-marquee-left img,.animate-marquee-right img,[class*="animate-marquee"] img,.lm-marquee-pill img{filter:none !important;opacity:1 !important;}';
    document.head.appendChild(s);
  }

  function initBackToTop() {
    if(document.getElementById('lm-btt'))return;
    var btn=document.createElement('button');
    btn.id='lm-btt';
    btn.setAttribute('aria-label','Back to top');
    btn.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';
    btn.style.cssText='position:fixed;right:22px;bottom:76px;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:65;background:hsl(var(--foreground)/.88);color:hsl(var(--background));border:1px solid hsl(var(--border)/.5);box-shadow:0 4px 18px -4px hsl(var(--foreground)/.3);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);cursor:pointer;opacity:0;pointer-events:none;transform:translateY(8px) scale(.95);transition:opacity .22s ease,transform .22s ease,background-color .2s;';
    if(!document.getElementById('lm-btt-sty')){
      var s=document.createElement('style');
      s.id='lm-btt-sty';
      s.textContent='@media(max-width:639px){#lm-btt{bottom:140px !important;right:18px !important;}}#lm-btt:hover{transform:translateY(0) scale(1.08) !important;opacity:1 !important;background:hsl(var(--hero-accent)) !important;color:#000 !important;}';
      document.head.appendChild(s);
    }
    btn.addEventListener('click',function(e){e.preventDefault();window.scrollTo({top:0,behavior:'smooth'});});
    function upd(){var t=window.pageYOffset||0;if(t>110){btn.style.opacity='1';btn.style.pointerEvents='auto';btn.style.transform='translateY(0) scale(1)';}else{btn.style.opacity='0';btn.style.pointerEvents='none';btn.style.transform='translateY(8px) scale(.95)';}}
    window.addEventListener('scroll',upd,{passive:true});
    document.body.appendChild(btn);upd();
  }

  function applyEdits() {
    if(!EDITS)return;
    try{
      (EDITS.text||[]).forEach(function(rule){
        if(!rule||!rule.find||rule.__done)return;
        var hit=false;
        document.querySelectorAll('h1,h2,h3,h4,p,span,li,div,a,button').forEach(function(el){
          if(el.children.length)return;
          var v=el.textContent;
          if(v&&v.indexOf(rule.find)>-1){el.textContent=v.split(rule.find).join(rule.replace);hit=true;}
        });
        if(hit)rule.__done=true;
      });
    }catch(e){}
  }

  function replaceTextNode(node) {
    if(!node||node.nodeType!==3)return;
    var v=node.nodeValue;if(!v||!v.trim())return;
    var o=v;
    if(v.indexOf('Anywhere Remote')>-1&&v.indexOf(CONFIG.location)===-1){
      v=v.replace(/[A-Za-z ,]+, Anywhere Remote/g,CONFIG.location);
    }
    if(o!==v)node.nodeValue=v;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESPONSIVE — ensure meta viewport is correct and images don't overflow
  // ─────────────────────────────────────────────────────────────────────────
  function ensureResponsive() {
    if (document.getElementById('lm-resp-style')) return;
    var s = document.createElement('style');
    s.id = 'lm-resp-style';
    s.textContent = [
      // Prevent horizontal scroll
      'html,body{max-width:100%;overflow-x:hidden;}',
      // Images never overflow
      'img{max-width:100%;height:auto;}',
      // Cards don't overflow on small screens
      '[class*="card"],[class*="Card"]{min-width:0;max-width:100%;}',
      // Nav dropdown: never taller than viewport
      'header .absolute{max-height:80vh;overflow-y:auto;}',
      // Readable font sizes on mobile
      '@media(max-width:480px){body{font-size:15px;}}',
    ].join('\n');
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // ABOUT — "Kind words" study after the on-screen quote.
  // Fills the space that used to sit empty after the quote: the line is spoken
  // in the voice line as the site's quiet confidence cue, then a short,
  // honest note about where the line (and the rest of the room) came from.
  // ─────────────────────────────────────────────────────────────────────────
  function injectKindWords() {
    var p = stripBase(window.location.pathname);
    if (p.indexOf('about') === -1) return;
    if (document.getElementById('lm-kind-words')) return;
    var quote = null;
    document.querySelectorAll('blockquote, footer, section, div').forEach(function (el) {
      if (quote) return;
      if ((el.textContent || '').indexOf('I am always doing') > -1 && !el.querySelector('blockquote')) {
        var bq = el.querySelector('blockquote') || el;
        quote = bq;
      }
    });
    if (!quote) return;
    var sec = document.createElement('section');
    sec.id = 'lm-kind-words';
    sec.className = 'lm-rv';
    sec.style.cssText = 'padding:6px 0 8px;margin-top:-6px;';
    sec.innerHTML =
      '<div class="lm-glass-card" style="border-radius:20px;padding:26px 28px;">' +
        '<div style="display:inline-flex;align-items:center;gap:7px;margin-bottom:12px;padding:5px 12px;border-radius:999px;">' +
          '<span style="width:7px;height:7px;border-radius:50%;background:hsl(var(--hero-accent));"></span>' +
          '<span style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:hsl(var(--hero-accent));">Kind words</span>' +
        '</div>' +
        '<h2 style="font-family:inherit;font-weight:700;line-height:1.15;margin:0 0 12px;color:hsl(var(--foreground));font-size:clamp(20px,3vw,30px);" class="font-display">Why the speaking works.</h2>' +
        '<div style="display:flex;flex-direction:column;gap:12px;">' +
          '<p style="margin:0;font-size:14px;line-height:1.7;color:hsl(var(--muted-foreground));">That line isn\u2019t borrowed courage \u2014 it\u2019s the job description. This whole practice runs on doing the thing before I\u2019m sure I can, so it felt worth saying where it comes from.</p>' +
          '<p style="margin:0;font-size:14px;line-height:1.7;color:hsl(var(--muted-foreground));">I claim the work; the ideas behind it, I don\u2019t. I\u2019m one half machine, one half the people who taught me \u2014 same as every builder. Where I can name a source, it\u2019s named. Where nobody can remember who said it first, I try to put it better than I found it.</p>' +
          '<p style="margin:0;font-size:14px;line-height:1.7;color:hsl(var(--muted-foreground));border-top:1px dashed hsl(var(--border));padding-top:12px;font-style:italic;">And this page is an edit, not the whole room. The unedited version has the outliers, the failures, the NDA work and the late-night experiments \u2014 most of which tell a better story than the polished ones.</p>' +
        '</div>' +
      '</div>';
    if (quote.parentElement) {
      quote.parentElement.insertAdjacentElement('afterend', sec);
    } else {
      quote.insertAdjacentElement('afterend', sec);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // SEO — client-router head synchronisation (document.title, meta description,
  // canonical & OpenGraph). The SPA bundle never writes document.title, so this
  // layer keeps every nested route's <head> consistent with the real URLs a
  // crawler (and a shared bookmark) sees.
  // ─────────────────────────────────────────────────────────────────────────
  var SEO_PAGES = {
    '/':                 { title: 'LulaMile-HalfMachine | Product Designer & Strategist', desc: 'Product design, brand strategy, websites, PWAs and CRM systems built end to end, from research through to a live, working product.' },
    '/services':         { title: 'Services — LulaMile-HalfMachine', desc: 'Product design and strategy, brand strategy, website design and conversion, CRM implementation and live PWA builds.' },
    '/about':            { title: 'About — LulaMile-HalfMachine', desc: 'Product designer and builder based in Johannesburg. Eight years designing products, websites and the CRM systems behind them.' },
    '/contact':          { title: 'Contact — LulaMile-HalfMachine', desc: 'Book a call, send a message, or email mkhungela.l@gmail.com. Based in Johannesburg, working remotely.' },
    '/product-design-strategy':     { title: 'Product Design & Strategy — LulaMile-HalfMachine', desc: 'From messy problem to working product: research, information architecture, interface design and testing.' },
    '/brand-strategy-and-growth':   { title: 'Brand Strategy & Growth — LulaMile-HalfMachine', desc: 'From invisible brand to converting brand: positioning, messaging, identity and launch assets.' },
    '/microfinance-impact-consulting': { title: 'Microfinance & Impact Consulting — LulaMile-HalfMachine', desc: 'Live PWAs and digital products for low-income, first-time digital users — designed, built and tested end to end.' },
    '/frontend-development':        { title: 'Frontend Development — LulaMile-HalfMachine', desc: 'Design systems, component build and front-end development — interfaces shipped as accessible, responsive code.' },
    '/website-design-conversion':   { title: 'Website Design & Conversion — LulaMile-HalfMachine', desc: 'Websites and CRM implementation: design that converts, and a pipeline that makes sure every enquiry gets answered.' }
  };
  var SEO_PROJECTS = {
    'addmoredigital-website':  { title: 'AddmoreDigital — Website Design, SEO & CRM', fb: 'AddmoreDigital — a digital agency' },
    'africa-cuisine-pwa':      { title: 'Africa Cuisine — Flame-Grilled Restaurant PWA', fb: 'Africa Cuisine — a restaurant PWA' },
    'brand-strategy-programme':{ title: 'Brand Strategy & Growth — Toyota Mobility Brands', fb: 'Brand Strategy & Growth' },
    'designops-design-system': { title: 'DesignOps — One Design, Every Framework', fb: 'DesignOps — a design system' },
    'employee-engagement-app-redesign': { title: 'Employee Engagement App Redesign — Vodacom HRIT', fb: 'Employee Engagement App Redesign' },
    'foodiezone-pwa':          { title: 'FoodieZone — Live Food Ordering PWA', fb: 'FoodieZone — a food ordering PWA' },
    'lexark-legal-search':     { title: 'Lexark — Legal Resource Search Engine & Web App', fb: 'Lexark — legal search' },
    'lula-gazette':            { title: 'LulaGazette — Pan-African Legal Intelligence & Official Gazettes', fb: 'LulaGazette — Pan-African legal intelligence' },
    'lula-trustshield':        { title: 'Lula TrustShield — Trust & Escrow for Marketplace Deals', fb: 'Lula TrustShield — escrow platform' },
    'service-waze':            { title: 'ServiceWaze — Live Service Status for Your Area', fb: 'ServiceWaze — suburb-level service status for South Africa' },
    'nerdma-website':          { title: 'Nerdma — Website Redesign & Product Dashboards', fb: 'Nerdma — a website redesign' },
    'kinto-one':               { title: 'Kinto One Personal — Toyota', fb: 'Kinto One Personal — Toyota' },
    'toyota-remote':           { title: 'Toyota Remote', fb: 'Toyota Remote' },
    'toyota-app':              { title: 'Toyota Mobile App', fb: 'Toyota Mobile App' },
    'wandisplace-pwa':         { title: 'Wandi\u2019s Place — PWA', fb: 'Wandi\u2019s Place — a PWA' },
    'sk-finds-pwa':            { title: 'SK Finds — Pre-Owned Cars & Shopper', fb: 'SK Finds — pre-owned cars' },
    'snb-website':             { title: 'SNB — Website Design for a Chartered Accountancy', fb: 'SNB — a chartered accountancy site' }
  };

  function seoRouteInfo() {
    var p = stripBase(window.location.pathname) || '/';
    // Normalise trailing "/index" and ".html" (base-path-fix strips these via replaceState)
    p = p.replace(/\/index\.html$/i, '/').replace(/\/index$/i, '/').replace(/\.html$/i, '');
    if (p.length > 1 && p.charAt(p.length - 1) === '/') p = p.slice(0, -1);
    if (p === '') p = '/';
    var staticMeta = {};
    try {
      var mt = document.querySelector('meta[name="description"]');
      if (mt && mt.content) staticMeta.desc = mt.content;
      var cn = document.querySelector('link[rel="canonical"]');
      if (cn && cn.href) staticMeta.canonical = cn.href;
      var ogt = document.querySelector('meta[property="og:title"]');
      if (ogt && ogt.content) staticMeta.ogTitle = ogt.content;
    } catch (e) {}
    var exact = SEO_PAGES[p];
    if (exact) {
      return { page: exact, base: p, staticMeta: staticMeta };
    }
    // lenient page match (works whether p is /about or /about/ etc.)
    var key = Object.keys(SEO_PAGES).filter(function (k) {
      return p === k || p + '/' === k || (k !== '/' && p.indexOf(k + '/') === 0);
    })[0];
    var m = p.match(/\/project\/([A-Za-z0-9_-]+)/);
    if (m) {
      var s = SEO_PROJECTS[m[1]];
      return {
        project: { id: m[1], title: s ? s.title : null, fb: s ? s.fb : null },
        base: '/project/' + m[1], staticMeta: staticMeta
      };
    }
    return { page: key ? SEO_PAGES[key] : null, base: p, staticMeta: staticMeta };
  }

  function ensureMeta(attr, name, content) {
    if (content == null) return;
    var sel = 'meta[' + attr + '="' + name + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    if (el.getAttribute('content') !== content) el.setAttribute('content', content);
  }

  function seoTitles() {
    var info = seoRouteInfo();
    var title = null, desc = null, fallback = null;

    if (info.project && info.project.id) {
      var n = null;
      try {
        var h1 = document.querySelector('main h1, h1');
        n = h1 ? h1.textContent.trim() : null;
      } catch (e) {}
      if (n && n.length > 2 && !n.match(/^(404|loading|opening the live product)/i)) fallback = n;
      title = info.project.title || fallback;
      desc = info.project.fb
        ? 'Case study: ' + info.project.fb + ' — how it was designed, built and what shipped.'
        : (info.staticMeta.desc || 'Case study by LulaMile-HalfMachine.');
    } else if (info.page) {
      title = info.page.title;
      desc = info.page.desc || info.staticMeta.desc;
    } else {
      title = info.staticMeta.desc ? document.title : null;
      desc = info.staticMeta.desc;
    }

    if (title) document.title = title;
    ensureMeta('name', 'description', desc);
    if (title) ensureMeta('property', 'og:title', title);
    // A client-side route change must not keep the previous page's canonical.
    var canonical = 'https://lulamilemkhungela.github.io/website-template' +
      (info.base === '/' ? '/' : info.base.replace(/\/$/, '') + '/');
    var c = document.querySelector('link[rel="canonical"]');
    if (!c) { c = document.createElement('link'); c.setAttribute('rel', 'canonical'); document.head.appendChild(c); }
    if (c.getAttribute('href') !== canonical) c.setAttribute('href', canonical);
    ensureMeta('property', 'og:url', canonical);
    if (window.dataLayer && typeof window.dataLayer.push === 'function') {
      try { window.dataLayer.push({ event: 'virtualPageview', pagePath: window.location.pathname, pageTitle: title }); } catch (e) {}
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // A11Y — hydrator: skip link, landmark labels, H1 seeding, focus rings,
  // reduced-motion guard. Runs continuously so late-mounted routes benefit.
  // ─────────────────────────────────────────────────────────────────────────
  function a11yPass() {
    try {
      // Skip link (pointer + keyboard)
      if (!document.getElementById('lm-skip')) {
        var sl = document.createElement('a');
        sl.id = 'lm-skip';
        sl.href = '#lm-main';
        sl.textContent = 'Skip to content';
        sl.style.cssText = 'position:absolute;left:-9999px;top:8px;z-index:200;padding:10px 16px;border-radius:10px;' +
          'background:hsl(var(--foreground));color:hsl(var(--background));font-weight:700;font-size:13px;' +
          'text-decoration:none;';
        document.body.insertBefore(sl, document.body.firstChild);
      }
      var skip = document.getElementById('lm-skip');
      skip.style.left = '-9999px';
      var main = document.querySelector('main');
      if (main && !main.id) main.id = 'lm-main';
      skip.addEventListener('focus', function () { skip.style.left = '8px'; });
      skip.addEventListener('blur', function () { skip.style.left = '-9999px'; });
      skip.addEventListener('click', function (e) {
        var target = document.getElementById('lm-main');
        if (target) { e.preventDefault(); target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: false }); }
      });
    } catch (e) {}

    try {
      // Label/identify recurring landmarks so assistive tech can tell the region
      var header = document.querySelector('body > header, header.sticky, header.fixed, header');
      if (header && !header.getAttribute('aria-label')) header.setAttribute('aria-label', 'Site header');
      var nav = header ? header.querySelector('nav') : document.querySelector('nav');
      if (nav && !nav.hasAttribute('aria-label')) nav.setAttribute('aria-label', 'Main navigation');
      var footer = document.querySelector('footer');
      if (footer && !footer.getAttribute('aria-label')) footer.setAttribute('aria-label', 'Site footer');
    } catch (e) {}

    try {
      // Ensure exactly one top-level H1 per page.
      var p = stripBase(window.location.pathname);
      var mainEl = document.querySelector('main');
      var h1s = (mainEl || document).querySelectorAll('h1');
      if (h1s.length === 0) {
        // pages whose first "hero" heading renders as h2
        var promos = null;
        document.querySelectorAll('h2').forEach(function (h) {
          if (promos) return;
          if ((h.className || '').indexOf('leading-[1.05]') > -1 && h.parentNode && h.parentNode.className && h.parentNode.className.indexOf('justify-center') > -1) {
            promos = h;
          }
        });
        if (!promos && mainEl) {
          var heroH2 = mainEl.querySelector('h2');
          if (heroH2 && heroH2.offsetParent !== null && window.innerWidth && window.innerHeight) {
            var first = mainEl.querySelector('section');
            if (first && first.contains(heroH2) && first.getBoundingClientRect().top < (window.innerHeight || 800)) {
              promos = heroH2;
            }
          }
        }
        if (!promos && p.indexOf('/project/') > -1 && mainEl) promos = mainEl.querySelector('h2') || document.querySelector('h2');
        if (promos) {
          var h1 = document.createElement('h1');
          h1.setAttribute('class', promos.getAttribute('class') || '');
          h1.textContent = (promos.textContent || '').replace(/\s+/g, ' ').trim();
          h1.setAttribute('data-lm-h1', '1');
          if (promos.id) h1.id = promos.id + '-h1';
          promos.parentNode.insertBefore(h1, promos);
          h1.hidden = true;
        }
      } else if (h1s.length > 1) {
        var real = [];
        h1s.forEach(function (h) { if (!h.hidden && h.offsetParent !== null) real.push(h); });
        if (real.length > 1) {
          for (var i = 1; i < real.length; i++) {
            var d = real[i];
            if (!d.getAttribute('data-lm-kept')) {
              d.setAttribute('role', 'presentation');
              d.setAttribute('aria-hidden', 'true');
              d.hidden = true;
              d.setAttribute('data-lm-demoted', '1');
            }
          }
        }
      }
    } catch (e) {}

    try {
      // keyboard focus already uses ring-* utilities; this is the reduced-motion guard
      if (!document.getElementById('lm-motion-respect')) {
        var rr = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        if (rr && rr.matches) {
          var st = document.createElement('style');
          st.id = 'lm-motion-respect';
          st.textContent = '*,*::before,*::after{animation-duration:.001s !important;animation-iteration-count:1 !important;transition-duration:.001s !important;scroll-behavior:auto !important;}';
          document.head.appendChild(st);
        }
      }
    } catch (e) {}

    try {
      // Yes/no tooltips & badge-only icons: give them real text fallbacks where absent
      document.querySelectorAll('.lm-ext-badge').forEach(function (b) {
        if (!b.getAttribute('aria-hidden')) b.setAttribute('aria-label', b.textContent);
      });
    } catch (e) {}
  }

  // MAIN PATCH
  // ─────────────────────────────────────────────────────────────────────────
  function patch() {
    // Text node replacements
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(replaceTextNode);

    // Link overrides
    document.querySelectorAll('a[href*="calendly.com"]').forEach(function(a){if(a.getAttribute('href').indexOf(CONFIG.newCalendly)===-1)a.href=CONFIG.newCalendly;});
    document.querySelectorAll('a[href*="drive.google.com"]').forEach(function(a){if(a.getAttribute('href').indexOf('1iNgauKhYevO53')===-1)a.href=CONFIG.newResume;});
    document.querySelectorAll('a[href*="linkedin.com"]').forEach(function(a){if(a.getAttribute('href').indexOf('lulamile-mkhungela')===-1)a.href=CONFIG.newLinkedIn;});
    document.querySelectorAll('a[href^="mailto:"]').forEach(function(a){
      if(a.getAttribute('href')!=='mailto:'+CONFIG.newEmail){
        a.setAttribute('href','mailto:'+CONFIG.newEmail);
        if(a.textContent.indexOf('@')>-1)a.textContent=CONFIG.newEmail;
      }
    });
    document.querySelectorAll('a[href^="tel:"]').forEach(function(a){
      if(a.getAttribute('href')!=='tel:'+CONFIG.newPhoneRaw){
        a.setAttribute('href','tel:'+CONFIG.newPhoneRaw);
        if(a.textContent.indexOf('+')>-1)a.textContent=CONFIG.newPhone;
      }
    });

    // Profile photo
    document.querySelectorAll('img').forEach(function(img){
      var src=img.getAttribute('src')||'';
      if(!img.hasAttribute('data-lm-portrait')&&!/meew\.jpe?g$/i.test(src)&&!/profile|portrait|headshot/i.test(img.getAttribute('alt')||''))return;
      if(src!==profilePic)img.setAttribute('src',profilePic);
      if(img.getAttribute('srcset'))img.removeAttribute('srcset');
    });

    // Brand logos
    document.querySelectorAll('img[data-lm-brand],img[src*="-logo.svg"]').forEach(function(img,i){
      img.src=basePath+newBrands[i%newBrands.length];
      img.style.filter='none';img.style.background='#fff';
      img.style.padding='4px 8px';img.style.borderRadius='6px';
      img.style.height='32px';img.style.objectFit='contain';
    });

    // Apply all functions
    snbRedirect();
    ensureLogosColors();
    fixInternalLinks();
    flagRedirectCards();
    handleNdaCards();
    applyEdits();
    relabelLexark();
    removeTestimonials();
    fixBackButton();
    ensureFavicon();
    enhanceCaseStudyLiveLinks();
    renderServicesIndustries();
    balanceOffering();
    trustshieldStatus();
    contactFormspree();
    fixContactForm();
    injectKindWords();
    injectAboutSections();
    injectAboutContactForm();
    glassPass();
    fixWhitespace();
    fixServices();
    dedupeSocial();
    limitedEditionPass();
    seoTitles();
    a11yPass();
    perfPass();
    animPass();
    ensureResponsive();
    initBackToTop();
    checkMidnight();
    fixNav();
    fixDropdownDuplicates();
  }

  function runPass() {
    try { glassPass(); } catch (e) {}
    try { patch(); } catch (e) {}
    try { initBackToTop(); } catch (e) {}
    try { if (window.__LM_GREETING_CHECK__) window.__LM_GREETING_CHECK__(); } catch (e) {}
  }

  function loadingEscapeHatch() {
    setTimeout(function(){
      var ov=document.querySelector('[aria-label="Loading"]');
      if(!ov)return;
      ov.style.display='none';ov.setAttribute('aria-hidden','true');
      if(!document.getElementById('lm-esc')){
        var s=document.createElement('style');s.id='lm-esc';
        s.textContent='[aria-label="Loading"]{display:none !important;}';
        document.head.appendChild(s);
      }
    },12000);
  }

  function start() {
    protectContent();
    glassPass();
    runPass();
    loadingEscapeHatch();

    var quiet=null,passTimes=[],pausedUntil=0;
    var observer=new MutationObserver(function(){
      if(quiet)return;
      quiet=setTimeout(function(){
        quiet=null;
        var now=Date.now();
        passTimes=passTimes.filter(function(t){return now-t<10000;});
        if(now<pausedUntil)return;
        if(passTimes.length>30){pausedUntil=now+10000;passTimes=[];return;}
        passTimes.push(now);
        observer.disconnect();
        runPass();
        observer.observe(document.body,{childList:true,subtree:true});
      },200);
    });
    observer.observe(document.body,{childList:true,subtree:true});

    [150,400,900,1800,3500].forEach(function(t){
      setTimeout(function(){
        observer.disconnect();
        runPass();
        observer.observe(document.body,{childList:true,subtree:true});
      },t);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
