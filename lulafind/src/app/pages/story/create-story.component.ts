import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IconComponent } from '../../shared/components/icon.component';
import { DataService } from '../../core/services/data.service';
import { MediaService } from '../../core/services/media.service';
import { Audience, MediaItem } from '../../core/models/types';
import { storyBg } from '../../core/data/seed';

const AUDIENCES: { key: Audience; icon: string; label: string }[] = [
  { key: 'public', icon: 'globe', label: 'Everyone' },
  { key: 'surname', icon: 'award', label: 'My Spotlight' },
  { key: 'followers', icon: 'users', label: 'My followers' }
];

/** A 24-hour story with explicit audience controls and up to three photos. */
@Component({
  selector: 'lf-create-story',
  standalone: true,
  imports: [IonContent, IconComponent],
  template: `
    <ion-content class="lf-page story-create">
      <header class="topbar">
        <button class="close" type="button" (click)="cancel()" aria-label="Close story composer"><lf-icon name="x" [size]="21" /></button>
        <strong>Create story</strong>
        <button class="publish-top" type="button" (click)="publish()" [disabled]="busy() || !canPublish()">{{ busy() ? 'Posting…' : 'Share' }}</button>
      </header>

      <div class="layout">
        <section class="preview-column">
          <div class="preview" [style.background]="bg()">
            @if (currentMedia()) { <img [src]="currentMedia()!.src" class="shot" alt="Story photo preview" /> }
            <div class="preview-scrim"></div>
            <textarea class="txt" rows="4" maxlength="600" placeholder="Say something to your community…"
                      [value]="text" (input)="text = $any($event.target).value"></textarea>
            <p class="expires"><lf-icon name="clock" [size]="13" /> Disappears after 24 hours</p>
            @if (!media().length) { <span class="empty-hint">Add up to three photos, a note, or both.</span> }
          </div>

          @if (media().length) {
            <div class="photo-strip" aria-label="Story photos">
              @for (item of media(); track item.id; let i = $index) {
                <div class="photo-thumb" [class.active]="previewIndex() === i">
                  <button type="button" (click)="previewIndex.set(i)" [attr.aria-label]="'Preview photo ' + (i + 1)"><img [src]="item.src" alt="" /></button>
                  <button class="remove" type="button" (click)="removePhoto(item.id)" [attr.aria-label]="'Remove photo ' + (i + 1)"><lf-icon name="x" [size]="12" /></button>
                </div>
              }
              @if (media().length < 3) {
                <button type="button" class="add-more" (click)="addPhoto()" [disabled]="busy()" aria-label="Add another photo"><lf-icon name="plus" [size]="19" /></button>
              }
            </div>
          }
        </section>

        <section class="settings">
          <div class="section-title"><strong>Who can see this story?</strong><span>Only your chosen audience can see it</span></div>
          <div class="audience-list" role="group" aria-label="Who can see this story">
            @for (option of audiences; track option.key) {
              <button class="audience" type="button" [class.selected]="audience() === option.key" (click)="pick(option.key)">
                <span class="aud-icon"><lf-icon [name]="option.icon" [size]="17" /></span>
                <span class="aud-copy"><strong>{{ option.label }}</strong><small>{{ audienceHelp(option.key) }}</small></span>
                <span class="radio" [class.checked]="audience() === option.key"><i></i></span>
              </button>
            }
          </div>

          @if (audience() === 'surname') {
            @if (mySpotlights().length) {
              <label class="spotlight-picker"><span>Choose a Spotlight</span>
                <select [value]="spotlightId() ?? ''" (change)="spotlightId.set($any($event.target).value || null)">
                  <option value="">Choose community</option>
                  @for (spotlight of mySpotlights(); track spotlight.id) { <option [value]="spotlight.id">{{ spotlight.surname }}</option> }
                </select>
              </label>
            } @else {
              <div class="privacy-note"><lf-icon name="lock" [size]="16" /><span>You haven't joined a Spotlight yet. This story will <strong>not</strong> be shared publicly. Join one to share with a surname community.</span></div>
              <button class="join-link" type="button" (click)="openSpotlights()">Find a Spotlight <lf-icon name="chevronRight" [size]="14" /></button>
            }
          }

          <div class="background-setting">
            <div><strong>Background</strong><small>Change the colour behind your text</small></div>
            <button type="button" class="color-swatch" [style.background]="bg()" (click)="cycleBg()" aria-label="Change story background"><lf-icon name="sparkle" [size]="16" /></button>
          </div>

          <div class="photo-setting">
            <div class="photo-title"><span class="photo-icon"><lf-icon name="image" [size]="18" /></span><div><strong>Add photos</strong><small>{{ media().length }} of 3 selected</small></div></div>
            <button type="button" class="add-photo" (click)="addPhoto()" [disabled]="media().length >= 3 || busy()"><lf-icon name="plus" [size]="16" /> Add photo</button>
          </div>

          @if (error()) { <p class="error" role="alert"><lf-icon name="alert" [size]="15" /> {{ error() }}</p> }
          <p class="privacy-caption">Story replies are private and only visible to you.</p>
          <button class="share-bottom" type="button" (click)="publish()" [disabled]="busy() || !canPublish()">
            <lf-icon name="send" [size]="17" /> {{ busy() ? 'Sharing…' : 'Share story' }}
          </button>
        </section>
      </div>
    </ion-content>
  `,
  styles: [`
    :host { --fb-blue: #1877f2; --fb-text: #1c1e21; --fb-muted: #65676b; --fb-line: #ced0d4; --fb-bg: #f0f2f5; display: block; }
    .story-create { --background: var(--fb-bg); }
    .topbar { position: sticky; z-index: 2; top: 0; height: 52px; display: grid; grid-template-columns: 42px 1fr 60px; align-items: center; gap: 8px; padding: 0 12px; background: #fff; border-bottom: 1px solid var(--fb-line); }
    .topbar strong { text-align: center; font-size: 15px; color: var(--fb-text); }
    .close { width: 36px; height: 36px; display: grid; place-items: center; border: 0; border-radius: 50%; background: var(--fb-bg); color: var(--fb-text); }
    .publish-top { justify-self: end; min-width: 54px; padding: 7px 10px; border: 0; border-radius: 6px; color: #fff; background: var(--fb-blue); font-size: 12px; font-weight: 700; }
    .publish-top:disabled, .share-bottom:disabled { opacity: .45; }
    .layout { width: min(100%, 930px); box-sizing: border-box; display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(290px, .9fr); gap: 16px; margin: 0 auto; padding: 16px; }
    .preview-column { min-width: 0; }
    .preview { position: relative; height: min(67vh, 660px); min-height: 390px; display: flex; flex-direction: column; justify-content: flex-end; box-sizing: border-box; padding: 18px; overflow: hidden; border-radius: 12px; background-size: cover; background-position: center; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
    .shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .preview-scrim { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,.12), transparent 25%, transparent 50%, rgba(0,0,0,.48)); }
    .txt { position: relative; z-index: 1; width: 100%; box-sizing: border-box; min-height: 100px; border: 0; outline: 0; resize: vertical; background: transparent; color: #fff; text-align: center; font: 750 20px/1.35 system-ui,sans-serif; text-shadow: 0 1px 7px rgba(0,0,0,.38); }
    .txt::placeholder { color: rgba(255,255,255,.84); }
    .expires { position: relative; z-index: 1; display: flex; justify-content: center; align-items: center; gap: 5px; margin: 7px 0 0; color: rgba(255,255,255,.88); font-size: 11px; }
    .empty-hint { position: absolute; inset: 18px 20px 45%; display: grid; place-items: center; color: rgba(255,255,255,.85); font-size: 13px; text-align: center; }
    .photo-strip { display: flex; align-items: center; gap: 8px; overflow-x: auto; padding: 11px 2px 2px; }
    .photo-thumb { position: relative; width: 54px; height: 54px; flex: 0 0 54px; border: 2px solid transparent; border-radius: 8px; overflow: visible; }
    .photo-thumb.active { border-color: var(--fb-blue); }
    .photo-thumb > button:first-child { width: 100%; height: 100%; padding: 0; overflow: hidden; border: 0; border-radius: 6px; background: #fff; }
    .photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .photo-thumb .remove { position: absolute; z-index: 1; top: -6px; right: -6px; width: 20px; height: 20px; display: grid; place-items: center; border: 1px solid #fff; border-radius: 50%; background: rgba(28,30,33,.84); color: #fff; }
    .add-more { width: 40px; height: 40px; display: grid; place-items: center; border: 1px dashed #8a8d91; border-radius: 8px; background: #fff; color: var(--fb-blue); }
    .settings { display: flex; flex-direction: column; align-self: start; gap: 12px; min-width: 0; padding: 16px; border: 1px solid #e4e6eb; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.07); }
    .section-title { display: flex; flex-direction: column; gap: 3px; padding-bottom: 6px; }
    .section-title strong { color: var(--fb-text); font-size: 15px; }
    .section-title span { color: var(--fb-muted); font-size: 11px; }
    .audience-list { display: flex; flex-direction: column; gap: 3px; }
    .audience { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 8px; border: 1px solid transparent; border-radius: 8px; background: #fff; text-align: left; color: var(--fb-text); cursor: pointer; }
    .audience.selected { background: #e7f3ff; border-color: #c9ddfa; }
    .aud-icon { width: 32px; height: 32px; display: grid; place-items: center; flex: 0 0 32px; border-radius: 50%; background: var(--fb-bg); color: var(--fb-muted); }
    .audience.selected .aud-icon { color: var(--fb-blue); background: #dceafe; }
    .aud-copy { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .aud-copy strong { font-size: 12.5px; }
    .aud-copy small { color: var(--fb-muted); font-size: 10.5px; }
    .radio { width: 17px; height: 17px; display: grid; place-items: center; border: 1.5px solid #8a8d91; border-radius: 50%; }
    .radio.checked { border-color: var(--fb-blue); }
    .radio i { width: 9px; height: 9px; border-radius: 50%; background: transparent; }
    .radio.checked i { background: var(--fb-blue); }
    .spotlight-picker { display: flex; flex-direction: column; gap: 5px; color: var(--fb-muted); font-size: 11px; font-weight: 650; }
    .spotlight-picker select { min-height: 38px; padding: 0 10px; border: 1px solid var(--fb-line); border-radius: 7px; background: #fff; color: var(--fb-text); font-size: 12px; }
    .privacy-note { display: flex; gap: 8px; align-items: flex-start; padding: 9px; border-radius: 8px; background: #fff4e5; color: #784900; font-size: 11px; line-height: 1.4; }
    .privacy-note lf-icon { margin-top: 1px; }
    .join-link { display: inline-flex; align-items: center; gap: 3px; align-self: flex-start; border: 0; padding: 0; background: none; color: var(--fb-blue); font-size: 11px; font-weight: 700; }
    .background-setting { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px solid #e4e6eb; border-bottom: 1px solid #e4e6eb; }
    .background-setting div, .photo-title div { display: flex; flex-direction: column; gap: 2px; }
    .background-setting strong, .photo-title strong { color: var(--fb-text); font-size: 12px; }
    .background-setting small, .photo-title small { color: var(--fb-muted); font-size: 10.5px; }
    .color-swatch { width: 32px; height: 32px; display: grid; place-items: center; border: 2px solid #e4e6eb; border-radius: 50%; color: #fff; }
    .photo-setting { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .photo-title { display: flex; align-items: center; gap: 8px; }
    .photo-icon { width: 31px; height: 31px; display: grid; place-items: center; border-radius: 50%; background: #e7f3ff; color: var(--fb-blue); }
    .add-photo { display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0 9px; border: 1px solid var(--fb-line); border-radius: 6px; background: #fff; color: var(--fb-blue); font-size: 11px; font-weight: 700; }
    .add-photo:disabled { opacity: .4; }
    .privacy-caption { margin: 0; color: var(--fb-muted); font-size: 10.5px; line-height: 1.35; }
    .share-bottom { display: flex; justify-content: center; align-items: center; gap: 7px; min-height: 39px; border: 0; border-radius: 7px; background: var(--fb-blue); color: #fff; font-size: 12.5px; font-weight: 700; }
    .error { display: flex; gap: 6px; align-items: flex-start; margin: 0; padding: 9px; border-radius: 7px; background: #ffebe9; color: #b42318; font-size: 11.5px; }
    @media (max-width: 700px) {
      .layout { grid-template-columns: 1fr; gap: 12px; padding: 10px 12px 20px; }
      .preview { height: min(54vh, 540px); min-height: 320px; border-radius: 10px; }
      .settings { padding: 13px; }
    }
  `]
})
export class CreateStoryComponent {
  private data = inject(DataService);
  private mediaSvc = inject(MediaService);
  private router = inject(Router);

  text = '';
  hue = 221;
  busy = signal(false);
  error = signal('');
  readonly media = signal<MediaItem[]>([]);
  readonly previewIndex = signal(0);
  readonly audience = signal<Audience>('public');
  readonly spotlightId = signal<string | null>(null);

  protected readonly audiences = AUDIENCES;
  readonly mySpotlights = computed(() => this.data.mySpotlights());
  readonly currentMedia = computed(() => this.media()[this.previewIndex()] ?? null);

  bg(): string { return storyBg(this.hue); }

  audienceHelp(value: Audience): string {
    if (value === 'public') return 'Anyone on LulaFind can view';
    if (value === 'followers') return 'People who follow you can view';
    return 'Members of one Spotlight community';
  }

  canPublish(): boolean {
    const hasContent = !!this.text.trim() || this.media().length > 0;
    return hasContent && (this.audience() !== 'surname' || this.mySpotlights().some((sp) => sp.id === this.spotlightId()));
  }

  pick(audience: Audience): void {
    this.audience.set(audience);
    this.error.set('');
    if (audience === 'surname' && !this.spotlightId()) this.spotlightId.set(this.mySpotlights()[0]?.id ?? null);
    if (audience !== 'surname') this.spotlightId.set(null);
  }

  cycleBg(): void { this.hue = (this.hue + 47) % 360; }

  async addPhoto(): Promise<void> {
    if (this.media().length >= 3) return;
    this.error.set('');
    const item = await this.mediaSvc.pickImage({ quality: 72 });
    if (!item) {
      if (this.mediaSvc.lastError()) this.error.set(this.mediaSvc.lastError()!);
      return;
    }
    const src = await this.mediaSvc.compress(item.src, 1200);
    this.media.set([...this.media(), { ...item, src }]);
    this.previewIndex.set(this.media().length - 1);
  }

  removePhoto(id: string): void {
    const next = this.media().filter((item) => item.id !== id);
    this.media.set(next);
    this.previewIndex.set(Math.max(0, Math.min(this.previewIndex(), next.length - 1)));
  }

  async publish(): Promise<void> {
    if (this.media().length > 3) { this.error.set('A story can have up to three photos.'); return; }
    if (!this.text.trim() && !this.media().length) { this.error.set('Add a photo or write a few words first.'); return; }
    if (this.audience() === 'surname' && !this.mySpotlights().some((sp) => sp.id === this.spotlightId())) {
      this.error.set('Choose a Spotlight you have joined. This story has not been shared.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const story = await this.data.createStory({
        text: this.text,
        media: this.media(),
        bgHue: this.hue,
        audience: this.audience(),
        spotlightId: this.audience() === 'surname' ? this.spotlightId() : null
      });
      await this.router.navigate(['/story', story.id]);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Could not post the story');
    } finally {
      this.busy.set(false);
    }
  }

  openSpotlights(): void { void this.router.navigate(['/spotlight']); }
  cancel(): void { void this.router.navigate(['/home']); }
}
