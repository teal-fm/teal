/**
 * Tests for fuzzy matching utilities
 */

import {
  levenshteinDistance,
  similarityRatio,
  fuzzyMatch,
  fuzzyScore,
} from "../fuzzyMatching";

describe("levenshteinDistance", () => {
  describe("exact matches", () => {
    it("should return 0 for identical strings", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
      expect(levenshteinDistance("Beatles", "Beatles")).toBe(0);
    });

    it("should return 0 for case-insensitive matches", () => {
      expect(levenshteinDistance("HELLO", "hello")).toBe(0);
      expect(levenshteinDistance("Beatles", "BEATLES")).toBe(0);
    });

    it("should return 0 for empty strings", () => {
      expect(levenshteinDistance("", "")).toBe(0);
    });
  });

  describe("single edits", () => {
    it("should return 1 for single character insertion", () => {
      expect(levenshteinDistance("hello", "helloo")).toBe(1);
    });

    it("should return 1 for single character deletion", () => {
      expect(levenshteinDistance("hello", "helo")).toBe(1);
    });

    it("should return 1 for single character substitution", () => {
      expect(levenshteinDistance("hello", "hallo")).toBe(1);
    });
  });

  describe("multiple edits", () => {
    it("should return correct distance for multiple edits", () => {
      expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    });

    it("should return string length when comparing to empty", () => {
      expect(levenshteinDistance("hello", "")).toBe(5);
      expect(levenshteinDistance("", "world")).toBe(5);
    });
  });

  describe("music-specific cases", () => {
    it("should correctly measure Beatles/Beetles typo", () => {
      expect(levenshteinDistance("beatles", "beetles")).toBe(1);
    });

    it("should handle AC/DC variations", () => {
      expect(levenshteinDistance("acdc", "ac/dc")).toBe(1);
    });
  });
});

describe("similarityRatio", () => {
  it("should return 1.0 for identical strings", () => {
    expect(similarityRatio("hello", "hello")).toBe(1.0);
  });

  it("should return 1.0 for empty strings", () => {
    expect(similarityRatio("", "")).toBe(1.0);
  });

  it("should return 0.0 for completely different strings", () => {
    expect(similarityRatio("abc", "xyz")).toBe(0);
  });

  it("should return higher ratio for more similar strings", () => {
    const closeRatio = similarityRatio("hello", "hallo");
    const farRatio = similarityRatio("hello", "world");
    expect(closeRatio).toBeGreaterThan(farRatio);
  });
});

describe("fuzzyMatch", () => {
  describe("exact matches", () => {
    it("should match identical strings", () => {
      expect(fuzzyMatch("Hello World", "Hello World")).toBe(true);
    });

    it("should match case-insensitively", () => {
      expect(fuzzyMatch("HELLO", "hello")).toBe(true);
    });

    it("should match with accent differences", () => {
      expect(fuzzyMatch("Beyonce", "Beyonce")).toBe(true);
    });
  });

  describe("similarity threshold", () => {
    it("should match similar strings above threshold", () => {
      expect(fuzzyMatch("hello", "hallo", 0.7)).toBe(true);
    });

    it("should not match dissimilar strings", () => {
      expect(fuzzyMatch("hello", "world", 0.7)).toBe(false);
    });

    it("should respect custom threshold", () => {
      expect(fuzzyMatch("hello", "hallo", 0.9)).toBe(false);
      expect(fuzzyMatch("hello", "hallo", 0.7)).toBe(true);
    });
  });
});

describe("fuzzyScore", () => {
  it("should return 1.0 for exact matches", () => {
    expect(fuzzyScore("Hello World", "Hello World")).toBe(1.0);
  });

  it("should score 'starts with' matches by coverage", () => {
    // "Hello" (5) in "Hello World" (11): 0.7 + 0.2 * (5/11) ≈ 0.791
    const score = fuzzyScore("Hello", "Hello World");
    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThan(0.9);

    // High coverage prefix scores near 0.9
    expect(fuzzyScore("Hello Worl", "Hello World")).toBeGreaterThan(0.88);
  });

  it("should score 'contains' matches by coverage", () => {
    // "World" (5) in "Hello World" (11): 0.5 + 0.3 * (5/11) ≈ 0.636
    const score = fuzzyScore("World", "Hello World");
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(0.8);

    // High coverage containment scores near 0.8
    expect(fuzzyScore("ello World", "Hello World")).toBeGreaterThan(0.75);

    // Low coverage containment scores near 0.5
    expect(fuzzyScore("lo", "Hello World")).toBeLessThan(0.6);
  });

  it("should return similarity ratio for partial matches", () => {
    const score = fuzzyScore("hello", "hallo");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(0.8);
  });
});

describe("edge cases", () => {
  it("should handle empty strings", () => {
    expect(fuzzyMatch("", "")).toBe(true);
    expect(fuzzyScore("", "")).toBe(1.0);
  });

  it("should handle very long strings", () => {
    const long1 = "a".repeat(100);
    const long2 = "a".repeat(99) + "b";
    expect(fuzzyMatch(long1, long2, 0.9)).toBe(true);
  });
});
