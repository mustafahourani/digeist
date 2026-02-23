export function buildArticlePrompt(topic: string, date: string): string {
  return `Write a full article on the topic: "${topic}"

## Your Task

Research the topic using today's digest data (${date}) and web search if needed. Then produce a complete article file with TWO versions.

Write the output to agent/Articles/${date}-${slugify(topic)}.md using the write_file tool.

## Version A: Full Article Draft

A complete article written in Mustafa's voice, following ALL Writing Voice rules strictly. 800-1500 words.

Structure:
- Hook opening: Open with the interesting part. Create curiosity.
- Body with structured argument: premises → conclusion, evidence for every claim
- Concrete examples and specifics, not abstractions
- Natural "you" and "I" voice
- Short and long sentences mixed
- No AI-speak (no em dashes, no banned words, no triple structures)

## Version B: Structural Outline

A detailed outline of the same article for restructuring if needed.

Format:
\`\`\`
---

## Outline Version

### Hook
[The opening hook in one sentence]

### Section 1: [Title]
- Key point: [...]
- Evidence: [...]
- Transition to next section: [...]

### Section 2: [Title]
...

### Closing
- Takeaway: [...]
- Call to action or question: [...]
\`\`\`

## Process

1. Read today's digest for relevant data
2. Search the web for additional context if needed
3. Read Writing Voice files for reference
4. Write the complete article file with both versions

Be opinionated. Make an argument. Don't just report facts.`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
