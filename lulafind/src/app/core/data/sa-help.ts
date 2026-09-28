/**
 * South African help contacts checked against the organisation's own page
 * or a government page. Do not add a number from a roundup.
 *
 * LulaFind does not dispatch police, an ambulance, or a private response team.
 * These are links the person taps themselves.
 */

export type HelpGroup = 'now' | 'violence' | 'child' | 'missing' | 'apps';

export interface HelpLine {
  id: string;
  group: HelpGroup;
  name: string;
  /** What the person sees and dials. */
  number: string;
  detail: string;
  href: string;
  actionLabel: string;
  reach: 'Official' | 'NGO' | 'Separate app';
  /** The poster can record that they used this from a case. */
  onCase?: boolean;
  /** Missing-person NGOs. Hidden on a vehicle, pet, or danger post. */
  personOnly?: boolean;
}

export const HELP_GROUPS: { key: HelpGroup; label: string }[] = [
  { key: 'now', label: 'Right now' },
  { key: 'violence', label: 'Violence or abuse' },
  { key: 'child', label: 'A child' },
  { key: 'missing', label: 'A missing person' },
  { key: 'apps', label: 'Other apps — not LulaFind' }
];

export const HELP_LINES: HelpLine[] = [
  {
    id: 'saps-10111',
    group: 'now',
    name: 'Police',
    number: '10111',
    detail: 'SAPS emergency. Use this if someone is in danger now.',
    href: 'tel:10111',
    actionLabel: 'Call',
    reach: 'Official',
    onCase: true
  },
  {
    id: 'ambulance',
    group: 'now',
    name: 'Ambulance',
    number: '10177',
    detail: 'Public ambulance. Listed by municipalities as the national number.',
    href: 'tel:10177',
    actionLabel: 'Call',
    reach: 'Official'
  },
  {
    id: 'cellphone-112',
    group: 'now',
    name: 'From a cellphone',
    number: '112',
    detail: 'Try this if 10111 does not connect.',
    href: 'tel:112',
    actionLabel: 'Call',
    reach: 'Official'
  },
  {
    id: 'gbvcc',
    group: 'violence',
    name: 'GBV Command Centre',
    number: '0800 428 428',
    detail: 'Social workers, 24 hours. They can refer to the police. Call this one.',
    href: 'tel:0800428428',
    actionLabel: 'Call',
    reach: 'Official'
  },
  {
    id: 'tears',
    group: 'violence',
    name: 'TEARS Foundation',
    number: '0800 083 277',
    detail: 'Also written 08000 TEARS. Rape, abuse, and shelter help. 24 hours.',
    href: 'tel:0800083277',
    actionLabel: 'Call',
    reach: 'NGO'
  },
  {
    id: 'tears-ussd',
    group: 'violence',
    name: 'TEARS nearest help',
    number: '*134*7355#',
    detail: 'Their support locator. It texts the nearest help. No app needed.',
    href: 'tel:*134*7355%23',
    actionLabel: 'Dial',
    reach: 'NGO'
  },
  {
    id: 'sadag',
    group: 'violence',
    name: 'SADAG suicide crisis',
    number: '0800 567 567',
    detail: '24-hour suicide crisis line. Not the police.',
    href: 'tel:0800567567',
    actionLabel: 'Call',
    reach: 'NGO'
  },
  {
    id: 'childline-116',
    group: 'child',
    name: 'Childline',
    number: '116',
    detail: 'Free from all networks, 24 hours. For a child, or an adult worried about a child.',
    href: 'tel:116',
    actionLabel: 'Call',
    reach: 'NGO'
  },
  {
    id: 'childline-0800',
    group: 'child',
    name: 'Childline',
    number: '0800 055 555',
    detail: 'The same Childline service. Their site lists both numbers.',
    href: 'tel:0800055555',
    actionLabel: 'Call',
    reach: 'NGO'
  },
  {
    id: 'crime-stop',
    group: 'missing',
    name: 'Crime Stop',
    number: '08600 10111',
    detail: 'Anonymous tip. Not the emergency line. Do not use this instead of 10111.',
    href: 'tel:0860010111',
    actionLabel: 'Call',
    reach: 'Official',
    onCase: true
  },
  {
    id: 'missing-children-sa',
    group: 'missing',
    name: 'Missing Children South Africa',
    number: '072 647 7464',
    detail: '24/7. They assist the police. You call them. LulaFind does not send the case.',
    href: 'tel:0726477464',
    actionLabel: 'Call',
    reach: 'NGO',
    onCase: true,
    personOnly: true
  },
  {
    id: 'pink-ladies',
    group: 'missing',
    name: 'Pink Ladies',
    number: '072 214 7439',
    detail: 'WhatsApp. Only to report a missing person or pass on information.',
    href: 'https://wa.me/27722147439',
    actionLabel: 'WhatsApp',
    reach: 'NGO',
    onCase: true,
    personOnly: true
  },
  {
    id: 'saps-station',
    group: 'missing',
    name: 'Report at a police station',
    number: 'SAPS steps',
    detail: 'No waiting period. Sign SAPS 55(A). This app cannot open the docket.',
    href: 'https://www.saps.gov.za/services/report_missing_person.php',
    actionLabel: 'Official steps',
    reach: 'Official',
    onCase: true
  },
  {
    id: 'grit-play',
    group: 'apps',
    name: 'GRIT app',
    number: 'Google Play',
    detail: 'Panic button and a private evidence vault. Separate app. Not LulaFind.',
    href: 'https://play.google.com/store/apps/details?id=com.ads.apps.kwanele',
    actionLabel: 'Open',
    reach: 'Separate app'
  },
  {
    id: 'grit-ios',
    group: 'apps',
    name: 'GRIT app',
    number: 'App Store',
    detail: 'Same GRIT app on iPhone. LulaFind does not alert their team.',
    href: 'https://apps.apple.com/za/app/grit-app/id1616602924',
    actionLabel: 'Open',
    reach: 'Separate app'
  },
  {
    id: 'zuzi-wa',
    group: 'apps',
    name: 'Zuzi',
    number: 'WhatsApp',
    detail: 'GRIT’s chat. Not a counsellor and not a lawyer. Not LulaFind.',
    href: 'https://wa.me/27877252215?text=Hi%20Zuzi',
    actionLabel: 'Open',
    reach: 'Separate app'
  },
  {
    id: 'zuzi-web',
    group: 'apps',
    name: 'Zuzi',
    number: 'chatgbv.app',
    detail: 'The same chat in a browser, if WhatsApp is not safe to open.',
    href: 'https://chatgbv.app/',
    actionLabel: 'Open',
    reach: 'Separate app'
  },
  {
    id: 'my-saps',
    group: 'apps',
    name: 'My SAPS',
    number: 'Google Play',
    detail: 'Official missing and wanted lists, tip-offs, and FCS contacts.',
    href: 'https://play.google.com/store/apps/details?id=co.za.vodacom.boxfusion.saps',
    actionLabel: 'Open',
    reach: 'Official',
    onCase: true
  },
  {
    id: 'my-saps-ios',
    group: 'apps',
    name: 'My SAPS',
    number: 'App Store',
    detail: 'Same official SAPS app. Amber Alerts are issued by SAPS, not by LulaFind.',
    href: 'https://apps.apple.com/za/app/my-saps/id1478487910',
    actionLabel: 'Open',
    reach: 'Official'
  }
];

/** Shown under the GBV voice line. Not a call button — those codes are not confirmed live. */
export const GBV_CHANNEL_NOTE =
  'The Command Centre website also lists *120*7867# and SMS “help” to 31531, plus Skype “Helpme GBV”. In December 2024 the department said only the voice line was back. If a code does not connect, call 0800 428 428.';

/** Live SAPS Crime Stop list, opened 25 September 2026. Not a LulaFind list. */
export const SAPS_MISSING_LIST = 'https://www.saps.gov.za/crimestop/missing/list.php';

/** From the SAPS “Report a Missing Person” page. Do not shorten away the form names. */
export const SAPS_MISSING_STEPS = [
  'Go to the nearest police station now. There is no waiting period.',
  'Take a recent photo, and say the clothes and the last place.',
  'Sign the SAPS 55(A) form so police can circulate the photo.',
  'Write down the investigating officer’s number.',
  'If the person comes home, tell that officer. They complete a SAPS 92.'
];

export const NOT_OUR_PANIC =
  'Namola and Gauteng e-Panic call a private response team. LulaFind does not. If you already use one of those, open that app for the panic button.';

export const INFORMED_NOTE =
  'GRIT’s protection-order helper, inFORMed, is still being built. It does not file the order.';

export interface CaseContact {
  id: string;
  name: string;
  detail: string;
  reach: string;
  defaultOn: boolean;
  href: string;
  actionLabel: string;
  personOnly?: boolean;
}

/** Services a poster can call from a case. Never pre-ticked — a tick means they called. */
export const CASE_CONTACTS: CaseContact[] = HELP_LINES.filter((line) => line.onCase).map((line) => ({
  id: line.id,
  name: line.name,
  detail: line.detail,
  reach: line.reach,
  defaultOn: false,
  href: line.href,
  actionLabel: line.actionLabel,
  personOnly: line.personOnly
}));

export function escalationNote(status: string): string {
  switch (status) {
    case 'noted':
      return 'You contacted them. Not sent by LulaFind.';
    case 'sent':
      return 'Noted on this case. Not sent by LulaFind.';
    case 'acknowledged':
      return 'Not a police confirmation.';
    case 'declined':
      return 'Declined';
    case 'failed':
      return 'Could not record';
    default:
      return 'Waiting';
  }
}
