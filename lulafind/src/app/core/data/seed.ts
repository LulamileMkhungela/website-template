import { defaultPrivacy, Comment, Post, Spotlight, Story, UserProfile } from '../models/types';

/**
 * Deterministic placeholder imagery built as inline SVG data-URIs so the app is
 * 100% offline-capable and renders in any webview with zero network requests.
 */

const enc = (svg: string): string =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

export const hueOf = (s: string): number => hash(s) % 360;

export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** Circular avatar tile. */
export const avatar = (name: string, hue?: number): string => {
  const h = hue ?? hueOf(name);
  // The picture is the initials. John Doe is JD. No face, no upload.
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${h} 62% 46%)"/><stop offset="1" stop-color="hsl(${(h + 40) % 360} 58% 26%)"/>
  </linearGradient></defs>
  <rect width="120" height="120" fill="url(#g)"/>
  <text x="60" y="74" font-family="system-ui,Arial" font-size="46" font-weight="800"
    text-anchor="middle" fill="#fff">${initials(name)}</text></svg>`);
};

/** Wide cover / spotlight banner. */
export const cover = (label: string, hue?: number): string => {
  const h = hue ?? hueOf(label);
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 180">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${h} 60% 34%)"/>
    <stop offset=".55" stop-color="hsl(${(h + 35) % 360} 55% 20%)"/>
    <stop offset="1" stop-color="hsl(${(h + 70) % 360} 60% 12%)"/></linearGradient></defs>
  <rect width="400" height="180" fill="url(#g)"/>
  <g opacity=".16" fill="#fff">
    <circle cx="52" cy="34" r="26"/><circle cx="332" cy="140" r="42"/><circle cx="250" cy="26" r="14"/>
  </g>
  <text x="24" y="150" font-family="system-ui,Arial" font-size="26" font-weight="800"
    fill="rgba(255,255,255,.9)" letter-spacing="1">${label.toUpperCase()}</text></svg>`);
};

/** Scene placeholder used for post photos (street, home, map-ish). */
export const scene = (label: string, seedStr: string, tone: 'street' | 'home' | 'map' | 'night' = 'street'): string => {
  const h = hueOf(seedStr);
  const palettes: Record<string, [string, string, string]> = {
    street: ['hsl(212 22% 30%)', 'hsl(212 20% 18%)', 'hsl(38 70% 55%)'],
    home: ['hsl(24 45% 32%)', 'hsl(20 40% 18%)', 'hsl(45 80% 60%)'],
    map: ['hsl(150 30% 22%)', 'hsl(150 25% 13%)', 'hsl(160 60% 50%)'],
    night: ['hsl(235 35% 18%)', 'hsl(235 40% 9%)', 'hsl(265 60% 65%)']
  };
  const [a, b, c] = palettes[tone];
  const bars = Array.from({ length: 14 }, (_, i) => {
    const x = 10 + i * 28;
    const hh = 20 + ((hash(seedStr + i) % 90) + 20);
    return `<rect x="${x}" y="${180 - hh}" width="18" height="${hh}" fill="hsla(${h},20%,${10 + (i % 3) * 6}%,.9)"/>`;
  }).join('');
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="400" height="240" fill="url(#s)"/>
  <circle cx="330" cy="46" r="22" fill="${c}" opacity=".85"/>
  ${bars}
  <rect y="180" width="400" height="60" fill="hsla(0,0%,0%,.45)"/>
  <g stroke="hsla(0,0%,100%,.35)" stroke-width="3" stroke-dasharray="14 12">
    <path d="M0 210 H400"/></g>
  <text x="16" y="34" font-family="system-ui,Arial" font-size="15" font-weight="700"
    fill="rgba(255,255,255,.75)">${label}</text></svg>`);
};

export const posterPlaceholder = (title: string): string => scene(title, title, 'night');

/** Simple radial used for story backgrounds. */
export const storyBg = (hue: number): string =>
  enc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 500">
  <defs><radialGradient id="r" cx=".3" cy=".2" r="1">
    <stop offset="0" stop-color="hsl(${hue} 70% 42%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 60% 10%)"/>
  </radialGradient></defs><rect width="300" height="500" fill="url(#r)"/></svg>`);

/* ------------------------------------------------------------------ *
 * Seed data
 * ------------------------------------------------------------------ */

const now = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const seedUsers = (): UserProfile[] => {
  const mk = (
    id: string,
    name: string,
    handle: string,
    surname: string,
    province: any,
    town: string,
    bio: string,
    extra: Partial<UserProfile> = {}
  ): UserProfile => ({
    id,
    email: `${handle}@example.co.za`,
    displayName: name,
    handle,
    avatarHue: hueOf(name),
    bio,
    province,
    town,
    surname,
    createdAt: now - 120 * DAY,
    verified: false,
    anonymous: false,
    findableProfile: true,
    safetyBeacon: false,
    lastBeaconAt: null,
    followers: 40 + (hash(id) % 900),
    following: 20 + (hash(handle) % 300),
    karma: 10 + (hash(name) % 900),
    onboarded: true,
    blockedUserIds: [],
    spotlightIds: [],
    isAdmin: false,
    suspended: false,
    privacy: defaultPrivacy(),
    checkIn: null,
    ...extra
  });

  const demo: UserProfile = mk(
    'u_demo',
    'Thandi Mokoena',
    'thandi.m',
    'Mokoena',
    'GP',
    'Soweto, Johannesburg',
    'Community organiser. If you see something, say something. Ubuntu.',
    { verified: true, followers: 1240, karma: 2310, onboarded: false, isAdmin: true }
  );

  return [
    demo,
    mk('u_sipho', 'Sipho Ndlela', 'sipho.ndlela', 'Ndlela', 'KZN', 'Durban North', 'Ndlela family page admin. Search volunteer.'),
    mk('u_lerato', 'Lerato Mahlangu', 'lerato.m', 'Mahlangu', 'GP', 'Mamelodi, Pretoria', 'Social worker. GBV advocate.'),
    mk('u_pieter', 'Pieter van Wyk', 'pieter.vw', 'van Wyk', 'WC', 'Bellville, Cape Town', 'CPF member, Table View.', {
      checkIn: {
        status: 'unfamiliar',
        note: 'Somewhere I do not know.',
        at: now - 3600_000 * 3,
        location: null,
        liveUntil: null,
        liveShareOn: false
      }
    }),
    mk('u_ayanda', 'Ayanda Khumalo', 'ayanda.k', 'Khumalo', 'KZN', 'Pietermaritzburg', 'Amateur radio operator - help locate people.', {
      checkIn: {
        status: 'need_help',
        note: 'Please check on me.',
        at: now - 3600_000,
        location: null,
        liveUntil: null,
        liveShareOn: false
      }
    }),
    mk('u_naledi', 'Naledi Dlamini', 'naledi.d', 'Dlamini', 'MP', 'Nelspruit', 'Nurse. Missing-persons volunteer since 2019.'),
    mk('u_johan', 'Johan Botha', 'johan.b', 'Botha', 'FS', 'Bloemfontein', 'Farm community watch.'),
    mk('u_zanele', 'Zanele Mthembu', 'zanele.m', 'Mthembu', 'LP', 'Polokwane', 'Teacher. Runs a school safety WhatsApp group.'),
    mk('u_kabelo', 'Kabelo Nkosi', 'kabelo.n', 'Nkosi', 'GP', 'Alexandra', 'Photographer. I document searches.', {
      checkIn: {
        status: 'safe',
        note: 'Home safe after the Roodepoort search.',
        at: now - 3600_000 * 6,
        location: null,
        liveUntil: null,
        liveShareOn: false
      }
    }),
    mk('u_fatima', 'Fatima Adams', 'fatima.a', 'Adams', 'NC', 'Kimberley', 'Community newspaper reporter.'),
    mk('u_tshepo', 'Tshepo Molefe', 'tshepo.m', 'Molefe', 'NW', 'Rustenburg', 'I just want everyone to get home safe.'),
    mk('u_bongani', 'Bongani Zulu', 'bongani.z', 'Zulu', 'EC', 'East London', 'Taxi association liaison.'),
    mk('u_mod', 'LulaFind Moderation', 'moderation', 'LulaFind', 'GP', 'Johannesburg', 'Official LulaFind trust & safety account.', {
      verified: true,
      anonymous: false,
      isAdmin: true
    }),
    /* the person who is "missing" in the demo case and who later claims a KhumbulEkhaya post */
    mk('u_lindiwe', 'Lindiwe Ndlela', 'lindiwe.n', 'Ndlela', 'KZN', 'Umlazi, Durban', 'I am okay. I needed time.', {
      findableProfile: true
    })
  ];
};

export const seedSpotlights = (): Spotlight[] => {
  const mk = (
    id: string,
    surname: string,
    tagline: string,
    ownerId: string,
    adminIds: string[],
    province: any,
    about: string,
    followers: number,
    verified = false
  ): Spotlight => ({
    id,
    surname,
    tagline,
    coverHue: hueOf(surname),
    ownerId,
    adminIds,
    memberIds: [...new Set([ownerId, ...adminIds])],
    postIds: [],
    followers,
    province,
    verified,
    createdAt: now - 60 * DAY,
    about
  });
  return [
    mk('sp_ndlela', 'Ndlela', 'One surname. One search. Bring them home.', 'u_sipho', ['u_sipho', 'u_ayanda'], 'KZN',
      'The Ndlela spotlight gathers every LulaFind case, story and update that touches the Ndlela surname across KwaZulu-Natal and beyond. Admins verify family links before a post is pinned.', 3120, true),
    mk('sp_mokoena', 'Mokoena', 'Gauteng Mokoena network', 'u_demo', ['u_demo', 'u_kabelo'], 'GP',
      'Mokoena family network in Gauteng. We coordinate searches, share posters and keep each other informed.', 5240, true),
    mk('sp_khumalo', 'Khumalo', 'Khumalo across the borders', 'u_ayanda', ['u_ayanda'], 'KZN',
      'Khumalo relatives in KZN, Mpumalanga and Gauteng.', 1870),
    mk('sp_botha', 'Botha', 'Botha / Bothma farm watch', 'u_johan', ['u_johan'], 'FS',
      'Free State farming communities looking out for one another.', 940)
  ];
};

export const seedPosts = (): Post[] => {
  const base = (p: Partial<Post> & Pick<Post, 'id' | 'type' | 'authorId' | 'title' | 'body' | 'province'>): Post => ({
    status: 'active',
    anonymous: false,
    askWanted: false,
    danger: null,
    media: [],
    town: '',
    lastSeenAt: null,
    lastSeenWhere: '',
    geo: null,
    contactLabel: 'Call / WhatsApp',
    contactValue: '',
    contactVisibleTo: 'everyone',
    caseNumber: null,
    reward: null,
    createdAt: now - 2 * DAY,
    updatedAt: now - 2 * DAY,
    subject: null,
    audience: 'public',
    spotlightId: null,
    chatEnabled: true,
    allowComments: true,
    allowShare: true,
    upvotes: 0,
    downvotes: 0,
    commentCount: 0,
    shares: 0,
    views: 0,
    savedBy: 0,
    voterIds: {},
    escalation: { requested: false, consentGranted: false, consentAt: null, partners: [] },
    consent: [],
    sightingVerified: null,
    searchParty: null,
    locationCheck: {
      subjectRegisteredInApp: false,
      requestedBy: null,
      requestedAt: null,
      consentFromSubject: 'none',
      consentAt: null,
      points: [],
      deviceReachable: false,
      lastKnownAt: null,
      note: ''
    },
    khumbu: null,
    outcome: { found: false, foundAt: null, whereaboutsFound: '', closedBy: null, note: '' },
    events: [],
    flags: [],
    outcomeNudgeAt: null,
    ...p
  });

  return [
    base({
      id: 'p_thato',
      type: 'missing',
      authorId: 'u_demo',
      lookingIds: ['u_lerato', 'u_sipho'],
      title: 'Help find Thato Mokoena, 14 - last seen Orlando West, Soweto',
      body:
        'Thato left home on Tuesday morning for school at Orlando High and never arrived. She was wearing her full school uniform with a grey cardigan and black takkies.\n\n' +
        'Her phone went off at 09:40 near the Orlando taxi rank. She was with her cousin Nokuthula, who says Thato said she was going to the clinic and would be back by 14:00. She never came home.\n\n' +
        'Thato is quiet, has a small scar above her left eyebrow and wears a silver anklet. She is on chronic medication (asthma) and did not take her pump with her. We have opened a case at Orlando SAPS.\n\n' +
        'If you have seen her, please do not approach alone - call the number on this post or 10111.',
      province: 'GP',
      town: 'Orlando West, Soweto',
      lastSeenAt: now - 3 * DAY - 4 * HOUR,
      lastSeenWhere: 'Orlando taxi rank, Soweto',
      geo: { lat: -26.2369, lng: 27.9099, label: 'Orlando taxi rank' },
      contactValue: '071 555 0142',
      caseNumber: 'ORL/441/09/2026',
      reward: 'R5 000 for information leading to her safe return',
      createdAt: now - 3 * DAY,
      updatedAt: now - 2 * HOUR,
      audience: 'public',
      spotlightId: 'sp_mokoena',
      media: [
        { id: 'm1', kind: 'image', src: scene('Thato - school photo', 'thato1'), caption: 'School photo, Jan 2026' },
        { id: 'm2', kind: 'image', src: scene('Last seen - taxi rank', 'thato2', 'street'), caption: 'Camera view near Orlando taxi rank' }
      ],
      subject: {
        name: 'Thato Mokoena',
        age: 14,
        gender: 'female',
        height: '1.55 m',
        build: 'Slim',
        skinTone: 'Dark brown',
        hair: 'Braids, shoulder length',
        eyes: 'Brown',
        clothing: 'Orlando High uniform, grey cardigan, black takkies',
        distinguishing: 'Small scar above left eyebrow, silver anklet',
        medical: 'Asthma - carries a pump',
        vehicle: 'None',
        languages: 'isiZulu, English, Sesotho',
        surname: 'Mokoena',
        relationship: 'Daughter'
      },
      upvotes: 412,
      downvotes: 9,
      commentCount: 3,
      shares: 187,
      views: 9840,
      savedBy: 63,
      escalation: {
        requested: true,
        consentGranted: true,
        consentAt: now - 3 * DAY + 30 * MIN,
        partners: [
          { partnerId: 'saps-station', partnerName: 'Nearest police station', status: 'noted', requestedAt: now - 3 * DAY, sentAt: now - 3 * DAY + 30 * MIN, reference: 'ORL/441/09/2026' },
          { partnerId: 'pink-ladies', partnerName: 'Pink Ladies', status: 'noted', requestedAt: now - 3 * DAY, sentAt: now - 3 * DAY + 31 * MIN, reference: null }
        ]
      },
      consent: [
        { kind: 'escalation', label: 'Family reported at the station and messaged Pink Ladies. LulaFind did not send the case', granted: true, at: now - 3 * DAY + 30 * MIN, expiresAt: now + 27 * DAY },
        { kind: 'media', label: 'Photos stay on this case unless the family shares the link', granted: true, at: now - 3 * DAY + 30 * MIN, expiresAt: now + 27 * DAY }
      ],
      locationCheck: {
        subjectRegisteredInApp: true,
        requestedBy: 'u_demo',
        requestedAt: now - 3 * DAY + 10 * MIN,
        consentFromSubject: 'declined',
        consentAt: now - 2 * DAY,
        points: [],
        deviceReachable: false,
        lastKnownAt: null,
        note:
          'A LulaFind account matches "Thato Mokoena". We asked the account holder for location consent. Consent was not granted, so no location was ever read or stored. LulaFind never tracks anyone without their own explicit, revocable consent.'
      },
      events: [
        { at: now - 3 * DAY, kind: 'claimed', byUserId: 'u_demo', note: 'Poster is the parent/guardian' }
      ]
    }),

    base({
      id: 'p_lindiwe',
      type: 'khumbulekhaya',
      authorId: 'u_sipho',
      title: 'KhumbulEkhaya: Lindiwe Ndlela has not been home for 11 days',
      body:
        'Our sister Lindiwe left the family home in Umlazi after an argument and has not come back. We are not sure whether she is missing or whether she simply does not want to come home right now - and that is the hardest part, not knowing.\n\n' +
        'She is 23, works part-time at a salon in Isipingo and her phone rings but is not answered. We are not angry. We just want to know she is alive and eating.\n\n' +
        'Lindiwe, if you are reading this: you are not in trouble. Nobody is looking to punish you. Grandmother is asking for you every day.',
      province: 'KZN',
      town: 'Umlazi, Durban',
      lastSeenAt: now - 11 * DAY,
      lastSeenWhere: 'Family home, V Section, Umlazi',
      geo: { lat: -29.9711, lng: 30.8925, label: 'Umlazi V Section' },
      contactValue: '082 555 0177',
      contactVisibleTo: 'verified',
      createdAt: now - 6 * DAY,
      updatedAt: now - 5 * HOUR,
      askWanted: true,
      audience: 'public',
      spotlightId: 'sp_ndlela',
      media: [{ id: 'm1', kind: 'image', src: scene('Lindiwe - family photo', 'lindiwe1', 'home'), caption: 'Christmas 2025' }],
      subject: {
        name: 'Lindiwe Ndlela',
        age: 23,
        gender: 'female',
        height: '1.62 m',
        build: 'Average',
        skinTone: 'Brown',
        hair: 'Natural, short',
        eyes: 'Brown',
        clothing: 'Unknown - left with a black jacket',
        distinguishing: 'Tattoo of a small sun on her right wrist',
        medical: 'None known',
        vehicle: 'None',
        languages: 'isiZulu, English',
        surname: 'Ndlela',
        relationship: 'Sister'
      },
      khumbu: {
        daysOut: 11,
        leftHomeAt: now - 11 * DAY,
        reasonGuess: 'Family disagreement - she may not want to return',
        claimedByUserId: null,
        claimedAt: null,
        subjectResponse: 'none',
        subjectNote: '',
        wantedAnswers: { yes: 58, no: 31, myVote: null }
      },
      upvotes: 267,
      downvotes: 24,
      commentCount: 3,
      shares: 94,
      views: 5310,
      savedBy: 41
    }),

    base({
      id: 'p_johan',
      type: 'missing',
      authorId: 'u_johan',
      title: 'Hendrik Botha, 78, walked out of the house at 05:30 - Wesselbron',
      body:
        'My father Hendrik has early-stage dementia. He walked out of the farmhouse at 05:30 in his pyjamas and slippers. He believes it is 1974 and that he is walking to school.\n\n' +
        'He answers to "Hennie". He is 1.78 m, thin, grey hair, and will be very confused and cold. The veld around the farm is open and there are two farm dams.\n\n' +
        'We have searchers on the ground from 06:00. If you are on the R30 between Wesselbron and Bothaville, please slow down and look at the verges.',
      province: 'FS',
      town: 'Wesselbron',
      lastSeenAt: now - 10 * HOUR,
      lastSeenWhere: 'Farm Weltevrede, R30',
      geo: { lat: -27.0833, lng: 26.75, label: 'Farm Weltevrede' },
      contactValue: '083 555 0119',
      caseNumber: 'WES/118/09/2026',
      createdAt: now - 9 * HOUR,
      updatedAt: now - 40 * MIN,
      media: [{ id: 'm1', kind: 'image', src: scene('Farm Weltevrede - search area', 'hendrik1', 'map'), caption: 'Search grid, north of the homestead' }],
      subject: {
        name: 'Hendrik Botha',
        age: 78,
        gender: 'male',
        height: '1.78 m',
        build: 'Thin',
        skinTone: 'Fair',
        hair: 'Grey, short',
        eyes: 'Blue',
        clothing: 'Blue pyjamas, brown slippers',
        distinguishing: 'Walks with a slight limp on the left',
        medical: 'Early-stage dementia, hypertension',
        vehicle: 'None',
        languages: 'Afrikaans, English',
        surname: 'Botha',
        relationship: 'Father'
      },
      spotlightId: 'sp_botha',
      upvotes: 189,
      downvotes: 4,
      commentCount: 2,
      shares: 76,
      views: 3120,
      savedBy: 22,
      escalation: {
        requested: true,
        consentGranted: true,
        consentAt: now - 8 * HOUR,
        partners: [
          { partnerId: 'saps-station', partnerName: 'Nearest police station', status: 'noted', requestedAt: now - 8 * HOUR, sentAt: now - 8 * HOUR, reference: 'WES/118/09/2026' },
          { partnerId: 'missing-children-sa', partnerName: 'Missing Children South Africa', status: 'noted', requestedAt: now - 8 * HOUR, sentAt: now - 8 * HOUR, reference: null }
        ]
      },
      consent: [{ kind: 'escalation', label: 'Family called the station and Missing Children SA. LulaFind did not send the case', granted: true, at: now - 8 * HOUR, expiresAt: now + 30 * DAY }]
    }),

    base({
      id: 'p_sighting',
      type: 'sighting',
      authorId: 'u_pieter',
      title: 'Possible sighting: young girl matching the Orlando West case at Bellville station',
      body:
        'I was on the 07:10 train this morning and saw a girl who could be the learner from the Soweto post. She was with an older woman, no school uniform, carrying a blue plastic bag. I did not want to cause a scene.\n\n' +
        'I reported it to the station commander and attached my details to the LulaFind case. Adding it here so the family sees it fast.',
      province: 'WC',
      town: 'Bellville, Cape Town',
      lastSeenAt: now - 6 * HOUR,
      lastSeenWhere: 'Bellville station, platform 3',
      geo: { lat: -33.9006, lng: 18.6266, label: 'Bellville station' },
      contactValue: 'Report through the case',
      contactVisibleTo: 'owner',
      createdAt: now - 5 * HOUR,
      updatedAt: now - 5 * HOUR,
      upvotes: 143,
      downvotes: 2,
      commentCount: 1,
      shares: 33,
      views: 1880,
      media: [{ id: 'm1', kind: 'image', src: scene('Bellville station - platform 3', 'bell1', 'street'), caption: 'Where I was standing' }]
    }),

    base({
      id: 'p_story',
      type: 'story',
      authorId: 'u_lerato',
      title: 'We found Nomsa after 41 days. Here is what actually worked.',
      body:
        'Forty-one days is a long time. Here is the honest breakdown, because families always ask me what to do in the first 72 hours:\n\n' +
        '1. Open the SAPS case the same day. There is no 24-hour waiting period in South Africa - anyone who tells you that is wrong.\n' +
        '2. One family member becomes the single point of contact. Multiple numbers means nobody trusts any of them.\n' +
        '3. Print the poster with a current photo, the date and ONE number. Not five numbers.\n' +
        '4. Post in the places the person actually went - the taxi rank, the clinic, the tavern, the church.\n' +
        '5. Keep the phone on. Scammers target families within hours.\n\n' +
        'Nomsa was found in a shelter in Boksburg. She is safe.',
      province: 'GP',
      town: 'Boksburg',
      createdAt: now - 2 * DAY,
      updatedAt: now - 2 * DAY,
      status: 'found',
      outcome: { found: true, foundAt: now - 2 * DAY - 3 * HOUR, whereaboutsFound: 'Shelter in Boksburg', closedBy: 'u_lerato', note: 'Found safe.' },
      upvotes: 934,
      downvotes: 12,
      commentCount: 2,
      shares: 512,
      views: 21400,
      savedBy: 340,
      media: [{ id: 'm1', kind: 'image', src: scene('Nomsa - found safe', 'nomsa1', 'home'), caption: 'Posted with her family\'s permission' }]
    }),

    base({
      id: 'p_khumalo',
      type: 'khumbulekhaya',
      authorId: 'u_ayanda',
      title: 'KhumbulEkhaya: Sibusiso Khumalo, 19, left Pietermaritzburg after matric results',
      body:
        'Sibusiso failed two subjects and told his mother he was going to Johannesburg to find work. That was nine days ago. He has R300 and no jacket.\n\n' +
        'We are not looking to drag him back. We want to know he is alive. If you are Sibusiso, upvote this so we can chat - you can stay anonymous.',
      province: 'KZN',
      town: 'Pietermaritzburg',
      lastSeenAt: now - 9 * DAY,
      lastSeenWhere: 'Northway taxi rank',
      geo: { lat: -29.6006, lng: 30.3794, label: 'Northway' },
      contactValue: '076 555 0193',
      contactVisibleTo: 'verified',
      askWanted: true,
      createdAt: now - 4 * DAY,
      updatedAt: now - 20 * HOUR,
      spotlightId: 'sp_khumalo',
      subject: {
        name: 'Sibusiso Khumalo',
        age: 19,
        gender: 'male',
        height: '1.74 m',
        build: 'Athletic',
        skinTone: 'Dark brown',
        hair: 'Short fade',
        eyes: 'Brown',
        clothing: 'Green tracksuit, white takkies',
        distinguishing: 'Small burn mark on left forearm',
        medical: 'None',
        vehicle: 'None',
        languages: 'isiZulu, English',
        surname: 'Khumalo',
        relationship: 'Nephew'
      },
      khumbu: {
        daysOut: 9,
        leftHomeAt: now - 9 * DAY,
        reasonGuess: 'Left to look for work, ashamed of results',
        claimedByUserId: null,
        claimedAt: null,
        subjectResponse: 'none',
        subjectNote: '',
        wantedAnswers: { yes: 21, no: 9, myVote: null }
      },
      upvotes: 88,
      downvotes: 6,
      commentCount: 1,
      shares: 29,
      views: 1410
    }),

    base({
      id: 'p_found',
      type: 'missing',
      authorId: 'u_naledi',
      title: 'FOUND: Baby Anele (8 months) reunited with her mother in Nelspruit',
      body:
        'Anele was taken from outside a clinic on Friday. She is home. Her mother is holding her right now.\n\n' +
        'Thank you to the 2 100 people who shared this. The tip that closed it came from a spaza shop owner who recognised the blanket in the LulaFind photo.',
      province: 'MP',
      town: 'Nelspruit',
      createdAt: now - 5 * DAY,
      updatedAt: now - 3 * DAY,
      status: 'found',
      outcome: { found: true, foundAt: now - 3 * DAY, whereaboutsFound: 'Safe at home, Nelspruit', closedBy: 'u_naledi', note: 'Tip from a spaza shop owner matched the blanket in the photo.' },
      upvotes: 2104,
      downvotes: 5,
      commentCount: 1,
      shares: 1980,
      views: 48200,
      savedBy: 112,
      subject: {
        name: 'Anele Shongwe',
        age: 0,
        gender: 'female',
        height: 'n/a',
        build: 'Baby',
        skinTone: 'Dark brown',
        hair: 'n/a',
        eyes: 'Brown',
        clothing: 'Yellow blanket with blue elephants',
        distinguishing: '',
        medical: '',
        vehicle: '',
        languages: '',
        surname: 'Shongwe',
        relationship: 'Daughter'
      },
      media: [{ id: 'm1', kind: 'image', src: scene('Anele - home safe', 'anele1', 'home'), caption: 'Home safe. Photo used with consent.' }]
    }),

    base({
      id: 'p_anon',
      type: 'missing',
      authorId: 'u_tshepo',
      anonymous: true,
      title: 'My brother Tshepo Molefe has been missing from Rustenburg for 2 days',
      body:
        'I am posting anonymously because of who I believe took him. I have given my real details to LulaFind and to the police.\n\n' +
        'He was collecting a debt on Thursday night near Rustenburg CBD. His bakkie was found at home on Friday, keys in the ignition, but he was not in it.',
      province: 'NW',
      town: 'Rustenburg CBD',
      lastSeenAt: now - 2 * DAY,
      lastSeenWhere: 'Rustenburg CBD',
      contactValue: 'Through LulaFind only',
      contactVisibleTo: 'owner',
      caseNumber: 'RUS/902/09/2026',
      createdAt: now - 30 * HOUR,
      updatedAt: now - 30 * HOUR,
      upvotes: 76,
      downvotes: 3,
      commentCount: 1,
      shares: 18,
      views: 990,
      subject: {
        name: 'Tshepo Molefe',
        age: 34,
        gender: 'male',
        height: '1.80 m',
        build: 'Heavy',
        skinTone: 'Dark brown',
        hair: 'Bald',
        eyes: 'Brown',
        clothing: 'Blue jeans, grey hoodie',
        distinguishing: 'Missing tip of left little finger',
        medical: 'Diabetic',
        vehicle: 'White Toyota bakkie - recovered',
        languages: 'Setswana, English',
        surname: 'Molefe',
        relationship: 'Brother'
      }
    }),

    base({
      id: 'p_found_car',
      type: 'vehicle',
      authorId: 'u_johan',
      title: 'FOUND: White Toyota Hilux recovered in Bloemfontein',
      body:
        'The bakkie taken from outside a shop in Langenhoven Park was found by a patrol the same night. ' +
        'The owner has it back. The registration was given to SAPS and is not posted here.',
      province: 'FS',
      town: 'Bloemfontein',
      status: 'found',
      createdAt: now - 6 * DAY,
      updatedAt: now - 1 * DAY,
      outcome: {
        found: true,
        foundAt: now - 1 * DAY,
        whereaboutsFound: 'Recovered in Bloemfontein',
        closedBy: 'u_johan',
        note: 'A patrol matched the description. The owner collected it.'
      },
      upvotes: 240,
      shares: 86,
      views: 3100,
      subject: {
        name: '',
        age: null,
        gender: 'unknown',
        height: '',
        build: '',
        skinTone: '',
        hair: '',
        eyes: '',
        clothing: '',
        distinguishing: '',
        medical: '',
        vehicle: 'White Toyota Hilux',
        languages: '',
        surname: '',
        relationship: ''
      }
    }),

    base({
      id: 'p_found_pet',
      type: 'pet',
      authorId: 'u_lerato',
      title: 'FOUND: Rex the boerboel is back in Mamelodi',
      body:
        'Rex slipped his collar at the taxi rank on Sunday. A neighbour recognised him from the photo and walked him home the next morning.',
      province: 'GP',
      town: 'Mamelodi, Pretoria',
      status: 'found',
      createdAt: now - 3 * DAY,
      updatedAt: now - 12 * HOUR,
      outcome: {
        found: true,
        foundAt: now - 12 * HOUR,
        whereaboutsFound: 'Home in Mamelodi',
        closedBy: 'u_lerato',
        note: 'A neighbour matched the photo.'
      },
      upvotes: 96,
      shares: 22,
      views: 880
    }),

    // ---- inside the surname Spotlights, so those pages are not empty ----

    base({
      id: 'p_ndlela_sight',
      type: 'sighting',
      authorId: 'u_lindiwe',
      title: 'Sighting at Umlazi taxi rank - man matching our father',
      body:
        'A hawker at the Umlazi taxi rank says a man matching our father\'s description bought airtime on Tuesday morning. ' +
        'He was wearing a dark jacket and carrying a plastic bag.\n\n' +
        'We are not asking anyone to follow him. Please take a photo from a safe distance and send it to the number on this case.',
      province: 'KZN',
      town: 'Umlazi, Durban',
      spotlightId: 'sp_ndlela',
      createdAt: now - 1 * DAY,
      updatedAt: now - 5 * HOUR,
      upvotes: 134,
      downvotes: 2,
      commentCount: 0,
      shares: 88,
      views: 2310
    }),

    base({
      id: 'p_ndlela_update',
      type: 'missing',
      authorId: 'u_sipho',
      title: 'Update from the Ndlela family: posters are up in four suburbs',
      body:
        'Thank you to everyone in this Spotlight. The posters are now up in Umlazi, Isipingo, Amanzimtoti and Chatsworth. ' +
        'We have also given copies to three taxi associations.\n\n' +
        'If you print one for your own street, please post a photo here so we do not overlap.',
      province: 'KZN',
      town: 'Umlazi, Durban',
      spotlightId: 'sp_ndlela',
      createdAt: now - 3 * DAY,
      updatedAt: now - 1 * DAY,
      upvotes: 212,
      downvotes: 1,
      commentCount: 0,
      shares: 156,
      views: 4180
    }),

    base({
      id: 'p_mokoena_tip',
      type: 'story',
      authorId: 'u_demo',
      title: 'What actually worked for the Mokoena family search',
      body:
        'We found my uncle after eleven days. Three things made the difference:\n\n' +
        '1. One phone number on the poster, not five. People got confused.\n' +
        '2. A clear daytime photo, not a party photo.\n' +
        '3. Asking the spaza shops and taxi ranks directly, in person.\n\n' +
        'Sharing this here so the next family in this Spotlight does not start from nothing.',
      province: 'GP',
      town: 'Soweto, Johannesburg',
      spotlightId: 'sp_mokoena',
      createdAt: now - 6 * DAY,
      updatedAt: now - 6 * DAY,
      upvotes: 401,
      downvotes: 3,
      commentCount: 0,
      shares: 322,
      views: 9640,
      savedBy: 88
    }),

    base({
      id: 'p_khumalo_sight',
      type: 'sighting',
      authorId: 'u_sibusiso',
      title: 'Green tracksuit seen near Pinetown station on Friday night',
      body:
        'Two people separately described a young man in a green tracksuit near Pinetown station between 20:00 and 21:00 on Friday. ' +
        'Both said he was alone and walking towards the Mall.\n\n' +
        'This may be nothing. It may be Sibusiso. Either way, the family wants to know.',
      province: 'KZN',
      town: 'Pinetown',
      spotlightId: 'sp_khumalo',
      createdAt: now - 2 * DAY,
      updatedAt: now - 8 * HOUR,
      upvotes: 97,
      downvotes: 4,
      commentCount: 0,
      shares: 71,
      views: 1870
    }),

    base({
      id: 'p_botha_reunion',
      type: 'story',
      authorId: 'u_johan',
      title: 'Botha family day in Bloemfontein - 240 of us, and one empty chair',
      body:
        'We held our family day on Saturday. 240 Bothas came from five provinces. ' +
        'We kept one chair empty for the cousin we have not found since 2019.\n\n' +
        'If your family has someone missing, hold the chair too. It keeps the search honest.',
      province: 'FS',
      town: 'Bloemfontein',
      spotlightId: 'sp_botha',
      createdAt: now - 8 * DAY,
      updatedAt: now - 8 * DAY,
      upvotes: 528,
      downvotes: 6,
      commentCount: 0,
      shares: 244,
      views: 11200,
      savedBy: 41
    }),

    base({
      id: 'p_danger_bree',
      type: 'danger',
      authorId: 'u_kabelo',
      title: 'Violence near Bree taxi rank, Johannesburg',
      body:
        'I was at the Bree taxi rank a few minutes ago. A fight broke out by the north entrance and two people were hurt. ' +
        'People are running toward the station side.\n\n' +
        'Do not come closer. If you are already here, move to the station side and call 10111. I did not follow anyone and I am not naming anyone.',
      province: 'GP',
      town: 'Johannesburg CBD',
      lastSeenAt: now - 18 * 60_000,
      lastSeenWhere: 'Bree taxi rank, north entrance',
      geo: { lat: -26.2044, lng: 28.0436 },
      createdAt: now - 18 * 60_000,
      updatedAt: now - 12 * 60_000,
      chatEnabled: false,
      upvotes: 6,
      views: 84,
      shares: 11,
      danger: {
        kind: 'violence',
        stillIds: ['u_lerato'],
        clearIds: [],
        clearedAt: null
      },
      media: [{ id: 'm_bree', kind: 'image', src: scene('Bree taxi rank', 'bree', 'night'), caption: 'North entrance, just now' }]
    })
  ];
};

export const seedComments = (): Comment[] => [
  {
    id: 'c1', postId: 'p_thato', parentId: null, authorId: 'u_kabelo', createdAt: now - 2 * DAY,
    body: 'I spoke to the spaza owner opposite Orlando taxi rank. She says two girls matching this description got into a white Quantum heading towards Roodepoort around 10:00 on Tuesday.',
    upvotes: 96, isLead: true,
    sighting: { place: 'Orlando taxi rank', province: 'GP', when: now - 3 * DAY + HOUR, note: 'White Quantum towards Roodepoort' }
  },
  {
    id: 'c2', postId: 'p_thato', parentId: null, authorId: 'u_lerato', createdAt: now - 1 * DAY,
    body: 'Reminder: there is NO 24-hour waiting period in South Africa. If anyone at a station tells you to wait, escalate to the station commander immediately. Case number is on this post, so you are already correct.',
    upvotes: 214, isLead: false
  },
  {
    id: 'c3', postId: 'p_thato', parentId: 'c1', authorId: 'u_demo', createdAt: now - 20 * HOUR,
    body: 'Thank you Kabelo. I reported the Quantum at the station. Please DM me through the case chat - I want to speak to the spaza owner directly.',
    upvotes: 41, isLead: false
  },
  {
    id: 'c4', postId: 'p_lindiwe', parentId: null, authorId: 'u_zanele', createdAt: now - 3 * DAY,
    body: 'Sending love to the Ndlela family. The hardest part of KhumbulEkhaya is the not knowing. Lindiwe, your family is not angry. They miss you.',
    upvotes: 88, isLead: false
  },
  {
    id: 'c5', postId: 'p_lindiwe', parentId: null, authorId: 'u_ayanda', createdAt: now - 2 * DAY,
    body: 'I have cousins who work at the Isipingo salon. I am going there tomorrow to ask quietly. Will update this thread.',
    upvotes: 52, isLead: true
  },
  {
    id: 'c6', postId: 'p_lindiwe', parentId: null, authorId: 'u_bongani', createdAt: now - 6 * HOUR,
    body: 'To whoever this is about: nobody is going to force you home. Just tell them you are alive. That is all they are asking for.',
    upvotes: 133, isLead: false
  },
  {
    id: 'c7', postId: 'p_johan', parentId: null, authorId: 'u_johan', createdAt: now - 4 * HOUR,
    body: 'UPDATE: A farm worker on Weltevrede found footprints heading north-east towards the dam. Searchers are moving there now. Please stay off the R30 verges so the tracks are not disturbed.',
    upvotes: 71, isLead: true
  },
  {
    id: 'c8', postId: 'p_johan', parentId: null, authorId: 'u_pieter', createdAt: now - 2 * HOUR,
    body: 'Drone operator available - I can be there by 14:00 with a thermal camera. Sending you a chat message now.',
    upvotes: 64, isLead: true
  },
  {
    id: 'c9', postId: 'p_sighting', parentId: null, authorId: 'u_demo', createdAt: now - 3 * HOUR,
    body: 'Thank you Pieter. This is exactly the right way to do it - you did not approach, you reported. I have forwarded this to SAPS Bellville and they are pulling the platform camera footage.',
    upvotes: 122, isLead: false
  },
  {
    id: 'c10', postId: 'p_story', parentId: null, authorId: 'u_naledi', createdAt: now - 1 * DAY,
    body: 'Point 5 is the one nobody tells you. Within 12 hours of posting Nomsa, the family got four calls asking for money. Save this post.',
    upvotes: 305, isLead: false
  },
  {
    id: 'c11', postId: 'p_story', parentId: null, authorId: 'u_fatima', createdAt: now - 22 * HOUR,
    body: 'Writing this up for the community paper with the family\'s permission. LulaFind is doing what the notice boards at the station could never do.',
    upvotes: 88, isLead: false
  },
  {
    id: 'c12', postId: 'p_found', parentId: null, authorId: 'u_kabelo', createdAt: now - 3 * DAY,
    body: 'The blanket detail is why photos matter. Always post the clothing and the blanket, not just the face.',
    upvotes: 402, isLead: false
  },
  {
    id: 'c13', postId: 'p_khumalo', parentId: null, authorId: 'u_zanele', createdAt: now - 1 * DAY,
    body: 'Sibusiso, if you are reading: upvoting this post unlocks a private chat with your uncle. Nobody else sees it. You do not have to come home today, just say you are alive.',
    upvotes: 77, isLead: false
  },
  {
    id: 'c14', postId: 'p_anon', parentId: null, authorId: 'u_mod', createdAt: now - 28 * HOUR,
    body: 'LulaFind Trust & Safety: this post is anonymous to the public but the poster is verified with us and with SAPS. Reports of intimidation around this case should go to Crime Stop 08600 10111.',
    upvotes: 190, isLead: false
  }
];

export const seedStories = (): Story[] => [
  {
    id: 's1', authorId: 'u_demo', createdAt: now - 3 * HOUR, expiresAt: now + 21 * HOUR,
    media: [{ id: 'sm1', kind: 'image', src: scene('Prayer vigil - Orlando', 'vigil', 'night') }],
    text: 'Prayer vigil at Orlando community hall tonight, 19:00. Bring a candle. #FindThato',
    bgHue: 28, viewers: ['u_lerato', 'u_kabelo'], replies: [{ id: 'r1', storyId: 's1', authorId: 'u_lerato', body: 'On my way', at: now - 2 * HOUR }], audience: 'public', spotlightId: null
  },
  {
    id: 's2', authorId: 'u_ayanda', createdAt: now - 8 * HOUR, expiresAt: now + 16 * HOUR,
    media: [{ id: 'sm2', kind: 'image', src: scene('Radio net - search comms', 'radio', 'map') }],
    text: 'Amateur radio net active on 145.500 for the Weltevrede search. Farmers, please report in.',
    bgHue: 150, viewers: ['u_johan'], replies: [], audience: 'public', spotlightId: null
  },
  {
    id: 's3', authorId: 'u_pieter', createdAt: now - 12 * HOUR, expiresAt: now + 12 * HOUR,
    media: [{ id: 'sm3', kind: 'image', src: scene('CPF poster drive', 'poster', 'street') }],
    text: '200 posters up around Bellville station this morning. Thank you to the CPF.',
    bgHue: 210, viewers: [], replies: [], audience: 'public', spotlightId: null
  },
  {
    id: 's4', authorId: 'u_lerato', createdAt: now - 1 * DAY, expiresAt: now + 23 * HOUR,
    media: [], text: 'Reminder: there is no 24-hour rule. Report a missing person the moment you are worried.',
    bgHue: 340, viewers: ['u_demo', 'u_naledi', 'u_zanele'], replies: [], audience: 'public', spotlightId: null
  },
  {
    id: 's5', authorId: 'u_naledi', createdAt: now - 2 * DAY + 3 * HOUR, expiresAt: now + 22 * HOUR,
    media: [{ id: 'sm5', kind: 'image', src: scene('Anele is home', 'anele', 'home') }],
    text: 'She is home. Thank you Mpumalanga.',
    bgHue: 45, viewers: ['u_demo', 'u_lerato', 'u_johan', 'u_kabelo'], replies: [], audience: 'public', spotlightId: null
  },
  {
    id: 's6', authorId: 'u_kabelo', createdAt: now - 30 * HOUR, expiresAt: now + 18 * HOUR,
    media: [{ id: 'sm6', kind: 'image', src: scene('Search party - Roodepoort', 'roode', 'street') }],
    text: 'Volunteers at Roodepoort, following up the Quantum lead.',
    bgHue: 200, viewers: [], replies: [], audience: 'public', spotlightId: null
  }
];

export const seedTips = () => [
  {
    id: 't1', category: 'reporting' as const, urgent: true,
    title: 'There is NO 24-hour waiting period in South Africa',
    body: 'Any SAPS official who tells you to wait 24 hours is wrong. Report immediately, insist on a case number, and escalate to the station commander if you are refused. Time is the single biggest factor in finding someone.',
    cta: { label: 'Report a missing person', route: '/create/missing' }
  },
  {
    id: 't2', category: 'reporting' as const,
    title: 'The first 72 hours: a checklist',
    body: '1) Open the SAPS case and get the number. 2) Nominate ONE family spokesperson. 3) Collect a recent, clear, unfiltered photo. 4) Write down exactly what they wore, including shoes and jewellery. 5) Get the phone number to the network for a last-known-cell request. 6) Post one number on the poster - not five.',
    cta: null
  },
  {
    id: 't3', category: 'safety' as const, urgent: true,
    title: 'Never approach a suspected sighting alone',
    body: 'If you think you have seen someone from a LulaFind case, do not confront anyone. Note the time, the exact place, what they wore, who they were with and any vehicle registration. Report through the case and call 10111 if a child is in immediate danger.',
    cta: { label: 'Report a sighting', route: '/create/sighting' }
  },
  {
    id: 't4', category: 'digital' as const,
    title: 'Beware of scam calls within the first 24 hours',
    body: 'Predators monitor missing-person posts and call families demanding money for "information" or "ransom". Never pay. Never share your case number publicly beyond the post. LulaFind never asks you for money and never asks for your password or OTP.',
    cta: null
  },
  {
    id: 't5', category: 'legal' as const,
    title: 'Consent is what makes location tracking legal',
    body: 'LulaFind will only ever read a location with the explicit, revocable consent of the person whose location it is. We never silently track anyone. If a subject declines, that is final - and we tell you, because a "no" is also information.',
    cta: { label: 'Safety & consent centre', route: '/safety' }
  },
  {
    id: 't6', category: 'legal' as const,
    title: 'Posting a child: guardian consent is required',
    body: 'For anyone under 18, LulaFind requires confirmation from a parent, guardian or a SAPS officer before the case goes public, and the case is reviewed by a human moderator. This protects the child and keeps the platform out of the hands of people who would misuse it.',
    cta: null
  },
  {
    id: 't7', category: 'support' as const,
    title: 'KhumbulEkhaya: the person may not want to come home',
    body: 'Not everyone who leaves is in danger. Some are escaping. LulaFind lets the person themselves answer - "I am coming", "I am safe but not coming home", or "let us chat" - without being forced back. Your job is to let them know they are not in trouble.',
    cta: { label: 'Post a KhumbulEkhaya', route: '/create/khumbulekhaya' }
  },
  {
    id: 't8', category: 'support' as const,
    title: 'Free support lines',
    body: 'Police 10111 · Ambulance 10177 · GBV Command Centre 0800 428 428 · TEARS 0800 083 277 · Childline 116 and 0800 055 555 · SADAG 0800 567 567 · Missing Children SA 072 647 7464. LulaFind does not call them for you.',
    cta: { label: 'Call them', route: '/help' }
  },
  {
    id: 't9', category: 'digital' as const,
    title: 'What makes a poster actually work',
    body: 'A current photo, the full name, the age, the date they went missing, ONE contact number and the SAPS case number. Keep it to one page. Post it where the person actually went: the taxi rank, the clinic, the church, the tavern, the school gate.',
    cta: null
  },
  {
    id: 't10', category: 'safety' as const,
    title: 'Share widely, but never share a home address',
    body: 'Sharing multiplies eyes on the ground. But do not publish a home address, a school route or a child\'s routine. LulaFind\'s share card strips contact details automatically when you choose "verified only".',
    cta: null
  }
];
