import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { ChatService } from '../../core/services/chat.service';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatMessage, MediaItem } from '../../core/models/types';
import { clockTime } from '../../core/utils/format';
import { MediaService } from '../../core/services/media.service';

@Component({
  selector: 'lf-chat-room',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTextarea, RouterLink, IconComponent, AvatarComponent],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/chats" text=""></ion-back-button></ion-buttons>
        <div class="peer">
          <lf-avatar [src]="peerAvatar()" [name]="peerName()" [size]="34" />
          <div>
            <strong>{{ peerName() }}</strong>
            <span class="lf-tiny lf-muted">{{ peerHandle() }}</span>
          </div>
        </div>
        <ion-buttons slot="end">
          <button class="lf-icon-btn" [routerLink]="'/user/' + peerId()"><lf-icon name="user" [size]="20" /></button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page room">
      @if (post()) {
        <a class="casebar" [routerLink]="'/post/' + post()!.id">
          <lf-icon name="pin" [size]="16" />
          <span class="lf-ellipsis">{{ post()!.title }}</span>
          <lf-icon name="chevronRight" [size]="16" />
        </a>
      }

      <div class="notice">
        <lf-icon name="lock" [size]="14" />
        Private chat. Unlocked because you upvoted and follow each other. Never send money to a stranger.
      </div>

      <div class="msgs">
        @for (m of chat.messages(); track m.id) {
          @if (m.kind === 'system') {
            <div class="sys">{{ m.body }}</div>
          } @else {
            <div class="msg" [class.mine]="m.fromUserId === me()">
              @if (m.fromUserId !== me()) { <lf-avatar [src]="peerAvatar()" [name]="peerName()" [size]="28" /> }
              <div class="bubble">
                @if (m.media) {
                  <a [href]="m.media.src" target="_blank" rel="noopener">
                    <img [src]="m.media.src" alt="Photo sent in this chat" loading="lazy" />
                  </a>
                }
                @if (m.body) { <p>{{ m.body }}</p> }
                <span class="lf-tiny">{{ clockTime(m.at) }}</span>
              </div>
            </div>
          }
        }
      </div>
    </ion-content>

    <div class="composer">
      @if (pending()) {
        <div class="pending">
          <img [src]="pending()!.src" alt="Photo ready to send" />
          <span>Photo ready to send</span>
          <button class="rm" (click)="clearPending()" aria-label="Remove photo"><lf-icon name="x" [size]="14" /></button>
        </div>
      }
      @if (emojiOpen()) {
        <div class="picker" role="group" aria-label="Emoji">
          @for (e of EMOJIS; track e) {
            <button type="button" class="em" (click)="addEmoji(e)" [attr.aria-label]="'Insert ' + e">{{ e }}</button>
          }
        </div>
      }
      <div class="bar">
        <button type="button" class="ico em-btn" [class.on]="emojiOpen()" (click)="emojiOpen.set(!emojiOpen())"
                aria-label="Emoji" aria-expanded="emojiOpen()">&#128578;</button>
        <button type="button" class="ico" (click)="attach()" aria-label="Attach a photo"><lf-icon name="image" [size]="19" /></button>
        <button type="button" class="ico" (click)="attach(true)" aria-label="Take a photo"><lf-icon name="camera" [size]="19" /></button>
        <ion-textarea rows="1" autoGrow placeholder="Message…" [value]="draft"
                      (ionInput)="draft = $any($event.target).value"
                      (keydown.enter)="$event.preventDefault(); send()"></ion-textarea>
        <button class="lf-icon-btn send" (click)="send()" [disabled]="chat.sending() || (!draft.trim() && !pending())">
          <lf-icon name="send" [size]="18" />
        </button>
      </div>
    </div>
  `,
  styles: [`
    .peer { display: flex; align-items: center; gap: 10px; }
    .peer div { display: flex; flex-direction: column; line-height: 1.2; }
    .room { --padding-bottom: 80px; }
    .casebar { display: flex; align-items: center; gap: 8px; margin: 10px var(--lf-gap); padding: 10px 12px;
      border-radius: 11px; border: 1px solid var(--lf-line); background: var(--lf-card);
      color: inherit; text-decoration: none; font-size: 13px; font-weight: 600; }
    .notice { display: flex; gap: 8px; margin: 0 var(--lf-gap) 8px; font-size: 11.5px; color: var(--lf-muted);
      padding: 8px 10px; border-radius: 10px; background: var(--lf-card-2); line-height: 1.4; }
    .msgs { display: flex; flex-direction: column; gap: 8px; padding: 6px var(--lf-gap) 20px; }
    .sys { align-self: center; max-width: 82%; text-align: center; font-size: 11.5px; color: var(--lf-muted);
      padding: 8px 12px; border-radius: 999px; background: var(--lf-card-2); }
    .msg { display: flex; gap: 8px; align-items: flex-end; max-width: 82%; }
    .msg.mine { align-self: flex-end; flex-direction: row-reverse; }
    .bubble { padding: 10px 13px; border-radius: 16px; background: var(--lf-card); border: 1px solid var(--lf-line); }
    .bubble p { margin: 0 0 3px; font-size: 14.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
    .msg.mine .bubble { background: color-mix(in srgb, var(--lf-beacon) 20%, var(--lf-card));
      border-color: color-mix(in srgb, var(--lf-beacon) 40%, transparent); }
    .bubble .lf-tiny { color: var(--lf-muted); }
    .bubble img { display: block; max-width: 210px; width: 100%; border-radius: 12px; margin-bottom: 4px; }
    .bar { display: flex; align-items: flex-end; gap: 8px; width: 100%; }
    .ico { flex: none; width: 44px; height: 44px; border: none; border-radius: 50%; cursor: pointer;
      background: var(--lf-card-2); color: var(--lf-muted); display: grid; place-items: center; }
    .ico.on { background: color-mix(in srgb, var(--lf-beacon) 25%, var(--lf-card-2)); color: var(--lf-ink); }
    .em-btn { font-size: 19px; line-height: 1; }
    .picker { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; width: 100%;
      padding: 6px 2px 8px; border-bottom: 1px solid var(--lf-line); }
    .em { border: none; background: none; font-size: 21px; line-height: 1; padding: 5px 0; cursor: pointer; border-radius: 8px; }
    .em:active { background: var(--lf-card-2); }
    .pending { display: flex; align-items: center; gap: 9px; width: 100%; padding-bottom: 8px;
      border-bottom: 1px solid var(--lf-line); margin-bottom: 8px; }
    .pending img { width: 42px; height: 42px; object-fit: cover; border-radius: 9px; }
    .pending span { font-size: 12px; color: var(--lf-muted); flex: 1; }
    .pending .rm { flex: none; width: 26px; height: 26px; border: none; border-radius: 50%; cursor: pointer;
      background: var(--lf-card-2); color: var(--lf-muted); display: grid; place-items: center; }
    .composer { position: fixed; left: 0; right: 0; bottom: var(--keyboard-offset, 0px); display: flex; flex-direction: column;
      padding: 10px 14px; padding-bottom: max(10px, var(--lf-safe-bottom, 0px));
      padding-left: max(14px, var(--lf-safe-left, 0px)); padding-right: max(14px, var(--lf-safe-right, 0px));
      background: color-mix(in srgb, var(--lf-toolbar) 78%, transparent);
      backdrop-filter: blur(18px) saturate(1.3); -webkit-backdrop-filter: blur(18px) saturate(1.3);
      border-top: 1px solid var(--lf-line); }
    .bar ion-textarea { flex: 1; --background: var(--lf-card-2); border-radius: 18px; --padding-start: 14px; }
    .send { background: var(--lf-beacon); color: #1a1200; width: 44px; height: 44px; }
    .send[disabled] { opacity: .4; }
  `]
})
export class ChatRoomComponent implements OnInit, OnDestroy {
  protected chat = inject(ChatService);
  protected data = inject(DataService);
  private media = inject(MediaService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  protected readonly clockTime = clockTime;
  draft = '';
  private timer: any;

  protected emojiOpen = signal(false);
  protected pending = signal<MediaItem | null>(null);

  /**
   * Real phone emojis. No image pack to ship and nothing to download, so they
   * work offline and render in whatever style the device already uses.
   */
  protected readonly EMOJIS = [
    '\ud83d\udc4d', '\ud83d\ude4f', '\u2764\ufe0f', '\ud83d\ude22', '\ud83d\ude2e', '\ud83e\udd7a',
    '\u2705', '\u274c', '\ud83d\udea8', '\ud83d\ude97', '\ud83d\udc15', '\ud83c\udfe0',
    '\ud83d\udccd', '\ud83d\udcde', '\ud83d\dd52', '\u2b50'
  ];

  readonly me = computed(() => this.auth.viewerId);
  readonly thread = computed(() => this.chat.threads().find((t) => t.id === this.route.snapshot.paramMap.get('threadId')));
  readonly peerId = computed(() => this.thread()?.participantIds.find((id) => id !== this.auth.viewerId) ?? '');
  readonly peer = computed(() => this.data.authorOf(this.peerId()));
  readonly peerName = computed(() => this.peer()?.displayName ?? 'LulaFind member');
  readonly peerHandle = computed(() => (this.peer() ? '@' + this.peer()!.handle : ''));
  readonly peerAvatar = computed(() => this.data.avatarFor(this.peer()));
  readonly post = computed(() => {
    const id = this.thread()?.postId;
    return id ? this.data.post(id) ?? null : null;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('threadId');
    if (!id) return;
    await this.chat.load();
    await this.chat.openThread(id);
    this.timer = setInterval(() => void this.chat.load(), 4000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    void this.chat.close();
  }

  protected addEmoji(e: string): void {
    this.draft = `${this.draft}${e}`;
  }

  /** Attach a photo from the gallery, or straight from the camera. */
  protected async attach(camera = false): Promise<void> {
    this.emojiOpen.set(false);
    try {
      const m = await this.media.pickImage({ source: camera ? 'camera' : 'gallery' });
      if (m) this.pending.set(m);
    } catch {
      /* the picker was cancelled or blocked - nothing to send */
    }
  }

  protected clearPending(): void {
    this.pending.set(null);
  }

  async send(): Promise<void> {
    const text = this.draft.trim();
    const photo = this.pending();
    if (!text && !photo) return;
    this.draft = '';
    this.pending.set(null);
    this.emojiOpen.set(false);
    await this.chat.send(text, photo);
  }
}
