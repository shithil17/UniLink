# Reject-reason messages

What the author sees when a post is rejected, automatically or by a mod. One message per reason category. The app shows the same text on the post (`StatusNote`) and in the inbox message. Source of truth in code: `src/shared/rejectReasons.ts`. Change both together.

Rules for this copy:

- Category level only. Never name a score, a rule, a banned word, a matched number or what exactly was found. That would show someone how to get around the screen.
- Friendly peer voice: plain, warm, a bit informal, never cutesy (see `PRODUCT.md`).
- Always say what the author can do next: edit and send again. The "Ask a moderator to look" button sits under the message, so the message does not repeat it.
- One or two short sentences, so it fits a phone screen without scrolling.

| Category              | What triggers it                                                                      | Message shown to the author                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `prohibited_item`     | Drugs, weapons, fake documents, leaked exam papers, other items NSU or the law forbid | This post looks like it's about something that can't be posted on UniLink. You can edit it and send it again. |
| `personal_data`       | A student ID, a card number, or photo metadata that can locate someone                | This post seems to include personal details, like an ID or a card number. Take those out and send it again.   |
| `scam_or_spam`        | Unknown links, pay-first or get-rich wording, badly formed contact details            | This post looks like it could be spam or a scam. If that's not what it is, edit it and send it again.         |
| `abuse_or_harassment` | Insults, threats, self-harm baiting                                                   | This post has wording that could hurt or harass someone. You can change it and send it again.                 |
| `off_topic`           | Text over the length limit, photos that are the wrong format or size, unrelated posts | This post doesn't seem to fit here. You can edit it and send it again.                                        |
| `fine`                | Fallback: a model rejection that names no other category (mods must pick one)         | A moderator looked at this post and decided it can't go up as written. You can edit it and send it again.     |

Inbox title for any rejection: "Your post wasn't approved". For an approval: "Your post is live", with "A moderator approved it, so other students can see it now."

When a real model step ships, re-read these against the calibration set's rejected samples and adjust wording if students would misread a category.
