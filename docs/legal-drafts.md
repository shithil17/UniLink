# Legal drafts (terms, disclaimer, takedown policy)

**Draft for D to finalise.** This is plain-language wording for the resource sharing feature (Materials). It is not legal advice and has not been reviewed by anyone at NSU. Fill in every `<placeholder>`, check it against the final behaviour of the app, then publish it in the app and link it from sign-up and from Materials.

How the feature works is in [`resource-flow.md`](resource-flow.md) and the requirements are FR-80 to FR-95 in [`srs.md`](srs.md).

## 1. Disclaimer

UniLink is an unofficial app made by students. It is not run, approved or endorsed by North South University (NSU), its departments or its staff. The NSU name is used only to say which students the app is for.

Grades, course maps, planner advice and other figures are estimates from information students enter. They are not an official record, and the retake rules and fees are set by NSU. Check anything that matters with the registrar or your advisor.

Materials shared through UniLink come from other students. UniLink does not check them for accuracy, completeness or legality, and does not host them.

## 2. Terms of use for Materials (draft)

By posting a request or sending a link you agree to the following.

1. **Links only.** UniLink does not host or store files. A link points to a page on another website. What is on that page, and whether it stays available, is outside UniLink's control.
2. **You must have the right to share it.** Send a link only to something you made, something you have permission to share, or something that is freely shared by its owner. You are responsible for what you send. Make sure anyone with the link can open it, and that the page does not need a login that is not yours to share.
3. **Do not send:**
   - copyrighted textbooks or paid material (books, paid courses, solution manuals);
   - exam papers or other material that the university or a faculty member has said must not be shared;
   - personal data, such as student IDs, phone numbers, addresses or other people's private documents;
   - anything illegal, abusive or misleading, or a link that is not what you say it is;
   - a link that hides where it goes. Link shorteners are not accepted.
4. **Who sees what.** Only the student who made a request can see the links sent to it, and they see your username next to each one. Other students cannot see your links. A moderator sees the address of a link only in the review queue, after someone has reported it.
5. **No guarantee.** The student who asked decides whether a link is useful. Accepting a link does not mean UniLink has checked it.
6. **Reports and removal.** Any student can report a request or a link. Moderators may remove content, and may restrict an account that breaks these terms. See section 4.
7. **Automatic deletion.** A request that expires without an accepted link is deleted, together with the links sent to it. After a link is accepted, the request and all its links are deleted 90 days later (shown in the app as 3 months). Save what you need before then. Deletion runs once a day.
8. **Your account.** You are responsible for what is sent from your account. Do not use someone else's.

`<Operator name>` may change these terms. Continued use after a change means you accept it.

## 3. Disclaimer shown next to a link

Suggested short text for the screen where a requester opens a link (not in the app yet):

> This link was sent by another student. UniLink does not host it or check it. Open it only if you trust it, and report it if it is not what it says.

## 4. Takedown policy (draft)

Anyone can ask for content to be removed: a rights holder, a faculty member, or any student. UniLink is run by students, so we ask you to be specific and we will look at every request.

**How to ask.** Send an email to `<contact email>` with:

1. who you are, and your relationship to the material (for example, the author, the rights holder's representative, or the faculty member whose exam it is);
2. what you want removed: the address of the page, or the request in UniLink, as exactly as you can (a screenshot of the request, its course and the date is enough);
3. why it should be removed (for example, that you own the copyright, or that the exam material is restricted);
4. a statement that the information in your message is correct, and that you are the person concerned or act for them;
5. how we can reach you.

Students can also use the Report button in the app. UniLink does not host files, so a link is removed from UniLink, not from the other website.

**What the moderators do.**

- A moderator reads the report or email and decides.
- If the content should go, a moderator removes it with a soft delete: it stops showing to anyone, and the removal is recorded in the audit log with who did it, when and why. An admin can reverse a removal that turns out to be a mistake. The student who wrote the content is told in the app, with the reason.
- The student who sent it may be warned or restricted if it is repeated or deliberate.
- Moderators only soft-delete. Rows are hard-deleted only by the automatic daily cleanup (expired requests, and accepted ones after 90 days).
- We reply to the address you gave within 7 days.

**Counter notice.** If a student thinks a removal was wrong, they can write to `<contact email>` and an admin will look at it again and can reverse the removal.

**Repeat cases.** Accounts that repeatedly send content that is removed may be banned.

## 5. To finalise (D)

- Fill in `<Operator name>` and `<contact email>`.
- Confirm the team can reply within 7 days.
- Confirm the 90 days (`limits.resourceFulfilledKeepMs`) and the daily cleanup time (03:00 in Asia/Dhaka) still match the app.
- Confirm with a faculty member or advisor how exam papers should be described, and whether NSU needs to approve the unofficial-app wording before launch (Open decisions in the build plan).
- Check how a moderator removes content today. A report row in the review queue has a Remove button for a request or a link: it asks for a short reason, soft-deletes the content with `softDelete()`, writes the audit row and closes the reports on it. Check that section 4 matches this.
- Decide where the policy is shown: a page in the app, linked from sign-up, Materials and Settings.
- Have someone who knows the local rules on copyright read section 4 before it goes live.
