/**
 * TextRank-based extractive summarization
 * Implements the TextRank algorithm to extract important sentences without ML/LLM
 */

// Split text into sentences
function splitSentences(text: string): string[] {
  // Preserve code blocks separately
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks: string[] = [];

  // Extract code blocks and replace with placeholders
  let textWithoutCode = text.replace(codeBlockRegex, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // Split on sentence boundaries (., !, ?) followed by space or newline
  const sentences = textWithoutCode
    .split(/(?<=[.!?])\s+|\n\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 10); // Filter out very short fragments

  // Restore code blocks as separate "sentences" to preserve them
  const result: string[] = [];
  for (const sentence of sentences) {
    if (sentence.includes('__CODE_BLOCK_')) {
      // Check if this sentence is just a code block placeholder
      const match = sentence.match(/__CODE_BLOCK_(\d+)__/);
      if (match && sentence === `__CODE_BLOCK_${match[1]}__`) {
        result.push(codeBlocks[parseInt(match[1])]);
      } else {
        // Sentence contains code block - restore it
        let restored = sentence;
        for (let i = 0; i < codeBlocks.length; i++) {
          restored = restored.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
        }
        result.push(restored);
      }
    } else {
      result.push(sentence);
    }
  }

  return result;
}

// Tokenize sentence into words (lowercased, alphanumeric only)
function tokenize(sentence: string): string[] {
  // Skip code blocks for tokenization
  if (sentence.startsWith('```')) {
    return ['__code_block__'];
  }

  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2); // Filter short words
}

// Calculate similarity between two sentences using Jaccard similarity
function calculateSimilarity(sent1: string[], sent2: string[]): number {
  if (sent1.length === 0 || sent2.length === 0) return 0;

  const set1 = new Set(sent1);
  const set2 = new Set(sent2);

  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Build similarity matrix
function buildSimilarityMatrix(sentences: string[][]): number[][] {
  const n = sentences.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = calculateSimilarity(sentences[i], sentences[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }

  return matrix;
}

// Run PageRank-style iteration to score sentences
function rankSentences(matrix: number[][], iterations: number = 50, damping: number = 0.85): number[] {
  const n = matrix.length;
  if (n === 0) return [];

  // Initialize scores equally
  let scores = Array(n).fill(1 / n);

  // Normalize matrix rows
  const normalizedMatrix: number[][] = matrix.map(row => {
    const sum = row.reduce((a, b) => a + b, 0);
    return sum === 0 ? row : row.map(val => val / sum);
  });

  // Iterate
  for (let iter = 0; iter < iterations; iter++) {
    const newScores = Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        if (normalizedMatrix[j][i] > 0) {
          sum += normalizedMatrix[j][i] * scores[j];
        }
      }
      newScores[i] = (1 - damping) / n + damping * sum;
    }

    scores = newScores;
  }

  return scores;
}

/**
 * Summarize text using TextRank algorithm
 * @param text The text to summarize
 * @param ratio The ratio of sentences to keep (0.3 = 30%)
 * @returns Summarized text with code blocks preserved
 */
export function summarize(text: string, ratio: number = 0.3): string {
  const sentences = splitSentences(text);

  // If text is short, return as-is
  if (sentences.length <= 3) {
    return text;
  }

  // Tokenize sentences
  const tokenizedSentences = sentences.map(tokenize);

  // Build similarity matrix
  const matrix = buildSimilarityMatrix(tokenizedSentences);

  // Rank sentences
  const scores = rankSentences(matrix);

  // Determine how many sentences to keep
  const numToKeep = Math.max(2, Math.ceil(sentences.length * ratio));

  // Get indices of top-scored sentences, but always include code blocks
  const scoredIndices = sentences.map((sent, idx) => ({
    idx,
    score: scores[idx],
    isCode: sent.startsWith('```')
  }));

  // Separate code blocks and regular sentences
  const codeIndices = scoredIndices.filter(s => s.isCode).map(s => s.idx);
  const textIndices = scoredIndices
    .filter(s => !s.isCode)
    .sort((a, b) => b.score - a.score)
    .slice(0, numToKeep)
    .map(s => s.idx);

  // Combine and sort by original order to maintain flow
  const keepIndices = new Set([...codeIndices, ...textIndices]);
  const keptSentences = sentences.filter((_, idx) => keepIndices.has(idx));

  return keptSentences.join('\n\n');
}

/**
 * Compress a conversation by summarizing assistant responses
 * @param messages Array of messages with role and content
 * @param ratio Compression ratio for assistant messages
 * @returns Compressed messages
 */
export function compressConversation(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  ratio: number = 0.3
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages.map(msg => {
    if (msg.role === 'user') {
      // Keep user messages intact
      return msg;
    } else {
      // Summarize assistant responses
      return {
        ...msg,
        content: summarize(msg.content, ratio)
      };
    }
  });
}
