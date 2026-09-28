import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Story, UserProfile } from '../../core/models/types';
import { timeAgo } from '../../core/utils/format';
import { storyBg } from '../../core/data/seed';
import { IconComponent } from './icon.component';
import { AvatarComponent } from './avatar.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * Facebook-style tall rectangular Story Rail.
 * Card 1 is "Create story" with top photo + blue plus badge.
 * Subsequent cards are tall story covers with user avatar badge at top-left.
 */
@Component({
  selector: 'lf-story-rail',
  standalone: true,
  imports: [RouterLink, IconComponent, AvatarComponent],
  template: `
    <div class="fb-story-rail">
      <!-- Card 1: Create Story -->
      <button class="fb-story-card fb-story-card--create" (click)="addStory.emit()">
        <div class="fb-story-top-img">
          <lf-avatar [src]="myAvatar()" [name]="myName()" [size]="100" />
        </div>
        <div class="fb-story-plus-wrap">
          <div class="fb-story-plus-btn">
            <lf-icon name="plus" [size]="18" [weight]="2.5" />
          </div>
          <span class="fb-story-create-label">Create story</span>
        </div>
      </button>

      <!-- User Stories -->
      @for (s of grouped(); track s.id) {
        <a class="fb-story-card" [routerLink]="'/story/' + s.id" [style.background]="bgOf(s)">
          @if (mediaOf(s)) {
            <img class="fb-story-cover" [src]="mediaOf(s)" [alt]="nameOf(s)" loading="lazy" />
          }
          <div class="fb-story-avatar-badge" [class.seen]="isSeen(s)">
            <lf-avatar [src]="avatarOf(s)" [name]="nameOf(s)" [size]="34" />
          </div>
          <span class="fb-story-name">{{ nameOf(s) }}</span>
        </a>
      }
    </div>
  `,
  styles: [`
    .fb-story-rail {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 10px 12px;
      background: #ffffff;
      border-top: 1px solid #ced0d4;
      border-bottom: 1px solid #ced0d4;
      margin-bottom: 8px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .fb-story-rail::-webkit-scrollbar { display: none; }

    .fb-story-card {
      width: 100px;
      height: 160px;
      border-radius: 12px;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid #ced0d4;
      background: #e4e6eb;
      text-decoration: none;
      color: #ffffff;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    .fb-story-card:active { transform: scale(0.98); }

    /* Create Story Card */
    .fb-story-card--create {
      background: #ffffff;
      border-color: #ced0d4;
      padding: 0;
    }
    .fb-story-top-img {
      height: 105px;
      width: 100%;
      overflow: hidden;
      background: #e4e6eb;
    }
    .fb-story-top-img lf-avatar {
      width: 100%;
      height: 100%;
      border-radius: 0;
      object-fit: cover;
    }
    .fb-story-plus-wrap {
      height: 55px;
      background: #ffffff;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      padding-bottom: 8px;
    }
    .fb-story-plus-btn {
      position: absolute;
      top: -16px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #1877f2;
      color: #ffffff;
      border: 3px solid #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .fb-story-create-label {
      font-size: 11.5px;
      font-weight: 700;
      color: #050505;
    }

    .fb-story-cover {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .fb-story-avatar-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      border-radius: 50%;
      padding: 2px;
      background: #1877f2;
      z-index: 2;
    }
    .fb-story-avatar-badge.seen {
      background: #ced0d4;
    }

    .fb-story-name {
      position: absolute;
      bottom: 8px;
      left: 8px;
      right: 8px;
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      z-index: 2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
})
export class StoryRailComponent {
  @Output() addStory = new EventEmitter<void>();

  private data = inject(DataService);
  private auth = inject(AuthService);

  protected readonly timeAgo = timeAgo;

  readonly grouped = computed(() => this.data.visibleStories().slice(0, 30));
  readonly myAvatar = computed(() => this.data.avatarFor(this.auth.user()));
  readonly myName = computed(() => this.auth.user()?.displayName ?? 'You');

  nameOf(s: Story): string {
    const u = this.data.authorOf(s.authorId);
    return u?.displayName.split(' ')[0] ?? 'Member';
  }

  avatarOf(s: Story): string {
    return this.data.avatarFor(this.data.authorOf(s.authorId));
  }

  mediaOf(s: Story): string | null {
    return s.media[0]?.src ?? null;
  }

  isSeen(s: Story): boolean {
    const me = this.auth.viewerId;
    return !!me && (s.authorId === me || s.viewers.includes(me));
  }

  bgOf(s: Story): string {
    return storyBg(s.bgHue);
  }
}
