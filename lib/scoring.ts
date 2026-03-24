// Shared constants and scoring functions used by HN, Reddit, and GitHub sources.

export const MS_PER_DAY = 86_400_000;

// Tier 1: Definitive AI indicators (full weight)
export const AI_KEYWORDS_T1 =
  /\b(llm|large.language.model|openai|anthropic|claude|deepseek|deepmind|chatgpt|gpt-[3-5o]|o[13]-|sonnet|opus|haiku|gemini.\d|grok|rlhf|agi|language.model|foundation.model|diffusion.model|transformer.model|neural.network|deep.learning|machine.learning|fine.tun|generative.ai|multimodal|hugging.face|mistral|meta.ai|llama.\d|qwen|phi-\d|stable.diffusion)/i;

// Tier 2: Probably AI but could be something else (0.6x)
export const AI_KEYWORDS_T2 =
  /\b(ai|agent|inference|embedding|vector|rag|gpu|nvidia|cuda|tpu|benchmark|reasoning|alignment|safety|context.window|token|prompt|mcp|model.context.protocol|cursor|windsurf|devin|replit|v0|bolt|coding.agent|vibe.cod|agentic|perplexity|groq|copilot|transformer|reinforcement.learning)/i;

// Tier 3: Weak signals, only count if T1/T2 also present (0.3x)
export const AI_KEYWORDS_T3 =
  /\b(model|training|dataset|parameters|weights|latency|throughput|api|scaling|open.source|python|tensor|compute|cloud|quantiz|optimization|distill)/i;

export function aiRelevanceScore(title: string, selftext?: string): number {
  const text = selftext ? `${title} ${selftext.slice(0, 500)}` : title;
  const t1 = (text.match(new RegExp(AI_KEYWORDS_T1, "gi")) || []).length;
  const t2 = (text.match(new RegExp(AI_KEYWORDS_T2, "gi")) || []).length;
  const t3 = (text.match(new RegExp(AI_KEYWORDS_T3, "gi")) || []).length;

  // T3 only counts if there's at least one T1 or T2 match
  const t3Effective = t1 + t2 > 0 ? t3 : 0;

  const raw = t1 * 1.0 + t2 * 0.6 + t3Effective * 0.3;
  // Normalize to 0-1 with diminishing returns
  return raw === 0 ? 0 : Math.min(1, 0.5 + raw * 0.15);
}

export function discussionHeat(score: number, comments: number): number {
  if (score === 0) return 1;
  const ratio = comments / score;
  const clamped = Math.min(ratio, 2.0);
  // Returns multiplier between 1.0 and 1.5
  return 1 + clamped * 0.25;
}

// --- Tracking criteria scoring functions ---
// Each returns 0 or 1 (binary match). Used as small additive bonuses.

const ECOSYSTEM_BACKING_RE =
  /\b(product.hunt|y.combinator|YC|a16z|andreessen.horowitz|sequoia|greylock|benchmark|lightspeed|khosla|founders.fund|techstars|backed.by)\b/i;

export function ecosystemBackingScore(text: string): number {
  return ECOSYSTEM_BACKING_RE.test(text) ? 1 : 0;
}

const REVENUE_FUNDING_RE =
  /\b(MRR|ARR|revenue|paying.customers|seed.round|pre.seed|series.[A-C]|angel.round|funding|valuation|profitable|break.even)\b|raised.\$|\$\d+[MBKmk]/i;

export function revenueFundingScore(text: string): number {
  return REVENUE_FUNDING_RE.test(text) ? 1 : 0;
}

const VERIFIABLE_INFRA_RE =
  /\b(TEE|trusted.execution|SGX|secure.enclave|confidential.computing|verifiable.compute|zero.knowledge|ZK.proof|zkML|ZKML|homomorphic|FHE|proof.of.inference|attestation|on.chain.inference)\b/i;

export function verifiableInfraScore(text: string): number {
  if (!VERIFIABLE_INFRA_RE.test(text)) return 0;
  // Only count if the text also mentions AI — filters out pure crypto/blockchain
  if (AI_KEYWORDS_T1.test(text) || AI_KEYWORDS_T2.test(text)) return 1;
  return 0;
}
