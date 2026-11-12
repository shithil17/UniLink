# Docs

| File                                                                       | What it is                                                                              | Phase   |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------- |
| [`api-contracts.md`](api-contracts.md)                                     | Endpoint list and the `notify()` and `screen()` signatures                              | 0       |
| [`srs.md`](srs.md)                                                         | Software requirements (draft) with stable `FR-*` and `NFR-*` IDs                        | 0-10    |
| [`use-cases.md`](use-cases.md)                                             | Use case diagram and descriptions                                                       | 2, 9    |
| [`class-diagram.md`](class-diagram.md)                                     | Data model, strategies, composite, adapters and the screening chain                     | 6, 8, 9 |
| [`moderation-flow.md`](moderation-flow.md)                                 | Activity diagrams for reports, user actions, ID conflicts, reversal                     | 7       |
| [`screening-flow.md`](screening-flow.md)                                   | Activity diagrams for post screening, asking a mod, the review queue                    | 8       |
| [`screens.md`](screens.md)                                                 | Screen and flow specification for every built screen                                    | 0-10    |
| [`planner-flow.md`](planner-flow.md)                                       | Activity diagrams for the grade planner: target to advice, and how a grade is predicted | 9b      |
| [`resource-flow.md`](resource-flow.md)                                     | Sequence diagrams for material requests, links, accepting, reports, expiry and purge    | 10      |
| [`legal-drafts.md`](legal-drafts.md)                                       | Draft terms, disclaimer and takedown policy for resource sharing (for D to finalise)    | 10      |
| [`test-data/planner-test-degree.json`](test-data/planner-test-degree.json) | Small test degree for the planner's hand-calculated scenarios (staging only)            | 9b      |
| [`reject-reasons.md`](reject-reasons.md)                                   | The author-facing message for each reject category                                      | 8       |
| [`elicitation-survey.md`](elicitation-survey.md)                           | Student survey and how its answers feed the SRS                                         | 0       |
| [`data-formats.md`](data-formats.md)                                       | Curriculum and faculty list formats for D                                               | 4, 6    |
| [`test-cases.md`](test-cases.md)                                           | Manual test cases linked to SRS IDs                                                     | 0-10    |
| [`contrast-check.md`](contrast-check.md)                                   | Computed contrast ratios for all five palettes                                          | 1, 4b   |

Diagrams are Mermaid, so GitHub renders them. Update these when the build changes; the SRS must match what ships.
