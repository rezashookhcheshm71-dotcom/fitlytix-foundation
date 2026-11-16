/**
 * Coach attention items derived from recorded behaviour (not from demo rules).
 *
 * Deliberately shaped like `CoachAttentionItem` from `@/domain/platform` but with an open
 * `code`, because the reasons come from the same nudge rules the athlete sees. A coach and an
 * athlete should never be told two different stories about the same week.
 */
import type { NudgeCode } from "@/services/athlete/nudges";

export interface LiveAttentionItem {
  /** `${athleteId}:${code}` — stable key for React and for dedupe. */
  id: string;
  athleteId: string;
  athleteName: string;
  code: NudgeCode;
  severity: "act" | "watch";
  /** The fact, in the athlete's own words (shared with the athlete's nudge). */
  detailFa: string;
  actionFa: string;
  /** Days since the athlete last sent anything at all — null when they never have. */
  silentDaysFa: string;
}

export interface CoachAttention {
  generatedAt: string;
  summary: {
    athletes: number;
    act: number;
    watch: number;
    quiet: number;
  };
  items: LiveAttentionItem[];
}
