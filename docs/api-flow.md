# Core API Flow

1. Admin creates an exam.
2. Admin creates exam sections.
3. Admin creates questions and tags them by subject/topic.
4. Admin creates a test.
5. Admin maps ordered questions into the test.
6. Admin publishes the test.
7. Student starts an attempt.
8. Student saves answers incrementally.
9. Student submits or timeout auto-submits.
10. API calculates score and exposes result/analytics.

## Scoring

For each answer:

- Correct: `+defaultMarks`
- Incorrect: `-negativeMarks`
- Unattempted: `0`

The current MVP evaluates multi-correct answers by exact set equality.
