# Faculty sources

Where the rows in `data/faculty/*.json` (one file per department) came from, and what is still missing. The file shape is in [data-formats.md](data-formats.md#faculty-list).

## What is in the file (352 rows)

| Dept | Rows | Source                                                                  | Snapshot dates (YYYY-MM-DD)               |
| ---- | ---- | ----------------------------------------------------------------------- | ----------------------------------------- |
| ECE  | 87   | Public listing at `ece.northsouth.edu/people`, taken 2026-10-20         | live page                                 |
| ACF  | 35   | `northsouth.edu/faculty-members/sbe/acc-fin`, pages 1-3                 | 2026-09-03, 2026-05-08, 2026-05-08        |
| ECO  | 34   | `.../sbe/economics`, pages 1-3                                          | 2026-09-05, 2026-06-12, 2026-06-12        |
| MGT  | 80   | `.../sbe/mgt`, pages 1-6                                                | 2026-07-22, then 2026-06-12 for pages 2-6 |
| MKT  | 36   | `.../sbe/marketing-ib`, pages 1-3                                       | 2026-10-12, 2026-05-08, 2026-04-18        |
| ARC  | 17   | `.../seps/architecture`, pages 1-2                                      | 2026-05-08, 2026-02-14                    |
| DMP  | 25   | `.../seps/mathematics-physics`, pages 1-2                               | 2026-07-15, 2026-06-12                    |
| BBT  | 14   | `.../shls/biochemistry-biotechnology`, page 1 only                      | 2026-07-15                                |
| MIC  | 24   | `.../shls/biochemistry-microbiology` (the old combined page), pages 2-4 | 2026-05-13                                |

All non-ECE rows are the newest Wayback Machine snapshot of each listing page that could be fetched. The paths are under `https://www.northsouth.edu/faculty-members/`. Each row's `nsuPage` is the profile link printed on that listing. Where the listing printed no link, `nsuPage` is `null` (none at the moment).

## What is missing

- **The live site cannot be reached.** `www.northsouth.edu` sits behind Cloudflare and refuses automated requests, so nothing was read from it directly. Everything above is from archived copies, which can be months old: people may have joined, left or changed rank since.
- **The scrape was partial.** Snapshots were not found for every page. Page 1 of `biochemistry-microbiology` failed, and `biochemistry-biotechnology` only has page 1 (14 rows), so BBT and MIC are incomplete. The other departments may also be short of whatever the archive missed.
- **Never fetched:** Civil and Environmental Engineering (CEE), Environmental Science and Management (ESM), Pharmaceutical Sciences (PHA), Public Health (PBH), English and Modern Languages (EML), Political Science and Sociology (PSS), Law (LAW), History and Philosophy (HIS), Media, Communication and Journalism (MCJ). These departments exist in `src/shared/departments.ts` with no rows.
- **BBT and MIC:** NSU split Biochemistry and Microbiology into two departments. The current BBT and MIC listing pages were never archived, so the split here is partly inferred (see below).

Moderators add or correct the rest in the Faculty panel (add a person, fix a designation, set initials or the NSU page, hide someone who left). A re-seed never clears initials or a page a moderator entered.

## How the rows were cleaned

- **Name:** honorifics dropped (Dr., Mr., Ms., Ar., Prof.), the `[XX]` initials suffix dropped, status notes such as "(On Leave)" dropped from the name, and post-nominals such as ", CPA", ", FRM" and ", Ph.D." dropped. The ECE rows carry none of these either. Two people share the printed name Mohammad Lutfor Rahman in MGT, so each keeps their initials in the name, the way the two ECE Atiqur Rahmans do.
- **Designation:** as printed, with spacing and capitals tidied ("senior Lecturer" becomes "Senior Lecturer"). Statuses like "(On Leave)" stay. Designations the site cut off with "…" were trimmed to the role part. Two rows printed no designation (Mohammed Golam Rabbani, Muhammad Faisol Chowdhury) and carry the placeholder "Faculty" for a moderator to fix.
- **Initials:** taken from the `[XX]` suffix NSU prints after each name on the faculty listing (the university-wide code, same as the ECE rows). Stray spaces inside the brackets were removed. Every one matches the 2 to 6 letters-or-digits rule. People whose entry printed no bracket have `null` (5 outside ECE: Md Maruf Hossain, Hasina Akter, M Niaz Asadullah, Atikur Rahman Khan, Md. Shamim Talukder). No initials were guessed.
- **Departments:** the old combined Biochemistry and Microbiology rows went to BBT when the same profile or initials appear on the BBT page (5 people), to MIC when the designation says so (1: the MIC program coordinator), and otherwise to MIC by default (23 people, listed below). Treat MIC as the place to check first.
- **Duplicates:** one row per person. Mahafuz Mannan (MKT, listed on two pages), the five BBT people repeated on the old combined pages, and Md Hasan Al Amin (listed on two old pages) are merged. Mujtaba Ahsan is listed in ARC as a professor and in ECE as an adjunct with the same initials; the existing ECE row stays and the ARC one is not added, because a seed never deletes rows and two rows with the same initials would be refused.

### MIC rows with no evidence for BBT or MIC (check these)

Md. Fakruddin, Md. Sazzad Hossen Toushik, Anica Tasnim Protity, Kazi Md. Mostafizur Rahman, Farzana Hossain, Md. Morshedul Alam, Most. Naoshia Tasnin, Mahbuba Rahman, Md Hasan Al Amin, Adhip Rahman, Eusra Mohammad, M.S. Rahman, Md Muntasir Ali, Sazia Iftekhar, Farhana Easmin, Kazi Samia Pial, Kazi Fahmida Rahman, Ahmed Ishtiaque, Preyanka Nath, Fahd Bin Zahed, Nusrat Zahan Rouf, Tasnia Hossain, Tahrima Saiha Huq.

### Possible duplicates left as separate rows

- Abul Kalam Azad (ECE, no initials) and Abul Kalam al Azad (DMP, AKAd): similar name, different initials.
- Mohammad Lutfor Rahman (MGT, LRn and MLtR): two profile pages, might be one person.

Profile links for the MIC rows point at the old combined path (`.../shls/biochemistry-microbiology/...`), which may have moved.
