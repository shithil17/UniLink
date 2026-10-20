# Elicitation survey

Short survey for NSU students to confirm which features matter before the SRS is finalised. About 5 minutes. Send it as a Google Form; keep it anonymous and do not ask for student IDs or names.

Intro text for the form: "We are NSU students building a free, unofficial companion app. This survey is anonymous. It tells us what to build first. It is not an official NSU survey."

## About you

1. Which program are you in? (dropdown of NSU undergraduate programs)
2. Which year did you start? (2018 or earlier, 2019, 2020, 2021, 2022, 2023, 2024, 2025)
3. What phone do you use? (Android, iPhone, other)
4. How do you usually open things on your phone? (installed app, home-screen shortcut, browser bookmark, search each time)

## Courses and CGPA

5. How do you track your courses and CGPA now? (NSU portal, spreadsheet, notes app, in my head, other)
6. How hard is it to know which courses you can take next? (1 easy to 5 very hard)
7. Do you retake courses to improve a grade? (never, once, a few times, often)
8. How useful would each be? (1 not useful to 5 essential)
   - A map of your program's courses with prerequisites
   - A CGPA calculator that handles retakes (best grade counts)
   - Credits remaining per category
   - A retake reminder for courses below B+
   - Recording which faculty taught a course
9. Do you take courses outside your program's list (open electives, other departments)? (never, sometimes, often)

## Notifications

10. Would you turn on phone notifications for this app? (yes, maybe, no)
11. What would you want to be told about? (replies to my posts, report outcomes, updates to my courses, announcements, nothing)

## Trust and moderation

12. Would you sign up with your NSU ID and NSU email? (yes, only if the ID stays private, no)
13. What would make you leave or never join? (open text)
14. If something is wrong in a post, how would you want to report it? (a button on the post, message a moderator, other)
15. Would you be willing to be a volunteer moderator? (yes, maybe, no)

## Other features we are considering

16. Rank these by how much you would use them (1 to 5 each): class routine, sharing study resources, ride sharing, lost and found, buy and sell, faculty and research info.
17. Anything else you wish existed for NSU students? (open text)

## How the answers feed the SRS

| Question | Informs                                                      |
| -------- | ------------------------------------------------------------ |
| 5 to 9   | FR-16 to FR-26: course map, CGPA, retakes, student courses   |
| 3, 4     | FR-11 to FR-14: install and iOS hint priority                |
| 10, 11   | FR-27 to FR-29: inbox and push                               |
| 12 to 15 | FR-1 to FR-8, FR-31 to FR-38: signup, privacy, reports, mods |
| 16, 17   | Order of the planned features                                |

Record the results (counts and a short summary, no raw free text with names) in a new `docs/survey-results.md` and update the affected requirements.
