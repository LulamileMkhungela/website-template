import { Post, provinceName } from '../models/types';
import { dayMonth } from './format';

/**
 * A public flyer. PawBoost's own poster advice is to keep it short and leave
 * one identifying mark off, so a caller has to know it. The reward amount
 * stays off too — a public amount is how fake tipsters pick a family.
 * LulaFind cannot track a vehicle. That line is on the flyer, not implied.
 */
export function publicPoster(post: Post): { lines: string[]; withheld: string | null; shareText: string } {
  const lines: string[] = [];
  if (post.subject?.name) {
    lines.push(post.subject.age != null ? `${post.subject.name}, ${post.subject.age}` : post.subject.name);
  }
  const where = [post.lastSeenWhere, post.town, provinceName(post.province)].filter(Boolean).join(', ');
  if (where) lines.push(`Last seen: ${where}${post.lastSeenAt ? ` · ${dayMonth(post.lastSeenAt)}` : ''}`);
  if (post.type !== 'vehicle' && post.subject?.clothing) lines.push(`Wearing: ${post.subject.clothing}`);
  if (post.type === 'vehicle' || post.type === 'pet') {
    const brief = post.body.replace(/\s+/g, ' ').trim().slice(0, 180);
    if (brief) lines.push(brief);
  }
  if (post.caseNumber) lines.push(`Station case: ${post.caseNumber}`);
  if (post.contactVisibleTo === 'everyone' && post.contactValue) {
    lines.push(`${post.contactLabel || 'Contact'}: ${post.contactValue}`);
  }
  const withheld = post.subject?.distinguishing?.trim() || null;
  const close = post.type === 'vehicle'
    ? 'LulaFind cannot track this vehicle. Report it at a police station. Do not buy it from a stranger.'
    : 'If they are in danger, call 10111. This is not a police poster.';
  return {
    lines,
    withheld,
    shareText: [post.title, ...lines, close].join('\n')
  };
}
