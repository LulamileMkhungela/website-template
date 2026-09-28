/* ------------------------------------------------------------------ *
 * LulaFind - domain model
 * ------------------------------------------------------------------ */

export type ProvinceCode =
  | 'EC' | 'FS' | 'GP' | 'KZN' | 'LP' | 'MP' | 'NW' | 'NC' | 'WC';

export interface Province {
  code: ProvinceCode;
  name: string;
  short: string;
  /** representative coordinates used by the mock location layer */
  lat: number;
  lng: number;
}

export const PROVINCES: Province[] = [
  { code: 'GP', name: 'Gauteng', short: 'GP', lat: -26.2041, lng: 28.0473 },
  { code: 'KZN', name: 'KwaZulu-Natal', short: 'KZN', lat: -29.8587, lng: 31.0218 },
  { code: 'WC', name: 'Western Cape', short: 'WC', lat: -33.9249, lng: 18.4241 },
  { code: 'EC', name: 'Eastern Cape', short: 'EC', lat: -33.9608, lng: 25.6022 },
  { code: 'FS', name: 'Free State', short: 'FS', lat: -29.0852, lng: 26.1596 },
  { code: 'LP', name: 'Limpopo', short: 'LP', lat: -23.9045, lng: 29.4689 },
  { code: 'MP', name: 'Mpumalanga', short: 'MP', lat: -25.4753, lng: 30.9698 },
  { code: 'NW', name: 'North West', short: 'NW', lat: -25.8653, lng: 25.6483 },
  { code: 'NC', name: 'Northern Cape', short: 'NC', lat: -28.7283, lng: 24.7489 }
];

export const provinceName = (c?: ProvinceCode | string): string =>
  PROVINCES.find((p) => p.code === c)?.name ?? 'South Africa';

/**
 * What a case can be about.
 *
 * 'vehicle' and 'pet' exist because a hijacking or a lost dog reaches the same
 * neighbourhood, on the same phone, in the same hour as a missing person - and
 * every other South African search app already treats them as first-class.
 */
export type PostType = 'missing' | 'khumbulekhaya' | 'story' | 'sighting' | 'vehicle' | 'pet' | 'danger';

/** What someone saw at a dangerous place. A place, not a suspect. */
export type DangerKind = 'violence' | 'robbery' | 'hijacking' | 'unrest' | 'fire' | 'other';

export const DANGER_KINDS: { key: DangerKind; label: string }[] = [
  { key: 'violence', label: 'Violence' },
  { key: 'robbery', label: 'Robbery' },
  { key: 'hijacking', label: 'Hijacking' },
  { key: 'unrest', label: 'Unrest' },
  { key: 'fire', label: 'Fire' },
  { key: 'other', label: 'Other danger' }
];

export const dangerLabel = (k?: DangerKind | null): string =>
  DANGER_KINDS.find((d) => d.key === k)?.label ?? 'Danger';

/** Community check on a danger alert. One person, one vote. The poster can clear it. */
export interface DangerAlert {
  kind: DangerKind;
  stillIds: string[];
  clearIds: string[];
  clearedAt: number | null;
}
export type Audience = 'public' | 'followers' | 'surname';
export type VoteValue = 'up' | 'down' | null;
export type PostStatus = 'active' | 'found' | 'closed' | 'not_going_home' | 'under_review' | 'removed';
export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

/** One area of a ground search, claimed by a volunteer. */
export interface SearchZone {
  id: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  takenBy: string | null;
  done: boolean;
  note: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  label?: string;
  accuracyM?: number;
  at?: number;
}

/** What other people are allowed to see on a profile. Owner always sees all. */
export interface PrivacyPrefs {
  /** show the suburb and province on the public profile */
  showLocation: boolean;
  /** show the follower / following / help-points numbers */
  showStats: boolean;
  /** show which surname communities this person belongs to */
  showSpotlights: boolean;
  /** allow anyone to send a private chat request */
  allowMessages: boolean;
  /** automatically keep sharing location for 1 hour after a check-in */
  autoShareLocation: boolean;
  /** let LulaFind notify your followers to check on you if a share expires unanswered */
  notifyFollowersOnExpiry: boolean;
  /**
   * When on, someone tapping Follow only sends a request that you accept or
   * decline. When off - the default - follows go straight through.
   */
  requireFollowApproval: boolean;
}

export const defaultPrivacy = (): PrivacyPrefs => ({
  showLocation: false,
  showStats: true,
  showSpotlights: true,
  allowMessages: true,
  autoShareLocation: false,
  notifyFollowersOnExpiry: true,
  requireFollowApproval: false
});

export type CheckInStatus = 'safe' | 'unfamiliar' | 'need_help';

/** A status a person sets about themselves - shown on their profile. */
export interface CheckIn {
  status: CheckInStatus;
  note: string;
  at: number;
  /** set when the person chose to share where they are */
  location: GeoPoint | null;
  /** live sharing stops here; 1 hour after it started */
  liveUntil: number | null;
  liveShareOn: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  avatarHue: number;
  /** Photo the person added. The name stays the one from signup. */
  avatarUrl?: string;
  bio: string;
  province: ProvinceCode | null;
  town: string;
  surname: string;
  createdAt: number;
  verified: boolean;
  anonymous: boolean;
  /** user opted in to being contacted by LulaFind if they appear in a case */
  findableProfile: boolean;
  /** periodic "I'm safe" check-ins enabled */
  safetyBeacon: boolean;
  lastBeaconAt: number | null;
  followers: number;
  following: number;
  /** help points - earned when people find your answers useful */
  karma: number;
  /**
   * Times this person was selected as the one who found someone.
   * The profile badge reads "Contributor x4" from this number.
   */
  contributorCredits?: number;
  onboarded: boolean;
  blockedUserIds: string[];
  /** spotlight (surname) communities this user administers */
  spotlightIds: string[];
  /** LulaFind staff / moderator - can remove posts and people */
  isAdmin: boolean;
  /** blocked by an admin: cannot post, vote, comment or chat */
  suspended: boolean;
  privacy: PrivacyPrefs;
  checkIn: CheckIn | null;
}

/* ------------------------------------------------------------------ *
 * Moderation
 * ------------------------------------------------------------------ */

export type ReportTarget = 'post' | 'user' | 'comment';

export interface UserReport {
  id: string;
  target: ReportTarget;
  targetId: string;
  /** snapshot so the admin queue still makes sense after the item changes */
  summary: string;
  reason: string;
  detail: string;
  byUserId: string;
  at: number;
  status: 'open' | 'actioned' | 'dismissed';
  resolvedAt: number | null;
  adminNote: string;
  actionTaken: string | null;
}

export const REPORT_REASONS: { id: string; label: string }[] = [
  { id: 'false_info', label: 'False or misleading information' },
  { id: 'scam', label: 'Scam or asking for money' },
  { id: 'harassment', label: 'Harassment or threats' },
  { id: 'privacy', label: 'Shares someone\'s private details' },
  { id: 'not_missing', label: 'This person is not missing' },
  { id: 'spam', label: 'Spam or advertising' },
  { id: 'underage', label: 'Posted about a child without guardian consent' },
  { id: 'other', label: 'Something else' }
];

export interface MediaItem {
  id: string;
  kind: 'image' | 'video';
  /** data-uri, https url or bundle asset path */
  src: string;
  poster?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  body: string;
  createdAt: number;
  upvotes: number;
  isLead: boolean;
  /** sighting details attached to a comment on a case post */
  sighting?: Sighting;
  /** Named by the viewer. Shown only to the family, never on the public poster. */
  markGuess?: string;
  /** Family check. Public sees the result, not the words. */
  markCheck?: 'match' | 'no';
}

export interface Sighting {
  place: string;
  province: ProvinceCode;
  when: number;
  note?: string;
  geo?: GeoPoint;
}

export interface EscalationRecord {
  partnerId: string;
  partnerName: string;
  status: 'consent_requested' | 'noted' | 'sent' | 'acknowledged' | 'declined' | 'failed';
  requestedAt: number;
  sentAt: number | null;
  reference: string | null;
}

export interface ConsentRecord {
  kind: 'escalation' | 'location' | 'media' | 'data';
  label: string;
  granted: boolean;
  at: number;
  expiresAt: number | null;
  detail?: string;
}

export interface VerificationEvent {
  at: number;
  kind:
    | 'claimed'
    | 'is_wanted_yes'
    | 'is_wanted_no'
    | 'going_home'
    | 'not_going_home'
    | 'found'
    | 'whereabouts_found'
    | 'false_claim_removed';
  byUserId: string | null;
  note?: string;
}

export interface VehicleDetails {
  makeModel: string;
  registration: string;
  colour: string;
  bodyType: string;
}

export interface Post {
  id: string;
  type: PostType;
  status: PostStatus;
  /** Set only when type is 'danger'. Null on every other case. */
  danger: DangerAlert | null;
  authorId: string;
  anonymous: boolean;
  /** "Am I being wanted?" banner toggle for khumbulekhaya posts */
  askWanted: boolean;

  /* ---- content ---- */
  title: string;
  body: string;
  media: MediaItem[];
  province: ProvinceCode;
  town: string;
  lastSeenAt: number | null;
  lastSeenWhere: string;
  geo: GeoPoint | null;
  contactLabel: string;
  contactValue: string;
  contactVisibleTo: 'everyone' | 'verified' | 'owner';
  caseNumber: string | null;
  reward: string | null;
  createdAt: number;
  updatedAt: number;

  /* ---- the subject (missing person / person who left home) ---- */
  subject: {
    name: string;
    age: number | null;
    gender: 'female' | 'male' | 'other' | 'unknown';
    height: string;
    build: string;
    skinTone: string;
    hair: string;
    eyes: string;
    clothing: string;
    distinguishing: string;
    medical: string;
    vehicle: string;
    languages: string;
    surname: string;
    relationship: string;
  } | null;
  /** Vehicle-specific fields. Older records may still use subject.vehicle. */
  vehicleDetails?: VehicleDetails | null;

  /* ---- reach ---- */
  audience: Audience;
  spotlightId: string | null;
  chatEnabled: boolean;
  allowComments: boolean;
  allowShare: boolean;

  /* ---- engagement ---- */
  upvotes: number;
  downvotes: number;
  commentCount: number;
  shares: number;
  views: number;
  savedBy: number;
  voterIds: Record<string, VoteValue>;

  /* ---- escalation + consent ---- */
  escalation: {
    requested: boolean;
    consentGranted: boolean;
    consentAt: number | null;
    partners: EscalationRecord[];
  };

  consent: ConsentRecord[];

  /* ---- sighting verification ---- */
  /**
   * A sighting an admin has checked against something official - CCTV footage,
   * a police statement, a store's records. Nobody else can set this. It is the
   * difference between a rumour and a lead the family can act on.
   */
  sightingVerified: {
    by: string | null;
    at: number | null;
    source: '' | 'cctv' | 'police' | 'records' | 'photo';
    note: string;
  } | null;

  /* ---- search party ---- */
  /**
   * An organised ground search on a case: named areas, who took which one, and
   * what came of it. This is what a family actually needs in the first 48 hours
   * and no South African search app offers it.
   */
  searchParty: {
    open: boolean;
    meetAt: string;
    meetWhen: number | null;
    zones: SearchZone[];
  } | null;

  /**
   * People who tapped "I'm looking" on this case. The family sees the count.
   * Optional so older saved posts still load.
   */
  lookingIds?: string[];

  /* ---- background check / app-registered subject ---- */
  locationCheck: {
    subjectRegisteredInApp: boolean;
    requestedBy: string | null;
    requestedAt: number | null;
    consentFromSubject: 'none' | 'requested' | 'granted' | 'declined';
    consentAt: number | null;
    /** only ever populated once the subject has granted consent */
    points: GeoPoint[];
    deviceReachable: boolean;
    lastKnownAt: number | null;
    note: string;
  };

  /* ---- KhumbulEkhaya flow ---- */
  khumbu: {
    daysOut: number | null;
    leftHomeAt: number | null;
    reasonGuess: string;
    claimedByUserId: string | null;
    claimedAt: number | null;
    /** the subject's own answer */
    subjectResponse: 'none' | 'going_home' | 'not_going_home' | 'contact_me';
    subjectNote: string;
    wantedAnswers: { yes: number; no: number; myVote: boolean | null };
  } | null;

  /* ---- outcome ---- */
  outcome: {
    found: boolean;
    foundAt: number | null;
    whereaboutsFound: string;
    closedBy: string | null;
    note: string;
    /** LulaFind member named as the person who found them. Set once. */
    finderUserId?: string | null;
    finderName?: string;
  };

  events: VerificationEvent[];
  flags: { reason: string; byUserId: string; at: number; resolved: boolean }[];
  /** nudges already shown to the poster ("did you get help?") */
  outcomeNudgeAt: number | null;
}

export interface Spotlight {
  id: string;
  surname: string;
  tagline: string;
  coverHue: number;
  ownerId: string;
  adminIds: string[];
  memberIds: string[];
  postIds: string[];
  followers: number;
  province: ProvinceCode | null;
  verified: boolean;
  createdAt: number;
  about: string;
}

export interface StoryReply {
  id: string;
  storyId: string;
  authorId: string;
  body: string;
  at: number;
}

export interface StoryView {
  id: string;
  storyId: string;
  viewerId: string;
  at: number;
}

export interface Story {
  id: string;
  authorId: string;
  createdAt: number;
  expiresAt: number;
  media: MediaItem[];
  text: string;
  bgHue: number;
  /** Projection only: visible to the author, or just the current viewer's own view. */
  viewers: string[];
  /** Projection only: reply bodies are visible to the story author alone. */
  replies: StoryReply[];
  /** who may see this story */
  audience: Audience;
  /** required when audience is 'surname' */
  spotlightId: string | null;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  fromUserId: string;
  body: string;
  at: number;
  read: boolean;
  kind: 'text' | 'system' | 'lead';
  /** a photo or video sent with the message - a sighting pic, a poster, a map */
  media?: MediaItem | null;
  /** set when the thread was opened because of a lead on a specific case */
  postId?: string;
}

export interface ChatThread {
  id: string;
  participantIds: string[];
  postId: string | null;
  createdAt: number;
  lastMessageAt: number;
  unread: Record<string, number>;
  /** provenance: how this private chat was unlocked */
  unlockedVia: 'vote' | 'follow' | 'friend';
}

/**
 * A follow. `status` is 'accepted' unless the person being followed has asked
 * to approve requests first, in which case it starts 'pending' and counts for
 * nothing until they accept it.
 */
export interface FollowEdge {
  id: string;
  followerId: string;
  followingId: string;
  at: number;
  status: 'pending' | 'accepted';
}

export interface Notification {
  id: string;
  userId: string;
  kind:
    | 'vote' | 'comment' | 'follow' | 'chat' | 'system'
    | 'escalation' | 'location_consent' | 'claim' | 'outcome' | 'spotlight'
    | 'checkin' | 'moderation' | 'danger' | 'story_reply';
  title: string;
  body: string;
  at: number;
  read: boolean;
  route: string | null;
  postId: string | null;
}

export interface Tip {
  id: string;
  category: 'reporting' | 'safety' | 'digital' | 'legal' | 'support';
  title: string;
  body: string;
  cta?: { label: string; route: string } | null;
  urgent?: boolean;
}

export interface FeedFilter {
  type: PostType | 'all';
  province: ProvinceCode | 'all';
  query: string;
  sort: 'recent' | 'hot' | 'nearby' | 'oldest';
  status: 'active' | 'all' | 'found';
  spotlightId: string | null;
}

export const emptyFilter = (): FeedFilter => ({
  type: 'all',
  province: 'all',
  query: '',
  sort: 'recent',
  status: 'active',
  spotlightId: null
});

/** Post types exposed as feed chips. */
export const FEED_TABS: { key: FeedFilter['type']; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'danger', label: 'Danger', icon: 'alert' },
  { key: 'missing', label: 'Missing people', icon: 'search' },
  { key: 'khumbulekhaya', label: 'Left home', icon: 'home' },
  { key: 'sighting', label: 'Sightings', icon: 'pin' },
  { key: 'vehicle', label: 'Vehicles', icon: 'car' },
  { key: 'pet', label: 'Lost pets', icon: 'paw' },
  { key: 'story', label: 'Stories', icon: 'book' }
];

export const POST_TYPE_META: Record<PostType, { label: string; tone: string; icon: string; verb: string }> = {
  missing: { label: 'Missing person', tone: 'danger', icon: 'search', verb: 'Report missing' },
  khumbulekhaya: { label: 'KhumbulEkhaya', tone: 'warm', icon: 'home', verb: 'Remember home' },
  sighting: { label: 'Sighting', tone: 'info', icon: 'pin', verb: 'Report sighting' },
  vehicle: { label: 'Hijacked or stolen vehicle', tone: 'warn', icon: 'car', verb: 'Report a vehicle' },
  pet: { label: 'Lost pet', tone: 'neutral', icon: 'paw', verb: 'Report a lost pet' },
  story: { label: 'Story / status', tone: 'neutral', icon: 'book', verb: 'Share story' },
  danger: { label: 'Danger nearby', tone: 'danger', icon: 'alert', verb: 'Warn people' }
};
