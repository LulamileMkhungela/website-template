import { Post } from '../models/types';

export interface SearchFocus {
  ring: 'green' | 'amber' | 'red';
  title: string;
  where: string;
  /** One sentence. Shown on the case, not repeated as a paragraph on every card. */
  why: string;
}

const MILE_GUIDE =
  'UK police research found most missing people within 5 miles of the last place (Gibb & Woolnough, 2007). Start there. This is a guide, not a South African police score.';

/**
 * Where a viewer should look first. No extra form, and no invented crime score.
 *
 * College of Policing: search the place the person went missing from first.
 * Gibb & Woolnough 2007, as cited by O'Brien et al. (2022): most missing people
 * were found within 5 miles of where they went missing.
 * Woolnough (2016): most missing adults went to a familiar place, often on foot.
 * A vehicle is not that pattern, so a car case does not use the 5-mile line.
 */
export function searchFocus(post: Post, now = Date.now()): SearchFocus | null {
  if (post.status !== 'active') return null;
  if (post.type !== 'missing' && post.type !== 'pet' && post.type !== 'vehicle') return null;

  const place = post.lastSeenWhere?.trim() || post.town?.trim() || 'the last-seen place';
  const hours = post.lastSeenAt ? (now - post.lastSeenAt) / 3_600_000 : 0;
  const driven = post.type === 'vehicle' || !!post.subject?.vehicle?.trim();

  if (driven) {
    return {
      ring: 'red',
      title: 'Check the roads out',
      where: place,
      why: 'A vehicle can leave the suburb in minutes. Check the last-seen roads, then the main routes out of town.'
    };
  }

  if (post.type === 'pet') {
    return {
      ring: hours < 6 ? 'green' : 'amber',
      title: hours < 6 ? 'Look here first' : 'Check the next streets',
      where: place,
      why: 'Start where the pet was last seen, then the yards and streets next to that place.'
    };
  }

  if (hours < 6) {
    return { ring: 'green', title: 'Look here first', where: place, why: MILE_GUIDE };
  }
  if (hours < 24) {
    return {
      ring: 'amber',
      title: 'Then check familiar places',
      where: post.town?.trim() || place,
      why: 'UK research found most missing adults went to a familiar place, often on foot (Woolnough, 2016). Cover the last-seen place, then home and friends. Not a police score.'
    };
  }
  return {
    ring: 'red',
    title: 'Still start at the last place',
    where: place,
    why: 'It has been a day. Still cover the last-seen place before going further. ' + MILE_GUIDE
  };
}
