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
    copyMessage: 'This content is protected. Get in touch if you would like to use it.'
  },

  /* ------------------------------------------------------------------- text */
  /* Each entry: find the exact phrase on the site -> what to show instead.
     Keep `find` short but unique enough that it only matches once. */
  text: [
    // { find: 'Designing and building digital products', replace: 'Your new headline here' },
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
