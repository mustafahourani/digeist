export function buildWeeklyPrompt(weekLabel: string, startDate: string, endDate: string): string {
  return `Generate the Weekly Strategy Memo for ${weekLabel} (${startDate} to ${endDate}).

## Your Task

Synthesize THREE data sources:
1. The Digeist weekly digest JSON (if available at data/weekly/${weekLabel}.json)
2. The agent's daily briefings from this week (data/agent/briefings/*.md for dates ${startDate} through ${endDate})
3. All user feedback from this week (data/agent/feedback/*.json for this week's dates)

Read all available files using the read_file and list_digests tools, then write the weekly memo.

## Output

Write to: data/agent/weekly/${weekLabel}.md

## Structure

\`\`\`markdown
# Weekly Strategy Memo — Week of [formatted date range]

## This Week in One Paragraph
[Narrative summary of the week's biggest themes and shifts. Hook first. Be specific.]

## Top Content Opportunities This Week
1. [Topic] — [Why it's the best content opportunity and suggested format]
2. [Topic] — ...
3. [Topic] — ...

## What I Got Right This Week
[Self-assessment: which recommendations landed well, which tweet drafts
the user approved, which patterns proved correct. Be honest.]

## What I Got Wrong This Week
[Self-assessment: which recommendations missed, what feedback patterns
suggest miscalibration. Be honest and specific.]

## Preference Drift
[Has the user's taste shifted this week? Any new patterns in feedback?
Compare this week's preferences to last week's. Be specific.]

## Config Health
[Overall assessment of keywords.json effectiveness. Are the sources
delivering good signal? Any structural recommendations? Use data.]

## Next Week Preview
[Based on patterns and trajectories, what should the user watch for
next week? Predictions on emerging topics. Be specific.]
\`\`\`

## Process

1. List all available digest dates and read the ones in this week's range
2. Read all daily briefings for this week
3. Read all feedback logs for this week
4. Read current preferences and patterns
5. Synthesize everything into the weekly memo
6. Write the output file

Be honest in self-assessment. The value of this memo comes from genuine reflection, not flattering yourself.`;
}
