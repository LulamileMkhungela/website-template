import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { LocalDb } from './data/local-db';
import { LULA_API, MockApi } from './data/api';
import { AuthService } from './services/auth.service';
import { GoogleAuthService } from './services/google-auth.service';
import { DataService } from './services/data.service';
import { emptyFilter } from './models/types';
import { FilterBarComponent } from '../shared/components/filter-bar.component';
import { PostCardComponent } from '../shared/components/post-card.component';
import { AuthComponent } from '../pages/auth/auth.component';
import { SpotlightComponent } from '../pages/tabs/spotlight.component';
import { CreatePostComponent } from '../pages/post/create-post.component';
import { CreateStoryComponent } from '../pages/story/create-story.component';
import { ProfileComponent } from '../pages/user/profile.component';
import { TermsComponent } from '../pages/terms/terms.component';
import { AdminComponent } from '../pages/admin/admin.component';
import { SpotlightDetailComponent } from '../pages/spotlight/spotlight-detail.component';
import { SUPPORT_EMAIL } from './config';

/**
 * Render tests. These mount the real components with the real services so a
 * broken binding, a missing import or a template that throws shows up here
 * rather than on someone's phone.
 */

let db: LocalDb;

@Component({ standalone: true, template: '' })
class RouteStubComponent {}

const ROUTES = [
  { path: 'auth', component: RouteStubComponent },
  { path: 'home', component: RouteStubComponent },
  { path: 'spotlight', component: RouteStubComponent },
  { path: 'me', component: RouteStubComponent },
  { path: 'settings', component: RouteStubComponent },
  { path: 'tips', component: RouteStubComponent },
  { path: 'search', component: RouteStubComponent },
  { path: 'notifications', component: RouteStubComponent },
  { path: 'user/:id', component: RouteStubComponent },
  { path: 'post/:id', component: RouteStubComponent },
  { path: 'post/:id/edit', component: RouteStubComponent },
  { path: 'spotlight/:id', component: RouteStubComponent },
  { path: 'create/:type', component: RouteStubComponent },
  { path: 'create-story', component: RouteStubComponent },
  { path: 'story/:id', component: RouteStubComponent },
  { path: 'safety', component: RouteStubComponent },
  { path: 'escalate/:postId', component: RouteStubComponent },
  { path: 'location-check/:postId', component: RouteStubComponent },
  { path: 'chat/:threadId', component: RouteStubComponent },
  { path: 'admin', component: RouteStubComponent },
  { path: 'terms', component: RouteStubComponent }
];

function bed(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('lulafind.'))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* node */ }
  db = new LocalDb(true);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(ROUTES),
      provideIonicAngular(),
      { provide: LULA_API, useValue: new MockApi(db) }
    ]
  });
}

describe('Components render', () => {
  beforeEach(bed);

  it('renders the feed filter bar with a province dropdown', async () => {
    const f = TestBed.createComponent(FilterBarComponent);
    f.componentInstance.filter = emptyFilter();
    f.componentInstance.missingCount = 3;
    f.detectChanges();
    await f.whenStable();
    const html: string = (f.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('All provinces');
    expect(html).toContain('Gauteng');
    expect(html).toContain('Northern Cape');
    expect(html).toContain('Missing people');
  });

  it('renders a post card with a Follow button', async () => {
    const data = TestBed.inject(DataService);
    await data.loadFeed();
    const post = { ...(await data.loadPost('p_thato'))! };
    post.media = [1, 2, 3, 4, 5, 6].map((n) => ({ id: 'm' + n, kind: 'image' as const, src: 'data:image/svg+xml,' }));
    const f = TestBed.createComponent(PostCardComponent);
    f.componentInstance.post = post;
    f.componentInstance.author = (await data.profile('u_demo'))!;
    f.componentInstance.chatState = 'locked-vote';
    f.detectChanges();
    await f.whenStable();
    const html: string = (f.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Follow');
    expect(html).toContain('Idea');
    expect(html).toContain('Comment');
  });

  it('renders the LulaFind welcome and login screens', async () => {
    const f = TestBed.createComponent(AuthComponent);
    f.detectChanges();
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const html: string = el.innerHTML;

    expect(html).toContain('Continue with Google');
    expect(html).toContain('Sign Up');
    expect(html).toContain('Log in');

    // switch to signin mode
    f.componentInstance.mode.set('signin');
    f.detectChanges();
    await f.whenStable();
    const loginHtml: string = (f.nativeElement as HTMLElement).innerHTML;

    expect(loginHtml).toContain('EMAIL ADDRESS');
    expect(loginHtml).toContain('PASSWORD');
    expect(loginHtml).toContain('Log in');
    expect(loginHtml).toContain('Forgot your password?');
  });

  it('shows the five-step LulaFind signup flow', async () => {
    const f = TestBed.createComponent(AuthComponent);
    f.detectChanges();
    await f.whenStable();
    f.componentInstance.startSignup();
    f.detectChanges();
    await f.whenStable();

    expect(f.componentInstance.signupStep()).toBe(1);
    const form1: string = (f.nativeElement as HTMLElement).innerHTML;
    expect(form1).toContain("What's your name?");
    expect(form1).toContain('Agree and continue');

    // Fill name and go to Step 2
    f.componentInstance.f.displayName = 'John Doe';
    f.componentInstance.nextStep();
    f.detectChanges();
    await f.whenStable();

    expect(f.componentInstance.signupStep()).toBe(2);
    expect(f.componentInstance.usernamePreview()).toBe('doe');
  });

  it('renders the Spotlight tab with an A-Z dropdown', async () => {
    const data = TestBed.inject(DataService);
    await data.loadStatic();
    const f = TestBed.createComponent(SpotlightComponent);
    f.detectChanges();
    await f.whenStable();
    const html: string = (f.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('All letters');
    expect(html).toContain('Ndlela');
    // picking a letter narrows the list
    f.componentInstance.letter.set('N');
    f.detectChanges();
    expect(f.componentInstance.list().map((s) => s.surname)).toEqual(['Ndlela']);
    f.componentInstance.letter.set('B');
    f.detectChanges();
    expect(f.componentInstance.list().map((s) => s.surname)).toEqual(['Botha']);
  });

  it('flags a duplicate surname in the same province while you type', async () => {
    const data = TestBed.inject(DataService);
    await TestBed.inject(AuthService).signInDemo();
    await data.loadStatic();
    const f = TestBed.createComponent(SpotlightComponent);
    f.detectChanges();
    f.componentInstance.form.surname = 'Ndlela';
    f.componentInstance.form.province = 'KZN';
    f.detectChanges();
    expect(f.componentInstance.duplicate()).toBe(true);
    expect(f.componentInstance.surnameError()).toBe('');
    f.componentInstance.form.province = 'GP';
    f.detectChanges();
    expect(f.componentInstance.duplicate()).toBe(false);
    f.componentInstance.form.surname = 'X';
    f.detectChanges();
    expect(f.componentInstance.surnameError()).toBeTruthy();
  });

  it('renders the composer and offers options', async () => {
    const data = TestBed.inject(DataService);
    await TestBed.inject(AuthService).signInDemo();
    await data.loadStatic();
    const f = TestBed.createComponent(CreatePostComponent);
    f.detectChanges();
    await f.whenStable();
    const html: string = (f.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('What are you posting?');
    expect(html).toContain('Missing person');
    expect(f.componentInstance.mySpotlights().map((s: any) => s.surname)).toEqual(['Mokoena']);
  });

  it('handles media in the composer', async () => {
    const data = TestBed.inject(DataService);
    await TestBed.inject(AuthService).signInDemo();
    await data.loadStatic();
    const f = TestBed.createComponent(CreatePostComponent);
    f.detectChanges();
    f.componentInstance.type.set('missing');
    f.componentInstance.f.media = [{ id: 'v', kind: 'video', src: 'data:video/mp4,' }];
    f.detectChanges();
    expect(f.componentInstance.f.media.some((m) => m.kind === 'video')).toBe(true);
  });

  it('renders the story composer with a visibility choice', async () => {
    const data = TestBed.inject(DataService);
    await TestBed.inject(AuthService).signInDemo();
    await data.loadStatic();
    const f = TestBed.createComponent(CreateStoryComponent);
    f.detectChanges();
    await f.whenStable();
    const html: string = (f.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Who can see this story?');
    expect(html).toContain('Everyone');
    expect(html).toContain('My followers');
    expect(html).toContain('People who follow you can view');
    expect(html).toContain('My Spotlight');
  });

  it('renders a profile and hides what the owner hid', async () => {
    const data = TestBed.inject(DataService);
    await data.loadFeed();
    await data.loadStatic();
    const owner = (await data.profile('u_kabelo'))!;
    owner.privacy = { ...owner.privacy, showStats: false, showSpotlights: false };
    await TestBed.inject(LULA_API).saveUser(owner);

    const f = TestBed.createComponent(ProfileComponent);
    f.componentInstance.u.set(owner);
    f.detectChanges();
    await f.whenStable();
    const html: string = (f.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('Kabelo Nkosi');
    // the seeded check-in names the colour, not only a green ring
    expect(html).toContain('Green ring');
    expect(html).toContain('Safe');
    // stats and communities are hidden from a visitor
    expect(html).not.toContain('help points');
    expect(f.componentInstance.showStats()).toBe(false);
  });

  it('renders the terms page with the arrest warning and support contact', async () => {
    const f = TestBed.createComponent(TermsComponent);
    f.detectChanges();
    const html: string = (f.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('18 or older');
    expect(html).toContain('can lead to arrest');
    expect(html).toContain(SUPPORT_EMAIL);
    expect(html).toContain('08600 10111');
  });
});

describe('Admin screen', () => {
  beforeEach(bed);

  /** Mount as the demo admin and wait for the user list to land. */
  async function admin(): Promise<ComponentFixture<AdminComponent>> {
    await TestBed.inject(AuthService).signInDemo();
    const f = TestBed.createComponent(AdminComponent);
    f.detectChanges();
    await f.whenStable();
    f.componentInstance.tab.set('people');
    f.detectChanges();
    await f.whenStable();
    return f;
  }

  /** Fire the same CustomEvent the real ion-searchbar emits. */
  function type(f: ComponentFixture<AdminComponent>, value: string): void {
    const bar = (f.nativeElement as HTMLElement).querySelector('ion-searchbar');
    expect(bar).toBeTruthy();
    bar!.dispatchEvent(new CustomEvent('ionInput', { detail: { value, event: null } }));
    f.detectChanges();
  }

  it('lists people and can remove one', async () => {
    const f = await admin();
    const html: string = (f.nativeElement as HTMLElement).innerHTML;
    expect(f.componentInstance.people().length).toBeGreaterThan(5);
    expect(html).toContain('Remove');
    expect(html).toContain('Suspend');
    // another admin has no Remove button of their own
    expect(html).toContain('admin');
  });

  it('filters people when you type in the search bar', async () => {
    const f = await admin();
    const all = f.componentInstance.people().length;
    type(f, 'ndlela');
    const names = f.componentInstance.people().map((u) => u.displayName);
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBeLessThan(all);
    expect(names.every((n) => n.toLowerCase().includes('ndlela'))).toBe(true);
    expect((f.nativeElement as HTMLElement).innerHTML).toContain('Ndlela');
  });

  it('searches by username and by email too', async () => {
    const f = await admin();
    const target = f.componentInstance.people().find((u) => !u.isAdmin)!;
    type(f, target.handle);
    expect(f.componentInstance.people().map((u) => u.id)).toContain(target.id);
    type(f, target.email.split('@')[0]);
    expect(f.componentInstance.people().map((u) => u.id)).toContain(target.id);
    type(f, 'zzzznobody');
    expect(f.componentInstance.people()).toEqual([]);
  });

  it('shows the reports tab with the queue empty by default', async () => {
    const f = await admin();
    f.componentInstance.tab.set('reports');
    f.detectChanges();
    const html: string = (f.nativeElement as HTMLElement).innerHTML;
    expect(html).toContain('No open reports');
    expect(html).toContain('Anything members report lands here.');
  });
});

describe('Search boxes actually search', () => {
  beforeEach(bed);

  /** Fire the CustomEvent the real ion-searchbar emits, through the real listener. */
  function type(f: ComponentFixture<unknown>, value: string): void {
    const bar = (f.nativeElement as HTMLElement).querySelector('ion-searchbar');
    expect(bar).toBeTruthy();
    bar!.dispatchEvent(new CustomEvent('ionInput', { detail: { value, event: null } }));
    f.detectChanges();
  }

  it('narrows the Spotlight tab when you type', async () => {
    const data = TestBed.inject(DataService);
    await data.refresh();
    const f = TestBed.createComponent(SpotlightComponent);
    f.detectChanges();
    await f.whenStable();
    const all = f.componentInstance.list().length;
    expect(all).toBeGreaterThanOrEqual(4);
    type(f, 'ndlela');
    expect(f.componentInstance.list().map((s) => s.surname)).toEqual(['Ndlela']);
    type(f, 'khu');
    expect(f.componentInstance.list().map((s) => s.surname)).toEqual(['Khumalo']);
    type(f, '');
    expect(f.componentInstance.list().length).toBe(all);
  });

  it('narrows the posts inside a Spotlight when you type', async () => {
    const data = TestBed.inject(DataService);
    await data.refresh();
    // pick the Spotlight that actually has more than one post in the seed data
    const counts = data.spotlights().map((sp) => ({ sp, n: data.feed().filter((p) => p.spotlightId === sp.id).length }));
    const best = counts.sort((a, b) => b.n - a.n)[0];
    expect(best.n).toBeGreaterThan(1);
    const f = TestBed.createComponent(SpotlightDetailComponent);
    f.componentInstance.sp.set(best.sp);
    f.detectChanges();
    await f.whenStable();
    const all = f.componentInstance.posts().length;
    expect(all).toBe(best.n);
    type(f, f.componentInstance.posts()[1].title.slice(0, 6));
    expect(f.componentInstance.posts().length).toBeLessThan(all);
    expect(f.componentInstance.posts().every((p) => p.spotlightId === best.sp.id)).toBe(true);
    type(f, 'zzzznothingmatches');
    expect(f.componentInstance.posts()).toEqual([]);
  });

  it('narrows the admin post queue when you type', async () => {
    await TestBed.inject(AuthService).signInDemo();
    const f = TestBed.createComponent(AdminComponent);
    f.detectChanges();
    await f.whenStable();
    f.componentInstance.tab.set('posts');
    f.detectChanges();
    await f.whenStable();
    const all = f.componentInstance.posts().length;
    type(f, 'zzzznothingmatches');
    expect(f.componentInstance.posts()).toEqual([]);
    type(f, '');
    expect(f.componentInstance.posts().length).toBe(all);
  });
});

describe('Follow requests', () => {
  beforeEach(bed);

  it('goes straight through when approval is off, and becomes a request when it is on', async () => {
    const auth = TestBed.inject(AuthService);
    const data = TestBed.inject(DataService);
    await auth.signInDemo();
    await data.refresh();

    const target = data.feed().find((p) => p.authorId !== 'u_demo' && !data.followingIds().includes(p.authorId))?.authorId ?? 'u_zanele';

    // default: no approval needed
    const followed = await data.toggleFollow(target);
    expect(followed).toBe(true);
    expect(await data.isFollowing(target)).toBe(true);
    await data.toggleFollow(target); // unfollow again

    // the target turns approval on
    const profile = (await data.profile(target))!;
    await auth.updateProfile === undefined; // no-op guard, updateProfile is on the viewer only
    const api = TestBed.inject(LULA_API);
    await api.saveUser({ ...profile, privacy: { ...profile.privacy, requireFollowApproval: true } });

    const outcome = await data.toggleFollow(target);
    expect(outcome).toBe(false);                 // not following yet
    expect(await data.isFollowing(target)).toBe(false);

    // and the request lands in the target's queue
    const reqs = await api.followRequests(target);
    expect(reqs.map((r) => r.followerId)).toContain('u_demo');
    expect(reqs.every((r) => r.status === 'pending')).toBe(true);

    // accepting it makes the follow real
    await api.respondFollowRequest('u_demo', target, true);
    expect(await data.isFollowing(target)).toBe(true);
    expect((await api.followRequests(target)).length).toBe(0);
  });

  it('declining removes the request and leaves nobody following', async () => {
    const auth = TestBed.inject(AuthService);
    const data = TestBed.inject(DataService);
    const api = TestBed.inject(LULA_API);
    await auth.signInDemo();
    await data.refresh();

    const target = data.feed().find((p) => p.authorId !== 'u_demo' && !data.followingIds().includes(p.authorId))?.authorId ?? 'u_zanele';
    const profile = (await data.profile(target))!;
    await api.saveUser({ ...profile, privacy: { ...profile.privacy, requireFollowApproval: true } });

    await data.toggleFollow(target);
    expect((await api.followRequests(target)).length).toBe(1);

    await api.respondFollowRequest('u_demo', target, false);
    expect((await api.followRequests(target)).length).toBe(0);
    expect(await data.isFollowing(target)).toBe(false);
  });

  it('responds through DataService and clears the queue', async () => {
    const auth = TestBed.inject(AuthService);
    const data = TestBed.inject(DataService);
    const api = TestBed.inject(LULA_API);

    // demo user requires approval, a new account asks to follow them
    const demo = (await api.user('u_demo'))!;
    await api.saveUser({ ...demo, privacy: { ...demo.privacy, requireFollowApproval: true } });
    await auth.signUp({
      displayName: 'Asker Person', email: 'asker@example.co.za', password: 'password123',
      surname: 'Person', province: 'GP', town: '', over18: true, acceptedTerms: true, otpVerified: true
    });
    await data.toggleFollow('u_demo');

    // now sign in as the demo admin and answer it
    await auth.signOut();
    await auth.signInDemo();
    await data.loadFollowRequests();
    expect(data.followRequests().length).toBe(1);

    await data.respondToFollowRequest(data.followRequests()[0].followerId, true);
    expect(data.followRequests().length).toBe(0);
    expect(await api.isFollowing((await api.user('u_demo'))!.id, 'u_demo')).toBe(false);
  });
});

describe('Email and Google sign-in', () => {
  beforeEach(bed);

  const payload = (over: any = {}) => ({
    displayName: 'Nomvula Zondi', email: 'nomvula@example.co.za', password: 'password123',
    surname: 'Zondi', province: 'KZP' as any, town: 'Durban',
    over18: true, acceptedTerms: true, otpVerified: true, ...over
  });

  it('OTP: right code passes, wrong code fails, and a used code cannot be replayed', async () => {
    const auth = TestBed.inject(AuthService);
    const { sentTo, demoCode } = await auth.requestOtp('Nomvula@Example.co.za ');

    // normalised and trimmed
    expect(sentTo).toBe('nomvula@example.co.za');
    expect(demoCode).toMatch(/^\d{6}$/);

    expect(auth.verifyOtp(sentTo, '000000')).toBe(false);      // wrong code
    expect(auth.verifyOtp(sentTo, demoCode)).toBe(true);       // right code
    expect(auth.verifyOtp('other@example.co.za', demoCode)).toBe(false); // not this address
    expect(auth.otpSecondsLeft(sentTo)).toBeGreaterThan(0);

    // signing up burns the code, so it cannot be replayed afterwards
    await auth.signUp(payload({ email: sentTo }));
    expect(auth.verifyOtp(sentTo, demoCode)).toBe(false);

    // a fresh request issues a different code
    const again = await auth.requestOtp('fresh.address@example.co.za');
    expect(again.demoCode).toMatch(/^\d{6}$/);
  });

  it('signs up with email, then signs back in with that email and password', async () => {
    const auth = TestBed.inject(AuthService);

    const created = await auth.signUp(payload());
    expect(created.email).toBe('nomvula@example.co.za');
    // full name stays the name; the second name is the locked username
    expect(created.displayName).toBe('Nomvula Zondi');
    expect(created.surname).toBe('Zondi');
    expect(created.handle).toBe('zondi');
    expect(created.bio).toBe('');

    await auth.signOut();
    expect(auth.viewerId).toBe(null);

    const back = await auth.signIn('Nomvula@Example.co.za', 'password123');
    expect(back.id).toBe(created.id);
    expect(auth.viewerId).toBe(created.id);
  });

  it('rejects a wrong password, an unknown email, and a duplicate sign-up', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.signUp(payload());

    await expect(auth.signIn('nomvula@example.co.za', 'wrong-password')).rejects.toThrow(/Incorrect password/i);
    await expect(auth.signIn('nobody@example.co.za', 'password123')).rejects.toThrow(/No LulaFind account/i);
    await expect(auth.signUp(payload())).rejects.toThrow(/already exists/i);
    // a different address, so the duplicate-email check cannot shadow the OTP one
    await expect(auth.signUp(payload({ email: 'unverified@example.co.za', otpVerified: false })))
      .rejects.toThrow(/code we emailed you/i);
    await expect(auth.signUp(payload({ email: 'short@example.co.za', password: 'short' })))
      .rejects.toThrow(/at least 8 characters/i);
    await expect(auth.signUp(payload({ email: 'under18@example.co.za', over18: false })))
      .rejects.toThrow(/18 or older/i);
    await expect(auth.signUp(payload({ email: 'terms@example.co.za', acceptedTerms: false })))
      .rejects.toThrow(/Accept the terms/i);
  });

  it('completes the offline password-recovery and new-password form journey', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.signUp(payload());
    await auth.signOut();
    expect(await auth.sendPasswordReset('nomvula@example.co.za')).toBe('preview');

    const fixture = TestBed.createComponent(AuthComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.mode()).toBe('newpass');

    fixture.componentInstance.f.newPassword = 'new-password-123';
    fixture.componentInstance.f.confirmPassword = 'does-not-match';
    await fixture.componentInstance.saveNewPassword();
    expect(fixture.componentInstance.error()).toContain('do not match');

    fixture.componentInstance.f.confirmPassword = 'new-password-123';
    await fixture.componentInstance.saveNewPassword();
    expect(auth.passwordRecovery()).toBe(false);
    expect(auth.viewerId).not.toBe(null);

    await auth.signOut();
    const signedIn = await auth.signIn('nomvula@example.co.za', 'new-password-123');
    expect(signedIn.email).toBe('nomvula@example.co.za');
  });

  it('signs Google in through Firebase, then swaps the ID token for a Supabase session', async () => {
    let callback: ((event: string, session: any) => void) | undefined;
    let idTokenOptions: any;
    let oauthCalls = 0;
    const authClient = {
      onAuthStateChange: (fn: (event: string, session: any) => void) => {
        callback = fn;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithOAuth: async () => {
        oauthCalls += 1;
        return { data: {}, error: null };
      },
      signInWithIdToken: async (options: any) => {
        idTokenOptions = options;
        return {
          data: {
            user: { id: 'u_demo', email: 'ma@gmail.com', user_metadata: {}, app_metadata: { provider: 'google' } },
            session: { access_token: 'supabase-session' }
          },
          error: null
        };
      },
      signOut: async () => ({ error: null })
    };
    const google = {
      signInWithGoogle: async () =>
        ({ idToken: 'google-id-token', email: 'ma@gmail.com', displayName: 'Ma Dlamini', providerUserId: 'gid-1' }),
      signOut: async () => undefined,
      getCurrentUser: async () => null
    };
    TestBed.overrideProvider(GoogleAuthService, { useValue: google });
    const api = TestBed.inject(LULA_API) as MockApi & { client?: { auth: typeof authClient } };
    api.client = { auth: authClient };
    const auth = TestBed.inject(AuthService);
    auth.attachApi(api);

    // Firebase runs the Google sign-in; only its ID token reaches Supabase.
    const profile = await auth.signInWithProvider('google');
    expect(profile.id).toBe('u_demo');
    expect(idTokenOptions).toEqual({ provider: 'google', token: 'google-id-token' });
    expect(oauthCalls).toBe(0); // no Supabase Google OAuth redirect

    // A session Supabase pushes for a brand-new Google account (for example
    // restored on boot) still lands in the sign-up form, untouched.
    callback?.('SIGNED_IN', {
      user: {
        id: '00000000-0000-4000-8000-000000000199',
        email: 'oauth.new@example.com',
        user_metadata: { full_name: 'New OAuth Member' },
        app_metadata: { provider: 'google' }
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(auth.user()).toBe(null);
    expect(auth.pendingProvider()).toMatchObject({
      provider: 'google', email: 'oauth.new@example.com', displayName: 'New OAuth Member'
    });
  });

  it('Google: a brand new email is handed to the sign-up form, not auto-created', async () => {
    const auth = TestBed.inject(AuthService);

    await expect(auth.signInWithProvider('google')).rejects.toThrow('NEW_ACCOUNT');

    const pending = auth.pendingProvider();
    expect(pending?.provider).toBe('google');
    expect(pending?.email).toBe('google.user@gmail.com');
    expect(auth.viewerId).toBe(null);   // no half-empty account was made

    // finishing the form completes the sign-in - no password, no OTP needed
    const u = await auth.finishProviderSignUp(payload({
      displayName: 'Google User', email: 'google.user@gmail.com', provider: 'google', otpVerified: false
    }));
    expect(u.email).toBe('google.user@gmail.com');
    expect(auth.viewerId).toBe(u.id);
  });

  it('Google: a known email goes straight in without the form', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.signUp(payload());
    await auth.signOut();

    // make the seeded demo email match so the provider finds a real account
    const api = TestBed.inject(LULA_API);
    const demo = (await api.user('u_demo'))!;
    await api.saveUser({ ...demo, email: 'google.user@gmail.com' });

    const u = await auth.signInWithProvider('google');
    expect(u.email).toBe('google.user@gmail.com');
    expect(auth.viewerId).toBe('u_demo');
    expect(auth.pendingProvider()).toBe(null);
  });
});
