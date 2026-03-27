import { describe, expect, it } from "vitest";
import * as fc from "fast-check";

import { StateMachine, createDefaultStateMachine } from "../../src/state/machine.js";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary non-empty state name: trimmed, no empty strings. */
const stateNameArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

const stateListArb = fc.uniqueArray(stateNameArb, { minLength: 1, maxLength: 8 });

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe("StateMachine — property-based tests", () => {
  // ── Invariant: known states are always findable ───────────────────

  it("every configured active state is known", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, (active, terminal) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });

        for (const state of active) {
          expect(sm.isKnownState(state)).toBe(true);
        }
      }),
    );
  });

  it("every configured terminal state is known", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, (active, terminal) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });

        for (const state of terminal) {
          expect(sm.isKnownState(state)).toBe(true);
        }
      }),
    );
  });

  // ── Invariant: terminal classification is correct ─────────────────

  it("every terminal state reports isTerminalState=true", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, (active, terminal) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });

        for (const state of terminal) {
          expect(sm.isTerminalState(state)).toBe(true);
        }
      }),
    );
  });

  it("active-only states are not terminal (when disjoint from terminal)", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, (active, terminal) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });
        const terminalNormalized = new Set(terminal.map((s) => s.toLowerCase()));

        for (const state of active) {
          if (!terminalNormalized.has(state.toLowerCase())) {
            expect(sm.isTerminalState(state)).toBe(false);
          }
        }
      }),
    );
  });

  // ── Invariant: case-insensitivity ─────────────────────────────────

  it("state lookups are case-insensitive", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, (active, terminal) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });

        for (const state of active) {
          expect(sm.isKnownState(state.toUpperCase())).toBe(sm.isKnownState(state.toLowerCase()));
        }
      }),
    );
  });

  // ── Invariant: self-transitions are always valid ──────────────────

  it("any known state can transition to itself", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, (active, terminal) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });

        for (const state of [...active, ...terminal]) {
          expect(sm.canTransition(state, state)).toBe(true);
        }
      }),
    );
  });

  // ── Invariant: unknown states cannot transition ───────────────────

  it("transitions from unknown states are always rejected", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, stateNameArb, (active, terminal, unknown) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });

        if (!sm.isKnownState(unknown)) {
          for (const known of [...active, ...terminal]) {
            expect(sm.canTransition(unknown, known)).toBe(false);
          }
        }
      }),
    );
  });

  it("transitions to unknown states are always rejected", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, stateNameArb, (active, terminal, unknown) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });

        if (!sm.isKnownState(unknown)) {
          for (const known of [...active, ...terminal]) {
            expect(sm.canTransition(known, unknown)).toBe(false);
          }
        }
      }),
    );
  });

  // ── Invariant: default transitions ────────────────────────────────

  it("non-terminal states can transition to any state by default", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, (active, terminal) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });
        const terminalNormalized = new Set(terminal.map((s) => s.toLowerCase()));

        for (const from of active) {
          if (!terminalNormalized.has(from.toLowerCase())) {
            // Non-terminal states should be able to go to any known state
            for (const to of [...active, ...terminal]) {
              expect(sm.canTransition(from, to)).toBe(true);
            }
          }
        }
      }),
    );
  });

  it("terminal states can only self-transition by default", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, (active, terminal) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });
        const activeNormalized = new Set(active.map((s) => s.toLowerCase()));

        for (const from of terminal) {
          // Terminal states should only allow self-transition
          for (const to of [...active, ...terminal]) {
            const fromNorm = from.toLowerCase();
            const toNorm = to.toLowerCase();
            if (fromNorm !== toNorm && !activeNormalized.has(fromNorm)) {
              expect(sm.canTransition(from, to)).toBe(false);
            }
          }
        }
      }),
    );
  });

  // ── Invariant: assertTransition is consistent with canTransition ──

  it("assertTransition.ok matches canTransition result for known states", () => {
    fc.assert(
      fc.property(stateListArb, stateListArb, (active, terminal) => {
        const sm = new StateMachine({ activeStates: active, terminalStates: terminal });
        const allStates = [...active, ...terminal];

        for (const from of allStates) {
          for (const to of allStates) {
            const result = sm.assertTransition(from, to);
            expect(result.ok).toBe(sm.canTransition(from, to));
          }
        }
      }),
    );
  });

  // ── Invariant: getStages returns immutable copy ───────────────────

  it("getStages returns fresh copies that cannot mutate internal state", () => {
    const sm = createDefaultStateMachine();

    const stages1 = sm.getStages();
    stages1[0].key = "mutated";

    const stages2 = sm.getStages();
    expect(stages2[0].key).not.toBe("mutated");
  });

  // ── Invariant: duplicate states are deduplicated ──────────────────

  it("duplicate state names are merged into one entry", () => {
    fc.assert(
      fc.property(stateNameArb, (state) => {
        const sm = new StateMachine({
          activeStates: [state, state, state],
          terminalStates: [],
        });

        const stages = sm.getStages();
        const matchingStages = stages.filter((s) => s.key === state.toLowerCase());
        expect(matchingStages).toHaveLength(1);
      }),
    );
  });
});
