import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/tabs/tabs.component').then((m) => m.TabsComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      { path: 'home', loadComponent: () => import('./pages/tabs/home.component').then((m) => m.HomeComponent) },
      { path: 'spotlight', loadComponent: () => import('./pages/tabs/spotlight.component').then((m) => m.SpotlightComponent) },
      { path: 'create', redirectTo: '/new', pathMatch: 'full' },
      { path: 'chats', loadComponent: () => import('./pages/tabs/chats.component').then((m) => m.ChatsComponent) },
      { path: 'me', loadComponent: () => import('./pages/tabs/me.component').then((m) => m.MeComponent) }
    ]
  },
  { path: 'auth', loadComponent: () => import('./pages/auth/auth.component').then((m) => m.AuthComponent) },
  { path: 'auth/confirm', loadComponent: () => import('./pages/auth/auth.component').then((m) => m.AuthComponent) },
  {
    path: 'new',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/post/create-post.component').then((m) => m.CreatePostComponent)
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/onboarding/onboarding.component').then((m) => m.OnboardingComponent)
  },
  { path: 'post/:id/poster', loadComponent: () => import('./pages/post/poster.component').then((m) => m.PosterComponent) },
  { path: 'post/:id', loadComponent: () => import('./pages/post/post-detail.component').then((m) => m.PostDetailComponent) },
  {
    path: 'post/:id/edit',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/post/create-post.component').then((m) => m.CreatePostComponent)
  },
  { path: 'user/:id', loadComponent: () => import('./pages/user/profile.component').then((m) => m.ProfileComponent) },
  { path: 'spotlight/:id', loadComponent: () => import('./pages/spotlight/spotlight-detail.component').then((m) => m.SpotlightDetailComponent) },
  { path: 'story/:id', loadComponent: () => import('./pages/story/story-viewer.component').then((m) => m.StoryViewerComponent) },
  { path: 'search', loadComponent: () => import('./pages/search/search.component').then((m) => m.SearchComponent) },
  { path: 'notifications', canActivate: [authGuard], loadComponent: () => import('./pages/notifications/notifications.component').then((m) => m.NotificationsComponent) },
  { path: 'tips', loadComponent: () => import('./pages/tips/tips.component').then((m) => m.TipsComponent) },
  { path: 'help', loadComponent: () => import('./pages/help/help.component').then((m) => m.HelpComponent) },
  {
    path: 'create/:type',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/post/create-post.component').then((m) => m.CreatePostComponent)
  },
  {
    path: 'create-story',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/story/create-story.component').then((m) => m.CreateStoryComponent)
  },
  {
    path: 'chat/:threadId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/chat/chat-room.component').then((m) => m.ChatRoomComponent)
  },
  { path: 'safety', loadComponent: () => import('./pages/safety/safety-center.component').then((m) => m.SafetyCenterComponent) },
  {
    path: 'escalate/:postId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/safety/escalate.component').then((m) => m.EscalateComponent)
  },
  {
    path: 'location-check/:postId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/safety/location-check.component').then((m) => m.LocationCheckComponent)
  },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then((m) => m.SettingsComponent) },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin.component').then((m) => m.AdminComponent)
  },
  { path: 'terms', loadComponent: () => import('./pages/terms/terms.component').then((m) => m.TermsComponent) },
  { path: '**', redirectTo: '' }
];
