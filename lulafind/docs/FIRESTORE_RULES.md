# Firestore security rules for LulaFind

Copy into **Firebase console → Firestore → Rules**. They encode the product rules
in the app: only the author can edit a case, escalation consent is author-only,
private threads are readable only by their two participants, and nobody can write
another person's location.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }
    function isSelf(uid) {
      return signedIn() && request.auth.uid == uid;
    }
    function isAuthor(postId) {
      return signedIn() && get(/databases/$(database)/documents/posts/$(postId)).data.authorId == request.auth.uid;
    }

    /* ---------------- users ---------------- */
    match /users/{uid} {
      allow read: if true;                     // profiles are public
      allow create: if isSelf(uid);
      allow update: if isSelf(uid)
        && request.resource.data.karma == resource.data.karma   // karma is server-set
        && request.resource.data.followers == resource.data.followers;
      allow delete: if isSelf(uid);            // store-required account deletion
    }

    /* ---------------- posts ---------------- */
    match /posts/{postId} {
      allow read: if true;
      allow create: if signedIn()
        && request.resource.data.authorId == request.auth.uid
        && request.resource.data.upvotes == 0
        && request.resource.data.downvotes == 0;

      // Anyone signed in may vote, comment-count and share-count may move.
      // Only the author may change consent, escalation, outcome or audience.
      allow update: if signedIn() && (
        isAuthor(postId) ||
        (
          request.resource.data.authorId == resource.data.authorId
          && request.resource.data.escalation == resource.data.escalation
          && request.resource.data.consent == resource.data.consent
          && request.resource.data.locationCheck == resource.data.locationCheck
          && request.resource.data.outcome == resource.data.outcome
          && request.resource.data.audience == resource.data.audience
          && request.resource.data.anonymous == resource.data.anonymous
        )
      );

      allow delete: if isAuthor(postId);

      match /comments/{commentId} {
        allow read: if true;
        allow create: if signedIn() && request.resource.data.authorId == request.auth.uid;
        allow update: if signedIn();          // upvote counter
        allow delete: if signedIn() && (
          request.auth.uid == resource.data.authorId || isAuthor(postId)
        );
      }
    }

    /* ---------------- spotlights ---------------- */
    match /spotlights/{spotlightId} {
      allow read: if true;
      allow create: if signedIn() && request.resource.data.ownerId == request.auth.uid;
      allow update: if signedIn() && (
        request.auth.uid in resource.data.adminIds ||
        request.resource.data.memberIds.hasAll(resource.data.memberIds)  // joining
      );
      allow delete: if signedIn() && request.auth.uid == resource.data.ownerId;
    }

    /* ---------------- stories ---------------- */
    match /stories/{storyId} {
      allow read: if true;
      allow create: if signedIn() && request.resource.data.authorId == request.auth.uid;
      allow update: if signedIn();            // viewers + replies
      allow delete: if signedIn() && request.auth.uid == resource.data.authorId;
    }

    /* ---------------- chat ---------------- */
    match /threads/{threadId} {
      allow read, update: if signedIn() && request.auth.uid in resource.data.participantIds;
      allow create: if signedIn() && request.auth.uid in request.resource.data.participantIds;

      match /messages/{messageId} {
        allow read: if signedIn()
          && request.auth.uid in get(/databases/$(database)/documents/threads/$(threadId)).data.participantIds;
        allow create: if signedIn() && (
          request.resource.data.fromUserId == request.auth.uid ||
          request.resource.data.fromUserId == 'system'
        );
        allow update, delete: if false;        // messages are append-only
      }
    }

    /* ---------------- follows ---------------- */
    match /follows/{edgeId} {
      allow read: if true;
      allow create, delete: if signedIn() && request.auth.uid == resource.data.followerId;
    }

    /* ---------------- notifications ---------------- */
    match /notifications/{userId}/items/{itemId} {
      allow read, update: if isSelf(userId);
      allow create: if signedIn();             // written by Cloud Functions in production
      allow delete: if isSelf(userId);
    }

    /* ---------------- tips (read-only content) ---------------- */
    match /tips/{tipId} {
      allow read: if true;
      allow write: if false;                   // manage from the console / CI
    }
  }
}
```

## Indexes

Create composite indexes for the feed queries:

| Collection | Fields | Order |
| --- | --- | --- |
| `posts` | `status` ASC, `updatedAt` DESC | feed default |
| `posts` | `type` ASC, `province` ASC, `updatedAt` DESC | filtered feed |
| `posts` | `spotlightId` ASC, `updatedAt` DESC | spotlight pages |
| `posts/{postId}/comments` | `postId` ASC, `createdAt` DESC | comment list |
| `threads/{threadId}/messages` | `at` ASC | chat |
| `notifications/{userId}/items` | `at` DESC | alerts |

## Storage

Store user photos in Firebase Storage under `media/{uid}/{file}` with rules that
allow `read: if true` and `write: if request.auth.uid == uid`. Never store a
subject's location as media.
