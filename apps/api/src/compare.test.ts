import { describe, expect, it } from "vitest";
import { buildComparison } from "./compare.js";

describe("buildComparison", () => {
  it("marks better when discovered has larger bonus", () => {
    const result = buildComparison({
      state: "NJ",
      casinoName: "Test Casino",
      currentOffers: [{ offerName: "Current", expectedBonus: 100, expectedDeposit: 100 }],
      discoveredOffers: [
        {
          state: "NJ",
          casinoName: "Test Casino",
          offerName: "Found",
          expectedBonus: 200,
          expectedDeposit: 100,
          confidence: 0.9,
          citations: []
        }
      ],
      confidenceThreshold: 0.65
    });

    expect(result.verdict).toBe("better");
    expect(result.bonusDelta).toBe(100);
  });

  it("marks unclear and includes alternatives when confidence is low", () => {
    const result = buildComparison({
      state: "MI",
      casinoName: "Test Casino",
      currentOffers: [{ offerName: "Current", expectedBonus: 100, expectedDeposit: 100 }],
      discoveredOffers: [
        {
          state: "MI",
          casinoName: "Test Casino",
          offerName: "Found A",
          expectedBonus: 200,
          expectedDeposit: 100,
          confidence: 0.4,
          citations: []
        },
        {
          state: "MI",
          casinoName: "Test Casino",
          offerName: "Found B",
          expectedBonus: 150,
          expectedDeposit: 100,
          confidence: 0.3,
          citations: []
        }
      ],
      confidenceThreshold: 0.65
    });

    expect(result.verdict).toBe("unclear");
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it("marks better when no tracked offer exists and discovery finds one", () => {
    const result = buildComparison({
      state: "PA",
      casinoName: "New Casino",
      currentOffers: [],
      discoveredOffers: [
        {
          state: "PA",
          casinoName: "New Casino",
          offerName: "Welcome Bonus",
          expectedBonus: 300,
          expectedDeposit: 50,
          confidence: 0.2,
          citations: []
        }
      ],
      confidenceThreshold: 0.65
    });

    expect(result.verdict).toBe("better");
    expect(result.currentOffer).toBeNull();
    expect(result.discoveredOffer?.offerName).toBe("Welcome Bonus");
  });
});
