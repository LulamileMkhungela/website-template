/* ============================================================================
   LulaMile-HalfMachine — SITE EDITS
   ----------------------------------------------------------------------------
   This is the only file you need to touch to change wording, links or images
   on the live site. Plain text, no build step, no Python.

   HOW IT WORKS
   1. TEXT    — find a phrase exactly as it appears on the site, put it in
                `find`, and what you want instead in `replace`.
   2. IMAGES  — map the image path that is on the site now to a new file you
                drop into `projects/lulamile/`.
   3. LINKS   — same idea, for URLs.
   4. SETTINGS— your name, role, email, phone and social links in one place.

   Save the file, refresh the browser (hard refresh: Ctrl/Cmd + Shift + R) and
   the change is live. Nothing else needs rebuilding.
   ============================================================================ */

window.LM_EDITS = {

  /* ---------------------------------------------------------------- settings */
  settings: {
    name: 'LulaMile-HalfMachine',
    role: 'Product Designer & Strategist',
    location: 'Johannesburg, Anywhere Remote',
    email: 'mkhungela.l@gmail.com',
    phone: '+27 83 719 5064',
    phoneRaw: '+27837195064',
    linkedin: 'https://www.linkedin.com/in/lulamile-mkhungela/',
    calendly: 'https://calendly.com/lulamile_m/meet-lulamile',
    resume: 'https://drive.google.com/file/d/1iNgauKhYevO53_D5daPcT5cM5wkpuYkP/view?usp=drive_link',

    /* Copy protection: visitors cannot select or copy the wording.
       Set to false if you would rather let people copy your text. */
    copyProtection: true,
    copyMessage: 'This content is protected. Get in touch if you would like to use it.',

    /* Greeting voice: says "Good morning/afternoon/evening. Welcome." ONCE —
       on the visitor's first load of the site. It is remembered in the
       browser, so returning visits are silent. Browsers only allow sound
       after the visitor has clicked or tapped something, so on Chrome/Safari
       it speaks on their first click of that first visit; Firefox, and Chrome
       tabs that already trust the site, speak straight away.
       Set to false to mute it entirely. */
    greetingVoice: true,

    /* Where the contact form delivers messages. Your Formspree endpoint. */
    formspree: 'https://formspree.io/f/mknadbag',

    /* Open resources shown on the LulaUnifidMarket (TrustShield) case study. */
    trustshieldFigma: 'https://www.figma.com/design/z28iI0zJV1u1cL1wQ4HMrx/Lula-Fig-Studio?node-id=0-1&amp;t=nvDf0oI0q4B7eTvy-1',
    trustshieldNotion: 'https://chartreuse-scale-c4a.notion.site/Lula-Creatives-UX-Resources-Bookmarks-1e2962b93ef1809dbe07c896db79ad65'
  },

  /* ------------------------------------------------------------------- text */
  /* Each entry: find the exact phrase on the site -> what to show instead.
     Keep `find` short but unique enough that it only matches once.
     (The Brand Strategy & Growth case study now ships in the bundle itself as
     the single KINTO + Toyota App + Toyota Remote study, so no overrides are
     needed there anymore.) */
  text: [
  ],

  /* ----------------------------------------------------------------- images */
  /* Drop your file into projects/lulamile/ then point the old path at it. */
  images: [
    // { find: '/projects/lulamile/engage-cover.png', replace: '/projects/lulamile/my-new-cover.png' },
  ],

  /* ------------------------------------------------------------------ links */
  links: [
    // { find: 'https://calendly.com/lulamile_m/meet-lulamile', replace: 'https://calendly.com/new-link' },
  ]
};
