# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **PII Isolation**: User email addresses and `blockedUids` reside exclusively in `/usersPrivate/{userId}` and can only be read or modified by `request.auth.uid == userId`.
2. **Identity Integrity**: Every created `UserPublic`, `UserPrivate`, `Message`, `DmMessage`, `Reaction`, `DmReaction`, `Notification`, `Server`, `Invite`, and `Friendship` enforces `authorId`/`ownerId`/`senderId`/`requesterId` == `request.auth.uid`.
3. **Master Gate Membership**: Subcollections under `/servers/{serverId}/` (`members`, `categories`, `channels`, `messages`, `reactions`) require verified membership in `/servers/{serverId}/members/{request.auth.uid}`.
4. **Immutable Ownership & Timestamps**: `createdAt`, `ownerId`, `authorId`, `serverId`, `channelId`, and `threadId` cannot be reassigned after creation; `createdAt == request.time` on create and `updatedAt == request.time` on update.
5. **Terminal State Locking**: A declined friendship (`status == 'declined'`) cannot be mutated to `'accepted'` without creating a fresh request; accepted friendships cannot revert to `'pending'`.
6. **Strict Field Allowlisting**: Every entity validates exact required and allowed keys (`hasAll` + `hasOnly`) on creation and `affectedKeys().hasOnly(...)` on every action-based update.
7. **No Unbounded Arrays**: `blockedUids` is capped at `<= 100`, `users` / `participants` are capped at exactly `2` elements, and reactions use dedicated documents rather than unbounded arrays.

## 2. Dirty Dozen Adversarial Payloads
1. **Shadow Field Injection on Profile**: `{ uid, displayName: "A", ..., isAdmin: true }` -> Rejected by `hasOnly(...)`.
2. **Identity Spoofing on Message**: `{ ..., authorId: "otherUserUid" }` -> Rejected by `authorId == request.auth.uid`.
3. **Unverified Email Bypass**: Request with `email_verified == false` -> Rejected by `isVerifiedUser()`.
4. **PII Cross-Read**: `GET /usersPrivate/victimUid` as attacker -> Rejected by `isOwner(userId)`.
5. **Path ID Poisoning**: `CREATE /servers/invalid$$id!` -> Rejected by `isValidId(serverId)`.
6. **Denial-of-Wallet Oversized String**: `Message.content` > 4000 chars or `attachmentDataUrl` > 450000 chars -> Rejected by `.size()` checks.
7. **Orphaned Channel Creation**: `CREATE /servers/nonexistent/channels/c1` -> Rejected by `exists(...)` parent check.
8. **Non-Member Message Injection**: Writing a message into a server where user is not a member -> Rejected by `isServerMember(serverId)`.
9. **Privilege Escalation in Server**: Regular member updating `ServerMember.role` to `'owner'` -> Rejected by Tiered Identity check (`isServerOwner`).
10. **Friendship Hijack**: Creating a friendship with `requesterId != request.auth.uid` or `status: 'accepted'` directly -> Rejected by `isValidFriendship` & `status == 'pending'`.
11. **Terminal State Bypass**: Updating a `declined` friendship back to `accepted` -> Rejected by `existing().status == 'pending'`.
12. **Timestamp Forgery**: Sending `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
