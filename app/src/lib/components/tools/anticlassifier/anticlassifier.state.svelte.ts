/**
 * Module-level state for the Anti-Classifier tool. Survives tab switches.
 * Loading/error flags remain component-local (via activeRuns).
 *
 * Wave 3.3: extended with N-variant fan-out (`variants` + `numVariants`).
 * The legacy single `output` field is retained for back-compat / copy-to-clipboard
 * convenience — populated with the first variant's text on a successful run.
 */
import type { VariantScore } from '$lib/redteam/anticlassifier-scorer';

export interface VariantEntry {
  /** The rewritten text returned by the LLM for this variant. */
  text: string;
  /** Linguistic-feature score produced by anticlassifier-scorer. */
  score: VariantScore;
  /** Temperature used for this variant's LLM call. */
  temperature: number;
}

let input = $state('');
let output = $state('');
let maxTokens = $state(2000);
let variants = $state<VariantEntry[]>([]);
let numVariants = $state(5);

export const anticlassifierState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get output() { return output; },
  set output(v: string) { output = v; },

  get maxTokens() { return maxTokens; },
  set maxTokens(v: number) { maxTokens = v; },

  get variants() { return variants; },
  set variants(v: VariantEntry[]) { variants = v; },

  get numVariants() { return numVariants; },
  set numVariants(v: number) { numVariants = v; },

  reset() {
    input = '';
    output = '';
    maxTokens = 2000;
    variants = [];
    numVariants = 5;
  }
};
