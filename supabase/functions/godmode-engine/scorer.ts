import { scoreResponse } from 'app-chat/attack-chain-refusal.ts';
import type { ScoredResponse } from 'app-chat/attack-chain-refusal.ts';
import { classifyWithJudge } from 'app-chat/__shared/judge.ts';
import type { JudgeClient } from 'app-chat/__shared/judge.ts';

export function makeScorer(judgeClient: JudgeClient) {
  const judge = async (response: string, task?: string) => {
    const r = await classifyWithJudge(judgeClient, response, task ?? '');
    return { tier: r.tier, reason: r.reason };
  };
  return async (response: string, task: string): Promise<ScoredResponse> =>
    scoreResponse(response, task, judge);
}
