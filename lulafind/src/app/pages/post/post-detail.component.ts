import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { ToastController } from '@ionic/angular/toast-controller';
import { AlertController } from '@ionic/angular/alert-controller';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { IconComponent } from '../../shared/components/icon.component';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { DataService } from '../../core/services/data.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatService, ChatGate } from '../../core/services/chat.service';
import { EscalationService } from '../../core/services/escalation.service';
import { PlatformService } from '../../core/services/platform.service';
import { ModerationService } from '../../core/services/moderation.service';
import { Comment, POST_TYPE_META, Post, UserProfile, dangerLabel, provinceName } from '../../core/models/types';
import { compact, dayMonth, fullDate, timeAgo, urgency } from '../../core/utils/format';
import { searchFocus } from '../../core/utils/search-focus';
import { escalationNote } from '../../core/data/sa-help';
import { leadMarkView } from '../../core/utils/mark-check';

@Component({
  selector: 'lf-post-detail',
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonTextarea,
    IonSkeletonText, RouterLink, IconComponent, AvatarComponent
  ],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" text=""></ion-back-button></ion-buttons>
        <ion-title>{{ p() ? POST_TYPE_META[p()!.type].label : 'Post' }}</ion-title>
        <ion-buttons slot="end">
          @if (data.canEdit(p())) {
            <button class="lf-icon-btn" routerLink="/post/{{ p()?.id }}/edit" aria-label="Edit">
              <lf-icon name="edit" [size]="19" />
            </button>
          }
          <button class="lf-icon-btn" (click)="more()"><lf-icon name="more" [size]="20" /></button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="lf-page" id="comments">
      @if (!p()) {
        <div class="lf-card"><ion-skeleton-text style="height:220px"></ion-skeleton-text></div>
      } @else {
        <article class="detail">
          <!-- author -->
          <div class="lf-card author">
            <div class="lf-row">
              <lf-avatar [src]="authorAvatar()" [name]="authorName()" [size]="46" />
              <div class="lf-grow">
                <div class="lf-row" style="gap:6px">
                  <strong>{{ authorName() }}</strong>
                  @if (author()?.verified) { <lf-icon name="award" [size]="14" /> }
                </div>
                <div class="lf-meta">
                  {{ roleLine() }} · {{ timeAgo(p()!.createdAt) }}
                  @if (!isMine()) { · <a class="lnk" [routerLink]="'/user/' + p()!.authorId">view profile</a> }
                </div>
              </div>
              @if (!isMine()) {
                <button class="lf-btn lf-btn--sm" [class.lf-btn--ghost]="following() || followRequested()" (click)="toggleFollow()">
                  {{ following() ? 'Following' : followRequested() ? 'Requested' : 'Follow' }}
                </button>
              }
            </div>
            <div class="chips">
              <span class="lf-chip" [class.lf-chip--danger]="p()!.type === 'missing'"
                    [class.lf-chip--warn]="p()!.type === 'khumbulekhaya'"
                    [class.lf-chip--success]="p()!.status === 'found'">
                <lf-icon [name]="POST_TYPE_META[p()!.type].icon" [size]="12" /> {{ statusLabel() }}
              </span>
              <span class="lf-chip"><lf-icon name="pin" [size]="12" /> {{ provinceName(p()!.province) }} · {{ p()!.town }}</span>
              @if (urgency(p()!) === 'critical') { <span class="lf-chip lf-chip--danger lf-pulse">First 72 hours</span> }
              @if (p()!.anonymous) { <span class="lf-chip lf-chip--ghost"><lf-icon name="eyeOff" [size]="12" /> anonymous post</span> }
              <span class="lf-chip lf-chip--ghost"><lf-icon [name]="audienceIcon()" [size]="12" /> {{ audienceLabel() }}</span>
            </div>
          </div>

          <!-- outcome banner -->
          @if (p()!.type === 'danger') {
            <div class="lf-banner" [class.lf-banner--danger]="!p()!.danger?.clearedAt" [class.lf-banner--success]="!!p()!.danger?.clearedAt">
              <lf-icon name="alert" [size]="20" />
              <div>
                <strong>{{ p()!.danger?.clearedAt ? 'Clear for now' : dangerLabel(p()!.danger?.kind) + ' nearby' }}</strong><br />
                <span class="lf-small">{{ p()!.lastSeenWhere || p()!.town }} · {{ p()!.danger?.stillIds?.length ?? 0 }} say it is still happening · {{ p()!.danger?.clearIds?.length ?? 0 }} say it is clear</span>
              </div>
            </div>
          }

          @if (p()!.status === 'found') {
            <div class="lf-banner lf-banner--success">
              <lf-icon name="award" [size]="20" />
              <div>
                <strong>FOUND</strong> · {{ p()!.outcome.whereaboutsFound || 'Safe' }}<br />
                <span class="lf-small lf-muted">{{ p()!.outcome.note }} · closed {{ dayMonth(p()!.outcome.foundAt) }}</span>
                @if (p()!.outcome.finderName) {
                  <span class="lf-small">Found by {{ p()!.outcome.finderName }}</span>
                }
              </div>
            </div>
          }

          @if (urgency(p()!) === 'critical' && p()!.status === 'active') {
            <div class="lf-banner lf-banner--danger">
              <lf-icon name="alert" [size]="20" />
              <div>
                <strong>This case is in the critical first 72 hours.</strong><br />
                <span class="lf-small">If you have any information, do not approach anyone - comment below or call 10111.</span>
              </div>
            </div>
          }

          @if (focus(); as f) {
            <div class="focus" [attr.data-ring]="f.ring">
              <div class="lf-grow">
                <strong>{{ f.title }} · {{ f.where }}</strong>
                <span class="lf-small">{{ f.why }}</span>
                @if (lookCount()) {
                  <span class="lf-small">{{ lookCount() }} {{ lookCount() === 1 ? 'person is' : 'people are' }} looking.</span>
                }
              </div>
              @if (!isMine()) {
                <button class="lf-btn lf-btn--sm" [class.lf-btn--ghost]="looking()" (click)="toggleLooking()">
                  {{ looking() ? 'Looking' : "I'm looking" }}
                </button>
              }
            </div>
          }

          <!-- body -->
          <div class="lf-card">
            <div class="lf-card__body">
              <h1 class="lf-h1 title">{{ p()!.title }}</h1>
              <p class="lf-prose body">{{ p()!.body }}</p>

              <dl class="lf-kv facts">
                @if (p()!.subject?.name) { <dt>Name</dt><dd>{{ p()!.subject?.name }}</dd> }
                @if (p()!.subject?.age !== null && p()!.subject?.age !== undefined) { <dt>Age</dt><dd>{{ p()!.subject?.age }}</dd> }
                @if (p()!.subject?.gender && p()!.subject?.gender !== 'unknown') { <dt>Gender</dt><dd>{{ p()!.subject?.gender }}</dd> }
                @if (p()!.subject?.height) { <dt>Height</dt><dd>{{ p()!.subject?.height }}</dd> }
                @if (p()!.subject?.build) { <dt>Build</dt><dd>{{ p()!.subject?.build }}</dd> }
                @if (p()!.subject?.skinTone) { <dt>Skin tone</dt><dd>{{ p()!.subject?.skinTone }}</dd> }
                @if (p()!.subject?.hair) { <dt>Hair</dt><dd>{{ p()!.subject?.hair }}</dd> }
                @if (p()!.subject?.clothing) { <dt>Wearing</dt><dd>{{ p()!.subject?.clothing }}</dd> }
                @if (p()!.subject?.distinguishing) {
                  <dt>A mark only the family knows</dt>
                  <dd>{{ isMine() ? p()!.subject?.distinguishing : 'Held back, so a caller has to name it.' }}</dd>
                }
                @if (p()!.subject?.medical) { <dt>Medical</dt><dd>{{ p()!.subject?.medical }}</dd> }
                @if (p()!.subject?.languages) { <dt>Speaks</dt><dd>{{ p()!.subject?.languages }}</dd> }
                @if (p()!.subject?.vehicle) { <dt>Vehicle</dt><dd>{{ p()!.subject?.vehicle }}</dd> }
                @if (p()!.lastSeenWhere) { <dt>{{ p()!.type === 'danger' ? 'Place' : 'Last seen' }}</dt><dd>{{ p()!.lastSeenWhere }} · {{ dayMonth(p()!.lastSeenAt) }}</dd> }
                @if (p()!.caseNumber) { <dt>SAPS case</dt><dd>{{ p()!.caseNumber }}</dd> }
                @if (p()!.reward) {
                  <dt>Reward</dt>
                  <dd>{{ isMine() ? p()!.reward : 'Offered. The family says the amount only to a real lead.' }}</dd>
                }
              </dl>

              <div class="contact">
                <lf-icon [name]="p()!.contactVisibleTo === 'owner' ? 'lock' : 'phone'" [size]="16" />
                <div class="lf-grow">
                  <strong>{{ p()!.contactLabel }}</strong>
                  <span class="lf-muted lf-small">{{ contactText() }}</span>
                </div>
                @if (showContact()) {
                  <button class="lf-btn lf-btn--sm" (click)="copyContact()"><lf-icon name="copy" [size]="14" /> Copy</button>
                }
              </div>
              @if (p()!.type === 'vehicle') {
                <p class="lf-small">LulaFind cannot track this vehicle. Report it at a police station. If it has Tracker, Netstar, or Cartrack, open that app. Do not buy it from a stranger — ask SAPS to check the plate.</p>
              }
              @if (p()!.type === 'missing' || p()!.type === 'pet' || p()!.type === 'vehicle' || p()!.type === 'khumbulekhaya') {
                <a class="lf-btn lf-btn--block" [routerLink]="'/post/' + p()!.id + '/poster'" style="text-decoration:none;margin-top:10px">
                  <lf-icon name="share" [size]="16" /> Poster to share
                </a>
              }
            </div>

            @if (p()!.media.length) {
              <div class="lf-scroller media">
                <p class="lf-tiny lf-muted mediacount">{{ p()!.media.length }} {{ p()!.media.length === 1 ? 'file' : 'files' }}</p>
                @for (m of p()!.media; track m.id) {
                  <figure>
                    @if (m.kind === 'video') {
                      <video [src]="m.src" controls preload="metadata" class="lf-media--contain"></video>
                    } @else {
                      <img [src]="m.src" [alt]="m.caption ?? p()!.title" class="lf-media--contain" />
                    }
                    @if (m.caption) { <figcaption>{{ m.caption }}</figcaption> }
                  </figure>
                }
              </div>
            }

            @if (p()!.sightingVerified) {
              <div class="verified">
                <lf-icon name="award" [size]="18" />
                <div class="lf-grow">
                  <strong>Verified sighting</strong>
                  <span class="lf-small">
                    Checked against {{ sourceLabel(p()!.sightingVerified!.source) }} by a LulaFind admin
                    · {{ timeAgo(p()!.sightingVerified!.at) }}
                  </span>
                  @if (p()!.sightingVerified!.note) { <span class="lf-small">"{{ p()!.sightingVerified!.note }}"</span> }
                </div>
              </div>
            }

            @if (p()!.searchParty?.open) {
              <div class="party">
                <div class="lf-row-between">
                  <h3 class="lf-h2"><lf-icon name="users" [size]="16" /> Ground search</h3>
                  <span class="lf-chip lf-chip--success lf-tiny">open</span>
                </div>
                <p class="lf-small lf-muted">
                  Meet at <strong>{{ p()!.searchParty!.meetAt }}</strong>
                  @if (p()!.searchParty!.meetWhen) { · {{ fullDate(p()!.searchParty!.meetWhen) }} }
                </p>
                @for (z of p()!.searchParty!.zones; track z.id) {
                  <div class="zone" [class.done]="z.done" [class.taken]="!!z.takenBy && z.takenBy !== auth.viewerId">
                    <div class="lf-grow">
                      <strong>{{ z.name }}</strong>
                      <span class="lf-small lf-muted">
                        @if (z.done) { Searched }
                        @else if (z.takenBy === auth.viewerId) { You are covering this }
                        @else if (z.takenBy) { {{ data.authorOf(z.takenBy)?.displayName ?? 'Someone' }} is on it }
                        @else { Nobody assigned yet }
                        @if (z.note) { · {{ z.note }} }
                      </span>
                    </div>
                    <button class="lf-btn lf-btn--sm lf-btn--ghost" (click)="claimZone(z.id)">
                      {{ z.takenBy === auth.viewerId ? 'Release' : 'I will take this' }}
                    </button>
                    <button class="lf-btn lf-btn--sm" (click)="completeZone(z.id)">
                      {{ z.done ? 'Reopen' : 'Searched' }}
                    </button>
                  </div>
                }
              </div>
            } @else if (canEditPost() && p()!.type !== 'danger') {
              <button class="lf-btn lf-btn--ghost lf-btn--block" (click)="openParty()">
                <lf-icon name="users" [size]="16" /> Start a ground search
              </button>
            }

            <div class="counters">
              <span><lf-icon name="bulb" [size]="13" /> {{ compact(p()!.upvotes) }} have an idea</span>
              <span>{{ compact(p()!.downvotes) }} no idea</span>
              <span>{{ compact(p()!.commentCount) }} comments</span>
              <span>{{ compact(p()!.shares) }} shares</span>
              <span>{{ compact(p()!.views) }} views</span>
            </div>

            <div class="lf-actions">
              @if (p()!.type === 'danger') {
                <button class="lf-action" [class.lf-on]="dangerMine() === 'still'" (click)="markDanger(true)">
                  <lf-icon name="alert" [size]="18" /> Still happening
                </button>
                <button class="lf-action" [class.lf-on]="dangerMine() === 'clear'" (click)="markDanger(false)">
                  <lf-icon name="check" [size]="18" /> It's clear
                </button>
              } @else {
              <button class="lf-action lf-action--up" [class.lf-on]="myVote() === 'up'" (click)="vote('up')">
                <lf-icon name="bulb" [size]="18" /> Idea
              </button>
              <button class="lf-action lf-action--down" [class.lf-on]="myVote() === 'down'" (click)="vote('down')">
                <lf-icon name="bulbOff" [size]="18" /> No idea
              </button>
              }
              <button class="lf-action" (click)="focusComment()"><lf-icon name="comment" [size]="18" /> Comment</button>
              <button class="lf-action" (click)="share()"><lf-icon name="share" [size]="18" /> Share</button>
              <button class="lf-action lf-action--save" [class.lf-on]="saved()" (click)="save()"><lf-icon name="bookmark" [size]="18" /></button>
            </div>
          </div>

          <!-- KhumbulEkhaya panel -->
          @if (p()!.type === 'khumbulekhaya' && p()!.khumbu) {
            <div class="lf-card khumbu">
              <div class="lf-card__body">
                <div class="lf-row" style="gap:8px">
                  <lf-icon name="home" [size]="20" />
                  <h2 class="lf-h2" style="margin:0">KhumbulEkhaya</h2>
                </div>
                <p class="lf-small lf-muted">
                  {{ p()!.khumbu!.daysOut ?? 0 }} days out · {{ p()!.khumbu!.reasonGuess }}
                  They may have left to be safe. They can answer here. Do not force them home.
                </p>

                @if (p()!.askWanted) {
                  <div class="wanted">
                    <strong>Are they being wanted?</strong>
                    <span class="lf-small lf-muted">Your answer tells the family whether this is a search or a conversation.</span>
                    <div class="lf-row" style="gap:8px;margin-top:8px">
                      <button class="lf-btn lf-btn--sm" [class.lf-btn--danger]="p()!.khumbu!.wantedAnswers.myVote === true"
                              (click)="wanted(true)">
                        <lf-icon name="search" [size]="14" /> Yes, we are searching · {{ p()!.khumbu!.wantedAnswers.yes }}
                      </button>
                      <button class="lf-btn lf-btn--sm" [class.lf-btn--success]="p()!.khumbu!.wantedAnswers.myVote === false"
                              (click)="wanted(false)">
                        <lf-icon name="heart" [size]="14" /> No, we just miss them · {{ p()!.khumbu!.wantedAnswers.no }}
                      </button>
                    </div>
                  </div>
                }

                @if (canClaim()) {
                  <div class="claim">
                    <lf-icon name="user" [size]="20" />
                    <div class="lf-grow">
                      <strong>Is this you?</strong>
                      <span class="lf-small lf-muted">Claiming this post is private. Nobody sees that you claimed it until you answer.</span>
                    </div>
                    <button class="lf-btn lf-btn--primary lf-btn--sm" (click)="claim()">This is me</button>
                  </div>
                }

                @if (waitingAnswer()) {
                  <div class="respond">
                    <strong>You claimed this post. What do you want your family to know?</strong>
                    <div class="lf-row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
                      <button class="lf-btn lf-btn--success lf-btn--sm" (click)="respond('going_home')">I am coming home</button>
                      <button class="lf-btn lf-btn--sm" (click)="respond('not_going_home')">I am safe, not coming home</button>
                      <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="respond('contact_me')">Let us chat first</button>
                    </div>
                    <ion-textarea rows="2" placeholder="Add a message (optional)" [value]="khumbuNote"
                                  (ionInput)="khumbuNote = $any($event.target).value"></ion-textarea>
                  </div>
                }

                @if (openAnswer()) {
                  <div class="answered" [class.ok]="p()!.khumbu!.subjectResponse !== 'not_going_home'">
                    <lf-icon [name]="p()!.khumbu!.subjectResponse === 'not_going_home' ? 'check' : 'home'" [size]="18" />
                    <div>
                      <strong>{{ responseLabel() }}</strong>
                      @if (p()!.khumbu!.subjectNote) { <p class="lf-small">"{{ p()!.khumbu!.subjectNote }}"</p> }
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          @if (showSubjectCard()) {
            <div class="lf-card">
              <div class="lf-card__body">
                @if (childCase()) {
                  <p class="lf-small">If this child is safe, call Childline on 116. This post cannot be claimed.</p>
                } @else {
                  @if (canClaim()) {
                    <div class="claim">
                      <lf-icon name="user" [size]="20" />
                      <div class="lf-grow">
                        <strong>Is this you?</strong>
                        <span class="lf-small lf-muted">Only the family sees that you claimed it, until you answer. You do not have to go home.</span>
                      </div>
                      <button class="lf-btn lf-btn--primary lf-btn--sm" (click)="claim()">This is me</button>
                    </div>
                  }
                  @if (waitingAnswer()) {
                    <div class="respond">
                      <strong>What do you want them to know?</strong>
                      <div class="lf-row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
                        <button class="lf-btn lf-btn--success lf-btn--sm" (click)="respond('going_home')">I am coming home</button>
                        <button class="lf-btn lf-btn--sm" (click)="respond('not_going_home')">I am safe, not coming home</button>
                        <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="respond('contact_me')">Let us chat first</button>
                      </div>
                    </div>
                  }
                  @if (openAnswer()) {
                    <div class="answered">
                      <strong>{{ responseLabel() }}</strong>
                      @if (p()!.khumbu!.subjectNote) { <p class="lf-small">"{{ p()!.khumbu!.subjectNote }}"</p> }
                    </div>
                  }
                }
              </div>
            </div>
          }

          <!-- escalation -->
          <div class="lf-card">
            <div class="lf-card__body">
              <div class="lf-row" style="gap:8px">
                <lf-icon name="megaphone" [size]="20" />
                <h2 class="lf-h2" style="margin:0">Get help</h2>
              </div>
              <p class="lf-small lf-muted">
                LulaFind does not send this case to the police or an NGO. Call them yourself.
              </p>
              @if (p()!.escalation.partners.length) {
                <div class="partners">
                  @for (e of p()!.escalation.partners; track e.partnerId) {
                    <div class="partner">
                      <lf-icon name="info" [size]="15" />
                      <div class="lf-grow">
                        <strong>{{ e.partnerName }}</strong>
                        <span class="lf-small lf-muted">{{ contactNote(e.status) }}
                          @if (e.reference) { · station case {{ e.reference }} }</span>
                      </div>
                    </div>
                  }
                </div>
              }
              <a class="lf-btn lf-btn--primary lf-btn--block" routerLink="/help" style="text-decoration:none">
                <lf-icon name="phone" [size]="16" /> Get help
              </a>
              @if (isMine() && p()!.type !== 'story') {
                <button class="lf-btn lf-btn--block" [routerLink]="'/escalate/' + p()!.id">
                  <lf-icon name="check" [size]="16" /> Record who I called
                </button>
              }
            </div>
          </div>

          <!-- location check -->
          @if (p()!.type !== 'story') {
            <div class="lf-card">
              <div class="lf-card__body">
                <div class="lf-row" style="gap:8px">
                  <lf-icon name="target" [size]="20" />
                  <h2 class="lf-h2" style="margin:0">Location check</h2>
                </div>
                <p class="lf-small lf-muted">
                  @if (p()!.locationCheck.consentFromSubject === 'granted') {
                    The subject consented to share their location with this search.
                  } @else if (p()!.locationCheck.consentFromSubject === 'declined') {
                    {{ p()!.locationCheck.note || 'The subject was asked and declined. LulaFind holds no location data for them.' }}
                  } @else {
                    If this person has a LulaFind account, you can ask them for consent to share their location with this search.
                    They - not you - decide.
                  }
                </p>
                @if (isMine()) {
                  <button class="lf-btn lf-btn--ghost lf-btn--block" [routerLink]="'/location-check/' + p()!.id">
                    <lf-icon name="target" [size]="16" /> Open location & consent centre
                  </button>
                }
              </div>
            </div>
          }

          <!-- poster outcome nudge -->
          @if (isMine() && p()!.status === 'active' && (p()!.upvotes >= 15 || p()!.commentCount >= 2)) {
            <div class="lf-banner lf-banner--warn">
              <lf-icon name="sparkle" [size]="20" />
              <div class="lf-grow">
                <strong>Did you get help?</strong><br />
                <span class="lf-small">{{ compact(p()!.upvotes) }} people have an idea and {{ p()!.commentCount }} commented. Tell us if they are home so we can stop the search.</span>
              </div>
              <div class="lf-col">
                <button class="lf-btn lf-btn--success lf-btn--sm" (click)="markFound()">They are found</button>
                <button class="lf-btn lf-btn--ghost lf-btn--sm" (click)="stillSearching()">Still searching</button>
              </div>
            </div>
          } @else if (isMine() && p()!.status === 'active') {
            <div class="lf-card">
              <div class="lf-card__body">
                <button class="lf-btn lf-btn--success lf-btn--block" (click)="markFound()">
                  <lf-icon name="check" [size]="16" /> Mark as found
                </button>
              </div>
            </div>
          }

          <!-- chat gate -->
          @if (!isMine() && p()!.chatEnabled) {
            <div class="lf-card">
              <div class="lf-card__body">
                <div class="lf-row" style="gap:8px">
                  <lf-icon [name]="gate() && !gate()!.allowed ? 'lock' : 'unlock'" [size]="20" />
                  <h2 class="lf-h2" style="margin:0">Private chat</h2>
                </div>
                <p class="lf-small lf-muted">{{ gate()!.allowed ? 'Chat with the poster is unlocked.' : gateReason() }}</p>
                <ol class="steps" [class.done1]="stepDone(1)" [class.done2]="stepDone(2)" [class.done3]="stepDone(3)">
                  <li><span>1</span> Upvote this post ("I have an idea")</li>
                  <li><span>2</span> Follow each other</li>
                  <li><span>3</span> Private chat opens</li>
                </ol>
                <button class="lf-btn lf-btn--primary lf-btn--block" (click)="openChat()">
                  <lf-icon name="chat" [size]="16" /> {{ gate()!.allowed ? 'Open private chat' : nextChatAction() }}
                </button>
              </div>
            </div>
          }

          <!-- comments -->
          <div class="lf-card">
            <div class="lf-card__body">
              <h2 class="lf-h2" style="margin:0 0 4px">Comments ({{ comments().length }})</h2>
              <p class="lf-small lf-muted">Leads, sightings and support. Never post a suspect's home address.</p>

              @if (!p()!.allowComments) {
                <p class="lf-small lf-muted">The poster turned comments off for this post.</p>
              } @else {
                <div class="composer">
                  <lf-avatar [src]="myAvatar()" [name]="me() ? 'Me' : 'Guest'" [size]="34" />
                  <ion-textarea rows="2" autoGrow placeholder="Add a comment or a lead…" [value]="draft"
                                (ionInput)="draft = $any($event.target).value"></ion-textarea>
                  <button class="lf-icon-btn send" (click)="postComment(null)" [disabled]="!draft.trim()">
                    <lf-icon name="send" [size]="18" />
                  </button>
                </div>
                <label class="leadcheck">
                  <input type="checkbox" [checked]="asLead" (change)="asLead = $any($event.target).checked" />
                  <span>This is a <strong>lead</strong> (something you actually saw or know)</span>
                </label>
                @if (asLead && p()!.subject?.distinguishing) {
                  <input class="mark" [value]="markGuess" (input)="markGuess = $any($event.target).value" placeholder="A mark you noticed. Only the family sees the words." />
                }
              }

              @if (!comments().length && p()!.allowComments) {
                <p class="lf-small lf-muted" style="padding:10px 0">No comments yet. Be the first to help.</p>
              }

              @for (c of comments(); track c.id) {
                <div class="comment">
                  <lf-avatar [src]="data.avatarFor(data.authorOf(c.authorId))" [name]="data.authorOf(c.authorId)?.displayName ?? ''" [size]="34" />
                  <div class="lf-grow">
                    <div class="lf-meta">
                      <a class="lnk strong" [routerLink]="'/user/' + c.authorId">{{ data.authorOf(c.authorId)?.displayName ?? 'Member' }}</a>
                      · {{ timeAgo(c.createdAt) }}
                      @if (c.isLead) { <span class="lf-chip lf-chip--success lf-tiny">lead</span> }
                    </div>
                    <p class="lf-prose">{{ c.body }}</p>
                    @if (c.sighting) {
                      <div class="sighting">
                        <lf-icon name="pin" [size]="13" /> {{ c.sighting.place }} · {{ provinceName(c.sighting.province) }}
                        @if (c.sighting.note) { <span>· {{ c.sighting.note }}</span> }
                      </div>
                    }
                    @if (leadMark(c, isMine()); as mark) {
                      @if (mark.status) {
                        <p class="lf-small">{{ mark.status }}</p>
                        @if (mark.guess) { <p class="lf-small">They said: “{{ mark.guess }}”</p> }
                        @if (isMine() && c.markGuess && !c.markCheck) {
                          <div class="lf-row" style="gap:8px">
                            <button class="lf-btn lf-btn--sm" type="button" (click)="checkMark(c, 'match')">It matches</button>
                            <button class="lf-btn lf-btn--sm" type="button" (click)="checkMark(c, 'no')">It does not</button>
                          </div>
                        }
                      }
                    }
                    <div class="lf-row" style="gap:12px;margin-top:4px">
                      <button class="mini" (click)="upComment(c)"><lf-icon name="thumbup" [size]="13" /> {{ c.upvotes }}</button>
                      @if (p()!.allowComments) { <button class="mini" (click)="replyTo = c.id">Reply</button> }
                      @if (c.authorId === me()) { <button class="mini danger" (click)="removeComment(c)">Delete</button> }
                    </div>

                    @for (r of repliesOf(c.id); track r.id) {
                      <div class="reply">
                        <lf-avatar [src]="data.avatarFor(data.authorOf(r.authorId))" [name]="data.authorOf(r.authorId)?.displayName ?? ''" [size]="26" />
                        <div>
                          <div class="lf-meta"><strong>{{ data.authorOf(r.authorId)?.displayName }}</strong> · {{ timeAgo(r.createdAt) }}</div>
                          <p class="lf-prose">{{ r.body }}</p>
                        </div>
                      </div>
                    }

                    @if (replyTo === c.id) {
                      <div class="composer replybox">
                        <ion-textarea rows="1" autoGrow placeholder="Reply…" [value]="replyDraft"
                                      (ionInput)="replyDraft = $any($event.target).value"></ion-textarea>
                        <button class="lf-icon-btn send" (click)="postComment(c.id)"><lf-icon name="send" [size]="16" /></button>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <p class="lf-fab-note">
            LulaFind is a community tool. It does not replace SAPS. In an emergency call <strong>10111</strong>.
          </p>
        </article>
      }
    </ion-content>

    @if (foundOpen()) {
      <div class="sheetwrap" (click)="closeFound()">
        <div class="sheet" (click)="$event.stopPropagation()">
          <div class="lf-row-between">
            <h3 class="lf-h2">Mark as found</h3>
            <button class="lf-icon-btn" (click)="closeFound()" aria-label="Close"><lf-icon name="x" [size]="20" /></button>
          </div>
          <p class="lf-small lf-muted">This closes the case. Name the person who found them so they get a contributor badge.</p>
          <label class="k">Where were they found?</label>
          <input class="fld" [value]="foundWhere" placeholder="e.g. Safe at home in Soweto"
                 (input)="foundWhere = $any($event.target).value" />
          <label class="k">Who found them?</label>
          <input class="fld" [value]="finderQuery()" placeholder="Type their name"
                 (input)="onFinder($any($event.target).value)" />
          @if (finderQuery().trim().length >= 2 && !finderHits().length && !finderBusy()) {
            <p class="lf-small lf-muted">No member with that name. Try the other spelling, or close without a name.</p>
          }
          <div class="hits">
            @for (u of finderHits(); track u.id) {
              <button type="button" class="hit" [class.on]="finderId() === u.id" (click)="pickFinder(u)">
                <lf-avatar [src]="data.avatarFor(u)" [name]="u.displayName" [size]="36" />
                <span>
                  <strong>{{ u.displayName }}</strong>
                  <small>&#64;{{ u.handle }}@if (u.privacy && u.privacy.showLocation === true && u.town) { · {{ u.town }} }</small>
                </span>
              </button>
            }
          </div>
          <button class="lf-btn lf-btn--success lf-btn--block" [disabled]="foundBusy() || !finderId()" (click)="confirmFound()">
            {{ foundBusy() ? 'Saving…' : 'They are found' }}
          </button>
          <button class="textbtn" type="button" [disabled]="foundBusy()" (click)="confirmFound(true)">Close without naming a member</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .detail { padding-bottom: 30px; }
    .author { padding: 14px; }
    .author .lf-icon { color: var(--lf-beacon); }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
    .lnk { color: var(--lf-beacon); text-decoration: none; }
    .lnk.strong { font-weight: 700; }
    .title { margin: 0 0 10px; }
    .body { margin: 0; }
    .facts { margin: 16px 0 0; padding: 14px; border-radius: 12px; background: var(--lf-card-2); }
    .contact { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 11px 13px;
      border-radius: 12px; border: 1px dashed var(--lf-line); }
    .contact div { display: flex; flex-direction: column; }
    .media { padding: 8px 0 0; gap: 8px; border-top: 1px solid var(--lf-line); }
    .mediacount { padding: 0 16px; margin: 0; }
    .media figure { margin: 0; width: 86%; }
    .media figcaption { font-size: 11.5px; color: var(--lf-muted); padding: 6px 10px 0; }
    .verified { display: flex; align-items: flex-start; gap: 10px; margin: 0 16px 12px; padding: 12px 13px;
      border-radius: 12px; background: color-mix(in srgb, var(--lf-ubuntu) 14%, transparent);
      border: 1px solid color-mix(in srgb, var(--lf-ubuntu) 40%, transparent); }
    .verified lf-icon { color: var(--lf-ubuntu); margin-top: 2px; }
    .verified span { display: block; color: var(--lf-muted); }
    .focus { display: flex; align-items: center; gap: 10px; margin: 0 16px 12px; padding: 12px;
      border-radius: 14px; background: var(--lf-card); border: 1px solid var(--lf-line); }
    .focus strong, .focus span { display: block; }
    .focus[data-ring="green"] { border-color: color-mix(in srgb, var(--lf-ubuntu) 45%, transparent); }
    .focus[data-ring="amber"] { border-color: color-mix(in srgb, var(--lf-marigold) 50%, transparent); }
    .focus[data-ring="red"] { border-color: color-mix(in srgb, var(--lf-signal) 45%, transparent); }
    .party { margin: 0 16px 12px; padding: 13px; border-radius: 14px; background: var(--lf-card);
      border: 1px solid var(--lf-line); display: flex; flex-direction: column; gap: 9px; }
    .party h3 { display: flex; align-items: center; gap: 7px; margin: 0; }
    .zone { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 10px;
      background: var(--lf-card-2); border: 1px solid transparent; }
    .zone strong { display: block; font-size: 13.5px; }
    .zone span { display: block; }
    .zone.taken { opacity: .7; }
    .zone.done { border-color: color-mix(in srgb, var(--lf-ubuntu) 45%, transparent); }
    .zone.done strong { text-decoration: line-through; opacity: .75; }
    .counters { display: flex; gap: 14px; flex-wrap: wrap; padding: 10px 16px; font-size: 12px; color: var(--lf-muted);
      border-top: 1px solid var(--lf-line); }
    .counters span { display: inline-flex; align-items: center; gap: 5px; }
    .khumbu { border-color: color-mix(in srgb, var(--lf-marigold) 45%, var(--lf-line)); }
    .wanted { margin-top: 12px; padding: 12px; border-radius: 12px; background: var(--lf-card-2);
      display: flex; flex-direction: column; gap: 4px; }
    .claim { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 12px;
      border-radius: 12px; border: 1px solid var(--lf-beacon); background: color-mix(in srgb, var(--lf-beacon) 10%, transparent); }
    .claim div { display: flex; flex-direction: column; gap: 2px; }
    .respond { margin-top: 12px; padding: 12px; border-radius: 12px; background: var(--lf-card-2); }
    .answered { display: flex; gap: 10px; margin-top: 12px; padding: 12px; border-radius: 12px;
      background: color-mix(in srgb, var(--lf-marigold) 16%, transparent); }
    .answered.ok { background: color-mix(in srgb, var(--lf-ubuntu) 16%, transparent); }
    .answered p { margin: 4px 0 0; font-style: italic; }
    .partners { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
    .partner { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 11px; background: var(--lf-card-2); }
    .partner div { display: flex; flex-direction: column; }
    .lf-col { display: flex; flex-direction: column; gap: 6px; }
    .steps { list-style: none; padding: 0; margin: 10px 0 12px; display: flex; flex-direction: column; gap: 6px;
      font-size: 13px; color: var(--lf-muted); }
    .steps li { display: flex; align-items: center; gap: 9px; }
    .steps span { width: 20px; height: 20px; border-radius: 50%; background: var(--lf-card-2); display: flex;
      align-items: center; justify-content: center; font-size: 11px; font-weight: 800; }
    .steps.done1 li:nth-child(1), .steps.done2 li:nth-child(2), .steps.done3 li:nth-child(3) { color: var(--lf-ubuntu); }
    .steps.done1 li:nth-child(1) span, .steps.done2 li:nth-child(2) span, .steps.done3 li:nth-child(3) span {
      background: var(--lf-ubuntu); color: #fff; }
    .composer { display: flex; align-items: flex-end; gap: 8px; margin-top: 12px; }
    .composer ion-textarea { flex: 1; --background: var(--lf-card-2); border-radius: 12px; --padding-start: 12px; }
    .send { background: var(--lf-beacon); color: #1a1200; width: 40px; height: 40px; }
    .send[disabled] { opacity: .4; }
    .leadcheck { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--lf-muted); margin-top: 8px; }
    .leadcheck input { accent-color: var(--lf-ubuntu); width: 17px; height: 17px; }
    .comment { display: flex; gap: 10px; padding: 14px 0; border-top: 1px solid var(--lf-line); margin-top: 12px; }
    .comment .lf-prose { margin: 4px 0 0; font-size: 14px; }
    .mark { width: 100%; margin: 6px 0 0 42px; box-sizing: border-box; padding: 8px 10px; border-radius: 10px;
      border: 1px solid var(--lf-line); background: var(--lf-card); color: inherit; font: inherit; }
    .sighting { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; font-size: 12px;
      padding: 6px 9px; border-radius: 9px; background: color-mix(in srgb, var(--lf-ubuntu) 14%, transparent); }
    .mini { background: none; border: 0; color: var(--lf-muted); font-size: 12px; font-weight: 700;
      display: inline-flex; align-items: center; gap: 5px; cursor: pointer; padding: 0; }
    .mini.danger { color: var(--lf-signal); }
    .reply { display: flex; gap: 8px; margin-top: 10px; padding-left: 8px; border-left: 2px solid var(--lf-line); }
    .reply .lf-prose { font-size: 13.5px; }
    .replybox { margin-top: 8px; }
    .sheetwrap { position: fixed; inset: 0; z-index: 40; background: rgba(4, 8, 20, .72);
      display: flex; align-items: flex-end; justify-content: center; }
    .sheet { width: 100%; max-width: 520px; max-height: 88vh; overflow-y: auto; background: var(--lf-card);
      border-radius: 18px 18px 0 0; padding: 18px 18px 28px; display: flex; flex-direction: column; gap: 8px; }
    .sheet p { margin: 0; line-height: 1.45; }
    .k { font-size: 12px; font-weight: 800; color: var(--lf-muted); }
    .fld { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid var(--lf-line);
      background: var(--lf-card-2); color: inherit; font: inherit; padding: 12px; }
    .hits { display: flex; flex-direction: column; gap: 6px; max-height: 240px; overflow-y: auto; }
    .hit { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 12px; border: 1px solid var(--lf-line);
      background: transparent; color: inherit; text-align: left; cursor: pointer; }
    .hit.on { border-color: var(--lf-beacon); background: color-mix(in srgb, var(--lf-beacon) 14%, transparent); }
    .hit span { display: flex; flex-direction: column; gap: 1px; }
    .hit small { color: var(--lf-muted); font-size: 12px; }
    .textbtn { background: none; border: 0; color: var(--lf-muted); font-size: 13px; font-weight: 700;
      text-decoration: underline; cursor: pointer; padding: 6px; }
    .textbtn:disabled { opacity: .5; }
  `]
})
export class PostDetailComponent implements OnInit {
  protected data = inject(DataService);
  protected auth = inject(AuthService);
  protected readonly contactNote = escalationNote;
  protected readonly leadMark = leadMarkView;

  /** The poster or an admin can run the search party. */
  readonly canEditPost = computed(() => (this.p() ? this.data.canEdit(this.p()!) : false));

  focus() {
    const post = this.p();
    return post ? searchFocus(post) : null;
  }

  looking(): boolean {
    const me = this.auth.viewerId;
    const ids = this.p()?.lookingIds ?? [];
    return !!me && ids.includes(me);
  }

  lookCount(): number {
    return this.p()?.lookingIds?.length ?? 0;
  }

  async toggleLooking(): Promise<void> {
    const id = this.p()?.id;
    if (!id) return;
    if (!this.auth.signedIn()) {
      void this.router.navigate(['/auth'], { queryParams: { next: '/post/' + id } });
      return;
    }
    try {
      await this.data.markLooking(id);
      await this.reload();
    } catch (e: any) {
      await this.say(e?.message ?? 'Could not save that');
    }
  }

  sourceLabel(src: string): string {
    return { cctv: 'CCTV footage', police: 'a police statement', records: 'official records', photo: 'a dated photo' }[src] ?? 'an official source';
  }

  async claimZone(zoneId: string): Promise<void> {
    const id = this.p()?.id;
    if (!id) return;
    try {
      await this.data.claimSearchZone(id, zoneId);
      await this.reload();
    } catch (e: any) {
      await this.say(e?.message ?? 'Could not update the search');
    }
  }

  async completeZone(zoneId: string): Promise<void> {
    const id = this.p()?.id;
    if (!id) return;
    try {
      await this.data.completeSearchZone(id, zoneId);
      await this.reload();
    } catch (e: any) {
      await this.say(e?.message ?? 'Could not update the search');
    }
  }

  /** Ask for a meeting point and the areas to cover, then open the search. */
  async openParty(): Promise<void> {
    const alert = await this.alert.create({
      header: 'Start a ground search',
      message: 'Tell people where to meet and which areas to cover. Volunteers claim an area so nobody searches the same street twice.',
      inputs: [
        { name: 'meetAt', type: 'text', placeholder: 'Meeting point, e.g. Orlando East police station' },
        { name: 'zones', type: 'text', placeholder: 'Areas, separated by commas' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Open search',
          handler: async (v: any) => {
            const meetAt = String(v?.meetAt ?? '').trim();
            if (!meetAt) { await this.say('Add a meeting point so people know where to go.'); return false; }
            const zones = String(v?.zones ?? '').split(',').map((x) => x.trim()).filter(Boolean);
            if (!zones.length) { await this.say('Add at least one area to cover.'); return false; }
            try {
              await this.data.openSearchParty(this.p()!.id, meetAt, Date.now() + 2 * 3600_000, zones);
              await this.reload();
              await this.say('Ground search opened. Share it so people can claim an area.');
            } catch (e: any) {
              await this.say(e?.message ?? 'Could not open the search');
            }
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async reload(): Promise<void> {
    const id = this.p()?.id;
    if (!id) return;
    this.p.set((await this.data.loadPost(id)) ?? null);
  }
  private chat = inject(ChatService);
  private escalation = inject(EscalationService);
  private platform = inject(PlatformService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastController);
  private alert = inject(AlertController);
  private sheet = inject(ActionSheetController);
  private mod = inject(ModerationService);

  protected readonly compact = compact;
  protected readonly timeAgo = timeAgo;
  protected readonly dayMonth = dayMonth;
  protected readonly fullDate = fullDate;
  protected readonly urgency = urgency;
  protected readonly provinceName = provinceName;
  protected readonly POST_TYPE_META = POST_TYPE_META;
  protected readonly dangerLabel = dangerLabel;

  p = signal<Post | null>(null);
  comments = signal<Comment[]>([]);
  gate = signal<ChatGate>({ allowed: true, reason: 'open' });
  following = signal(false);
  followRequested = signal(false);
  saved = signal(false);
  draft = '';
  replyDraft = '';
  replyTo: string | null = null;
  asLead = false;
  markGuess = '';
  khumbuNote = '';

  readonly me = computed(() => this.auth.viewerId);
  readonly isMine = computed(() => this.p()?.authorId === this.auth.viewerId);
  readonly author = computed(() => (this.p() ? this.data.authorOf(this.p()!.authorId) ?? null : null));
  readonly authorName = computed(() =>
    this.p()?.anonymous && !this.isMine() ? 'Anonymous' : this.author()?.displayName ?? 'LulaFind member'
  );
  readonly authorAvatar = computed(() => this.data.avatarFor(this.p()?.anonymous && !this.isMine() ? null : this.author()));
  readonly myAvatar = computed(() => this.data.avatarFor(this.auth.user()));
  readonly myVote = computed(() => (this.p() ? this.data.myVote(this.p()!) : null));

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    const cached = this.data.post(id);
    if (cached) this.p.set(cached);
    const fresh = await this.data.loadPost(id);
    if (fresh) {
      this.p.set(fresh);
      await this.data.registerView(id);
    }
    this.comments.set(await this.data.comments(id));
    await this.refreshGate();
    const followState = this.p() ? await this.data.followStatus(this.p()!.authorId) : null;
    this.following.set(followState === 'accepted');
    this.followRequested.set(followState === 'pending');
    this.saved.set(this.data.savedIds().includes(id));
  }

  private async refreshGate(): Promise<void> {
    const p = this.p();
    if (!p) return;
    this.gate.set(await this.chat.gate(p, p.khumbu?.claimedByUserId === this.auth.viewerId));
  }

  dangerMine(): 'still' | 'clear' | null {
    const me = this.auth.viewerId;
    const d = this.p()?.danger;
    if (!me || !d) return null;
    if (d.stillIds.includes(me)) return 'still';
    if (d.clearIds.includes(me)) return 'clear';
    return null;
  }

  async markDanger(still: boolean): Promise<void> {
    const p = this.p();
    if (!p) return;
    if (!this.auth.signedIn()) {
      await this.say('Sign in to tell others what you see.');
      return;
    }
    try {
      const next = await this.data.respondDanger(p.id, still);
      if (next) this.p.set(next);
      await this.say(still ? 'Marked as still happening.' : 'Marked as clear.');
    } catch (e: any) {
      await this.say(e?.message ?? 'Could not save that');
    }
  }

  statusLabel(): string {
    const p = this.p();
    if (!p) return '';
    if (p.status === 'found') return 'FOUND';
    if (p.status === 'not_going_home') return 'Answered - safe, not coming home';
    if (p.status === 'under_review') return 'Under review by moderators';
    return POST_TYPE_META[p.type].label;
  }

  audienceLabel(): string {
    const a = this.p()?.audience;
    return a === 'followers' ? 'Followers only' : a === 'surname' ? 'Spotlight only' : 'Public';
  }

  audienceIcon(): string {
    const a = this.p()?.audience;
    return a === 'public' ? 'globe' : 'lock';
  }

  roleLine(): string {
    const rel = this.p()?.subject?.relationship;
    if (this.p()?.anonymous && !this.isMine()) return 'Posted anonymously';
    const author = this.author();
    return rel ? `Reports as: ${rel}` : author?.privacy?.showLocation === true ? author.town : '';
  }

  showContact(): boolean {
    const p = this.p();
    if (!p) return false;
    if (p.contactVisibleTo === 'everyone') return true;
    if (p.contactVisibleTo === 'owner') return this.isMine();
    return this.isMine() || this.author()?.verified === true;
  }

  contactText(): string {
    const p = this.p();
    if (!p) return '';
    return this.showContact() ? p.contactValue : 'Hidden - upvote and follow the poster to get contact details';
  }

  async copyContact(): Promise<void> {
    await this.platform.copy(this.p()?.contactValue ?? '');
    await this.say('Contact copied');
  }

  async vote(v: 'up' | 'down'): Promise<void> {
    if (!this.auth.signedIn()) return this.needAuth();
    const p = this.p();
    if (!p) return;
    await this.data.vote(p.id, v);
    this.p.set(this.data.post(p.id) ?? null);
    await this.refreshGate();
  }

  async toggleFollow(): Promise<void> {
    if (!this.auth.signedIn()) return this.needAuth();
    const p = this.p();
    if (!p) return;
    await this.data.toggleFollow(p.authorId);
    const state = await this.data.followStatus(p.authorId);
    this.following.set(state === 'accepted');
    this.followRequested.set(state === 'pending');
    await this.refreshGate();
  }

  async save(): Promise<void> {
    const p = this.p();
    if (!p) return;
    this.saved.set(await this.data.toggleSaved(p.id));
    await this.say(this.saved() ? 'Added to your watchlist' : 'Removed from watchlist');
  }

  async share(): Promise<void> {
    const p = this.p();
    if (!p) return;
    await this.platform.share(p.title, `${p.title}\n\n${p.body.slice(0, 220)}\n\nShared from LulaFind`, this.platform.link(`/post/${p.id}`));
    await this.data.recordShare(p.id);
    this.p.set(this.data.post(p.id) ?? null);
  }

  async more(): Promise<void> {
    const p = this.p();
    if (!p) return;
    const canEdit = this.data.canEdit(p);
    const spotlightName = p.spotlightId
      ? this.data.spotlights().find((s) => s.id === p.spotlightId)?.surname
      : null;
    const sheet = await this.sheet.create({
      header: 'Post options',
      buttons: [
        { text: 'Copy link', handler: async () => { await this.platform.copy(this.platform.link(`/post/${p.id}`)); await this.say('Link copied'); } },
        // only shown when this post really belongs to a community
        ...(spotlightName
          ? [{ text: `Open the ${spotlightName} community`, handler: () => void this.router.navigate(['/spotlight', p.spotlightId]) }]
          : []),
        { text: 'Read the 72-hour checklist', handler: () => void this.router.navigate(['/tips']) },
        ...(canEdit
          ? [
              { text: 'Edit post', handler: () => void this.router.navigate(['/post', p.id, 'edit']) },
              { text: 'Delete post', role: 'destructive' as const, handler: async () => { await this.data.deletePost(p.id); await this.router.navigate(['/home']); } }
            ]
          : [{ text: 'Report this post', role: 'destructive' as const, handler: () => this.report() }]),
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await sheet.present();
  }

  /** Report the post - the person picks a reason, an admin works the queue. */
  async report(): Promise<void> {
    const p = this.p();
    if (!p) return;
    if (!this.auth.signedIn()) return this.needAuth();
    const pick = await this.alert.create({
      header: 'Report this post',
      message: 'Tell us what is wrong. A LulaFind admin reviews every report.',
      inputs: this.mod.reasons.map((r) => ({ name: 'reason', type: 'radio' as const, label: r.label, value: r.id })),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Send report',
          handler: async (v: any) => {
            try {
              await this.mod.report({ target: 'post', targetId: p.id, summary: p.title, reason: v?.reason ?? 'other' });
              await this.say('Report sent. Thank you - an admin will look at it.');
            } catch (e: any) {
              await this.say(e?.message ?? 'Could not send the report');
            }
          }
        }
      ]
    });
    await pick.present();
  }

  /* ---------------------- comments ---------------------- */
  repliesOf(parentId: string): Comment[] {
    return this.comments().filter((c) => c.parentId === parentId);
  }

  async postComment(parentId: string | null): Promise<void> {
    if (!this.auth.signedIn()) return this.needAuth();
    const body = parentId ? this.replyDraft.trim() : this.draft.trim();
    if (!body) return;
    const p = this.p();
    if (!p) return;
    const mark = this.asLead && !parentId ? this.markGuess.trim() : '';
    await this.data.addComment({
      postId: p.id,
      body,
      parentId,
      isLead: this.asLead && !parentId,
      markGuess: mark || undefined
    });
    this.comments.set(await this.data.comments(p.id));
    this.p.set(this.data.post(p.id) ?? null);
    this.draft = '';
    this.replyDraft = '';
    this.replyTo = null;
    this.asLead = false;
    this.markGuess = '';
  }

  async checkMark(c: Comment, result: 'match' | 'no'): Promise<void> {
    try {
      await this.data.checkLeadMark(c, result);
      const p = this.p();
      if (p) this.comments.set(await this.data.comments(p.id));
    } catch (e: unknown) {
      await this.say(e instanceof Error ? e.message : 'Could not check the mark');
    }
  }

  async upComment(c: Comment): Promise<void> {
    if (!this.auth.signedIn()) return this.needAuth();
    await this.data.voteComment(c);
    const p = this.p();
    if (p) this.comments.set(await this.data.comments(p.id));
  }

  async removeComment(c: Comment): Promise<void> {
    const p = this.p();
    if (!p) return;
    await this.data.deleteComment(c);
    this.comments.set(await this.data.comments(p.id));
    this.p.set(this.data.post(p.id) ?? null);
  }

  focusComment(): void {
    document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------------- khumbu ------------------------ */
  canClaim(): boolean {
    const p = this.p();
    const me = this.me();
    if (!p || !me || p.authorId === me) return false;
    if (p.khumbu?.claimedByUserId) return false;
    if (this.openAnswer()) return false;
    if (p.type === 'khumbulekhaya') return true;
    if (p.type === 'missing') return p.subject?.age == null || p.subject.age >= 18;
    return false;
  }

  childCase(): boolean {
    const p = this.p();
    const age = p?.subject?.age;
    return p?.type === 'missing' && age != null && age < 18;
  }

  showSubjectCard(): boolean {
    const p = this.p();
    if (!p || p.type !== 'missing') return false;
    if (this.childCase()) return true;
    return this.canClaim() || this.waitingAnswer() || this.openAnswer();
  }

  waitingAnswer(): boolean {
    const k = this.p()?.khumbu;
    return !!k && k.claimedByUserId === this.me() && (!k.subjectResponse || k.subjectResponse === 'none');
  }

  openAnswer(): boolean {
    const r = this.p()?.khumbu?.subjectResponse;
    return !!r && r !== 'none';
  }

  async claim(): Promise<void> {
    if (!this.auth.signedIn()) return this.needAuth();
    const p = this.p();
    if (!p) return;
    const a = await this.alert.create({
      header: 'Is this you?',
      message: 'Only the person who posted this will see that you claimed it. You can still choose not to go home - nobody will be forced.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Yes, this is me',
          handler: async () => {
            const next = await this.data.claimKhumbuPost(p.id);
            if (next) this.p.set(next);
            await this.refreshGate();
          }
        }
      ]
    });
    await a.present();
  }

  async respond(response: 'going_home' | 'not_going_home' | 'contact_me'): Promise<void> {
    const p = this.p();
    if (!p) return;
    const next = await this.data.subjectRespond(p.id, response, this.khumbuNote);
    if (next) this.p.set(next);
    await this.say(response === 'not_going_home' ? 'Your family has been told you are safe.' : 'Your family has been notified.');
    if (response === 'contact_me' && p.authorId) {
      const thread = await this.chat.ensureThread(p, p.authorId, 'vote');
      if (thread) await this.router.navigate(['/chat', thread.id]);
    }
  }

  responseLabel(): string {
    switch (this.p()?.khumbu?.subjectResponse) {
      case 'going_home': return 'They are coming home.';
      case 'not_going_home': return 'They are safe but not coming home. Please respect this.';
      case 'contact_me': return 'They want to chat first.';
      default: return '';
    }
  }

  async wanted(answer: boolean): Promise<void> {
    if (!this.auth.signedIn()) return this.needAuth();
    const p = this.p();
    if (!p) return;
    const next = await this.data.answerWanted(p.id, answer);
    if (next) this.p.set(next);
  }

  /* ---------------------- outcome ----------------------- */
  foundOpen = signal(false);
  foundBusy = signal(false);
  finderBusy = signal(false);
  finderQuery = signal('');
  finderHits = signal<UserProfile[]>([]);
  finderId = signal<string | null>(null);
  foundWhere = '';
  private finderSeq = 0;

  markFound(): void {
    if (!this.p()) return;
    this.foundWhere = '';
    this.finderQuery.set('');
    this.finderHits.set([]);
    this.finderId.set(null);
    this.foundOpen.set(true);
  }

  closeFound(): void {
    if (this.foundBusy()) return;
    this.foundOpen.set(false);
  }

  async onFinder(value: string): Promise<void> {
    const selected = this.finderHits().find((u) => u.id === this.finderId());
    if (selected && value === selected.displayName) return;
    this.finderQuery.set(value);
    this.finderId.set(null);
    const q = value.trim();
    if (q.length < 2) { this.finderHits.set([]); return; }
    const seq = ++this.finderSeq;
    this.finderBusy.set(true);
    try {
      const hits = await this.data.usersWithName(q);
      if (seq === this.finderSeq) this.finderHits.set(hits);
    } finally {
      if (seq === this.finderSeq) this.finderBusy.set(false);
    }
  }

  pickFinder(u: UserProfile): void {
    this.finderId.set(u.id);
    this.finderQuery.set(u.displayName);
  }

  async confirmFound(skipName = false): Promise<void> {
    const p = this.p();
    if (!p || this.foundBusy()) return;
    if (!skipName && !this.finderId()) return;
    this.foundBusy.set(true);
    try {
      const next = await this.data.markFound(p.id, {
        whereabouts: this.foundWhere.trim() || 'Safe',
        finderUserId: skipName ? null : this.finderId()
      });
      if (next) this.p.set(next);
      this.foundOpen.set(false);
      await this.say(skipName ? 'Case closed as found.' : 'Thank you. They have a contributor badge.');
    } catch (e: any) {
      await this.say(e?.message ?? 'Could not close the case');
    } finally {
      this.foundBusy.set(false);
    }
  }

  async stillSearching(): Promise<void> {
    const p = this.p();
    if (!p) return;
    await this.data.dismissOutcomeNudge(p.id);
    this.p.set(this.data.post(p.id) ?? null);
    await this.say('Kept open. We will ask again later.');
  }

  /* ---------------------- chat -------------------------- */
  gateReason(): string {
    const g = this.gate();
    if (!g || g.allowed) return '';
    if (g.step === 'sign_in') return 'Sign in to chat.';
    if (g.step === 'disabled') return g.reason;
    return g.reason;
  }

  stepDone(n: number): boolean {
    const p = this.p();
    if (!p) return false;
    if (n === 1) return (p.voterIds[this.me() ?? ''] ?? null) === 'up' || p.authorId === this.me();
    if (n === 2) return this.following();
    return this.gate().allowed;
  }

  nextChatAction(): string {
    const g = this.gate();
    if (!g || g.allowed) return 'Open private chat';
    if (g.step === 'sign_in') return 'Sign in';
    if (g.step === 'vote') return 'Upvote to unlock chat';
    if (g.step === 'follow') return 'Follow to unlock chat';
    return 'Chat unavailable';
  }

  async openChat(): Promise<void> {
    if (!this.auth.signedIn()) return this.needAuth();
    const p = this.p();
    if (!p) return;
    const g = await this.chat.gate(p, p.khumbu?.claimedByUserId === this.auth.viewerId);
    if (g.allowed) {
      const thread = await this.chat.ensureThread(p, p.authorId, 'vote');
      if (thread) await this.router.navigate(['/chat', thread.id]);
      return;
    }
    if (g.step === 'vote') {
      await this.data.vote(p.id, 'up');
      this.p.set(this.data.post(p.id) ?? null);
      await this.refreshGate();
      await this.say('Upvoted. Now follow them to open chat.');
      return;
    }
    if (g.step === 'follow') {
      await this.data.toggleFollow(p.authorId);
      const state = await this.data.followStatus(p.authorId);
      this.following.set(state === 'accepted');
      this.followRequested.set(state === 'pending');
      await this.refreshGate();
      await this.say(state === 'pending'
        ? 'Follow request sent. Chat opens after they accept and follow you back.'
        : 'Following. Chat opens when they follow you back.');
      return;
    }
    await this.say((g as any).reason ?? 'Chat unavailable');
  }

  private needAuth(): void {
    void this.router.navigate(['/auth'], { queryParams: { next: this.router.url } });
  }

  private async say(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }
}
