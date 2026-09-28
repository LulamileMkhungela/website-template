import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonTitle } from '@ionic/angular/ion-title';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { EmptyComponent } from '../../shared/components/empty.component';
import { ChatService } from '../../core/services/chat.service';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { clockTime, timeAgo } from '../../core/utils/format';

@Component({
  selector: 'lf-chats',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IconComponent, AvatarComponent, EmptyComponent],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-title>Messages</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page">
      <div class="lf-banner">
        <lf-icon name="lock" [size]="18" />
        <div>
          Private chat only opens after you <strong>upvote a post</strong> and <strong>follow each other</strong>.
          That is deliberate: it keeps chats between people who genuinely want to help.
        </div>
      </div>

      @if (!auth.signedIn()) {
        <lf-empty icon="lock" title="Sign in to see your messages"
                  message="Chats are private and tied to your account." actionLabel="Sign in" (action)="goAuth()" />
      } @else if (!threads().length) {
        <lf-empty icon="chat" title="No conversations yet"
                  message="Find a case you can help with, upvote it, follow the poster, and the chat unlocks."
                  actionLabel="Browse the feed" (action)="goHome()" />
      } @else {
        <div class="list">
          @for (t of threads(); track t.id) {
            <button class="thread" (click)="open(t.id)">
              <lf-avatar [src]="avatarOf(t)" [name]="nameOf(t)" [size]="50" />
              <div class="grow">
                <div class="lf-row-between">
                  <strong>{{ nameOf(t) }}</strong>
                  <span class="lf-tiny lf-muted">{{ timeAgo(t.lastMessageAt) }}</span>
                </div>
                <div class="lf-row-between">
                  <span class="lf-small lf-muted lf-ellipsis">{{ preview(t.id) }}</span>
                  @if ((t.unread[me()] ?? 0) > 0) { <span class="lf-badge">{{ t.unread[me()] }}</span> }
                </div>
                @if (postOf(t.postId)) {
                  <span class="lf-chip lf-tiny"><lf-icon name="pin" [size]="11" /> {{ postOf(t.postId)!.title.slice(0, 34) }}</span>
                }
              </div>
            </button>
          }
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .list { padding: 4px var(--lf-gap) 24px; display: flex; flex-direction: column; gap: 8px; }
    .thread { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: var(--lf-radius);
      border: 1px solid var(--lf-line); background: var(--lf-card); color: inherit; text-align: left; cursor: pointer; }
    .thread:active { background: var(--lf-card-2); }
    .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .lf-chip { align-self: flex-start; margin-top: 2px; }
  `]
})
export class ChatsComponent {
  protected chat = inject(ChatService);
  protected data = inject(DataService);
  protected auth = inject(AuthService);
  private router = inject(Router);

  protected readonly timeAgo = timeAgo;
  protected readonly me = computed(() => this.auth.viewerId ?? '');
  readonly threads = computed(() => this.chat.threads());

  constructor() {
    void this.chat.load();
  }

  otherId(participantIds: string[]): string {
    return participantIds.find((id) => id !== this.auth.viewerId) ?? '';
  }

  nameOf(t: { participantIds: string[] }): string {
    return this.data.authorOf(this.otherId(t.participantIds))?.displayName ?? 'LulaFind member';
  }

  avatarOf(t: { participantIds: string[] }): string {
    return this.data.avatarFor(this.data.authorOf(this.otherId(t.participantIds)));
  }

  preview(threadId: string): string {
    return 'Open conversation';
  }

  postOf(id: string | null) {
    return id ? this.data.post(id) : null;
  }

  open(id: string): void {
    void this.router.navigate(['/chat', id]);
  }

  goAuth(): void {
    void this.router.navigate(['/auth']);
  }

  goHome(): void {
    void this.router.navigate(['/home']);
  }
}
