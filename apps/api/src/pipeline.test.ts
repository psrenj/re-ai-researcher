import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { config } from "./config.js";
import { initDb, sqlite } from "./db.js";
import { processRun } from "./pipeline.js";
import { createRun, getRunReport } from "./repository.js";
import type { ResearchProvider } from "./types.js";

const mockProvider: ResearchProvider = {
  async discoverCasinos({ state }) {
    return [
      {
        casinoName: state === "NJ" ? "New Jersey Demo Casino" : "Shared Demo Casino",
        confidence: 0.8,
        citations: [{ title: "Regulator", url: `https://example.com/${state}` }]
      }
    ];
  },
  async discoverOffers({ state, casinoName }) {
    return [
      {
        state,
        casinoName,
        offerName: "Welcome 100% up to 500",
        expectedDeposit: 500,
        expectedBonus: 500,
        confidence: 0.9,
        citations: [{ title: "Offer", url: "https://example.com/offer" }]
      }
    ];
  }
};

describe("processRun", () => {
  it("creates a report with comparisons and missing casinos", async () => {
    initDb();
    sqlite.exec("DELETE FROM runs; DELETE FROM discovered_casinos; DELETE FROM discovered_offers; DELETE FROM comparisons; DELETE FROM source_offers_snapshot; DELETE FROM run_issues; DELETE FROM run_stage_events; DELETE FROM llm_traces;");

    const runId = randomUUID();
    createRun({ id: runId, trigger: "manual", mode: "full", states: ["NJ"] });

    await processRun({
      runId,
      states: ["NJ"],
      provider: mockProvider,
      fetchOffers: async () => [
        {
          state: "NJ",
          casinoName: "Existing NJ Casino",
          offerName: "100 up to 100",
          expectedDeposit: 100,
          expectedBonus: 100,
          offerType: "Deposit"
        }
      ]
    });

    const report = getRunReport(runId);
    expect(report).not.toBeNull();
    expect(report?.offerComparisons.length).toBeGreaterThan(0);
    expect(report?.missingCasinos.length).toBeGreaterThan(0);
    expect(report?.stageEvents.length).toBeGreaterThan(0);
  });

  it("processes all offer targets in batches without skipping remainders", async () => {
    initDb();
    sqlite.exec("DELETE FROM runs; DELETE FROM discovered_casinos; DELETE FROM discovered_offers; DELETE FROM comparisons; DELETE FROM source_offers_snapshot; DELETE FROM run_issues; DELETE FROM run_stage_events; DELETE FROM llm_traces;");

    const runId = randomUUID();
    createRun({ id: runId, trigger: "manual", mode: "full", states: ["NJ"] });

    const provider: ResearchProvider = {
      async discoverCasinos() {
        return [];
      },
      async discoverOffers({ state, casinoName }) {
        return [
          {
            state,
            casinoName,
            offerName: "Offer",
            expectedDeposit: 100,
            expectedBonus: 150,
            confidence: 0.8,
            citations: []
          }
        ];
      }
    };

    const baseline = Array.from({ length: 41 }, (_, index) => ({
      state: "NJ" as const,
      casinoName: `Casino ${index + 1}`,
      offerName: `Base ${index + 1}`,
      expectedDeposit: 100,
      expectedBonus: 100
    }));

    await processRun({
      runId,
      states: ["NJ"],
      provider,
      fetchOffers: async () => baseline
    });

    const report = getRunReport(runId);
    const expectedBatches = Math.ceil(41 / config.MAX_CASINOS_PER_RUN);
    expect(report).not.toBeNull();
    expect(report?.offerComparisons.length).toBe(41);
    expect(report?.stageEvents.filter((event) => event.stage === "offer_discovery_batch").length).toBe(expectedBatches);
  });
});
