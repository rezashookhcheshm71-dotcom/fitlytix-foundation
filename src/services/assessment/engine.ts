/**
 * Assessment Engine — service boundary.
 * Resolves templates, computes completion, and persists authenticated answers to MySQL via `/api/assessment`.
 */
import type { BodyAnalysisInput, BodyAnalysisRecord } from "@/domain/body-analysis";
import { COMMON_ASSESSMENT, SPORT_ASSESSMENTS } from "@/domain/assessment/templates";
import type {
  AssessmentAnswers,
  AssessmentTemplate,
  ExperienceLevel,
  HealthProvider,
  SportId,
  WearableIntent,
} from "@/domain/types";

const COMMON_DRAFT_STORAGE_KEY = "fitlytix_common_assessment_draft_v2";
const SPORT_DRAFT_STORAGE_KEY = "fitlytix_sport_assessment_draft_v2";

export interface PersistedAssessmentState {
  ok: boolean;
  authenticated: boolean;
  athleteId?: string | undefined;
  userId?: string | undefined;
  primarySport?: SportId | undefined;
  experienceLevel?: ExperienceLevel | undefined;
  commonAssessment?: {
    id: string;
    templateId: string;
    answers: AssessmentAnswers;
    completedAt?: string | undefined;
    status: string;
  } | null | undefined;
  sportAssessments?: Record<
    string,
    {
      id: string;
      templateId: string;
      sport: SportId;
      experienceLevel: ExperienceLevel;
      answers: AssessmentAnswers;
      completedAt?: string | undefined;
      status: string;
    }
  > | undefined;
  bodyRecords?: BodyAnalysisRecord[] | undefined;
  wearable?: {
    intent?: WearableIntent | undefined;
    providers: HealthProvider[];
  } | undefined;
}

export interface SubmitAssessmentResult {
  ok: boolean;
  status: "submitted" | "unauthenticated" | "error";
  error?: string | undefined;
  assessmentId?: string | undefined;
  athleteId?: string | undefined;
}

export const assessmentEngine = {
  getCommonTemplate(): AssessmentTemplate {
    return COMMON_ASSESSMENT;
  },

  getSportTemplate(sport: SportId): AssessmentTemplate {
    return SPORT_ASSESSMENTS[sport];
  },

  /** Question depth grows with training experience without forcing specialist tests. */
  visibleFields(template: AssessmentTemplate, level: ExperienceLevel) {
    const rank: Record<ExperienceLevel, number> = {
      beginner: 0,
      intermediate: 1,
      advanced: 2,
      elite: 2,
    };
    const minimum = { all: 0, intermediatePlus: 1, advancedPlus: 2 } as const;
    return template.sections
      .map((s) => ({
        ...s,
        fields: s.fields.filter((f) => rank[level] >= minimum[f.depth ?? "all"]),
      }))
      .filter((section) => section.fields.length > 0);
  },

  completion(template: AssessmentTemplate, answers: AssessmentAnswers): number {
    const fields = template.sections.flatMap((s) => s.fields);
    const required = fields.filter((field) => field.required);
    const all = required.length ? required : fields;
    if (!all.length) return 0;
    const done = all.filter((f) => {
      const v = answers[f.id];
      return v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
    }).length;
    return done / all.length;
  },

  saveCommonDraft(draft: {
    answers: AssessmentAnswers;
    wearable?: { intent?: WearableIntent | undefined; providers: HealthProvider[] } | undefined;
  }) {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(COMMON_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage quota errors
    }
  },

  loadCommonDraft(): {
    answers?: AssessmentAnswers | undefined;
    wearable?: { intent?: WearableIntent | undefined; providers: HealthProvider[] } | undefined;
  } | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(COMMON_DRAFT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clearCommonDraft() {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(COMMON_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  },

  saveSportDraft(draft: {
    sport: SportId;
    level: ExperienceLevel;
    answers: AssessmentAnswers;
  }) {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(SPORT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore
    }
  },

  loadSportDraft(): {
    sport?: SportId;
    level?: ExperienceLevel;
    answers?: AssessmentAnswers;
  } | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.sessionStorage.getItem(SPORT_DRAFT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clearSportDraft() {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(SPORT_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  },

  /**
   * Loads the authenticated athlete's persisted assessment state from MySQL via `GET /api/assessment`.
   */
  async loadCurrentState(): Promise<PersistedAssessmentState> {
    try {
      const res = await fetch("/api/assessment", {
        method: "GET",
        credentials: "include",
      });
      if (res.status === 401) {
        return { ok: false, authenticated: false };
      }
      const json = (await res.json().catch(() => ({}))) as Partial<PersistedAssessmentState>;
      if (!res.ok || !json.ok) {
        return { ok: false, authenticated: res.status !== 401 };
      }
      return {
        ok: true,
        authenticated: true,
        ...json,
      };
    } catch {
      return { ok: false, authenticated: false };
    }
  },

  /**
   * Persists the Common Assessment + optional Body Analysis (Step 2) + Wearable Intake (Step 3)
   * for the currently authenticated session user. Never sends a hardcoded client athleteId.
   */
  async submitCommon(params: {
    templateId: string;
    answers: AssessmentAnswers;
    bodyAnalysis?: Partial<BodyAnalysisInput> | undefined;
    wearable?: { intent?: WearableIntent | undefined; providers?: HealthProvider[] | undefined } | undefined;
  }): Promise<SubmitAssessmentResult> {
    try {
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateId: params.templateId,
          answers: params.answers,
          bodyAnalysis: params.bodyAnalysis,
          wearable: params.wearable,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        assessment?: { assessmentId: string; athleteId: string };
      };

      if (res.status === 401) {
        return {
          ok: false,
          status: "unauthenticated",
          error: json.error ?? "برای ذخیره دائمی ارزیابی لازم است وارد حساب کاربری خود شوید.",
        };
      }

      if (!res.ok || !json.ok) {
        return {
          ok: false,
          status: "error",
          error: json.error ?? "ذخیره ارزیابی عمومی با خطا مواجه شد.",
        };
      }

      this.clearCommonDraft();
      return {
        ok: true,
        status: "submitted",
        assessmentId: json.assessment?.assessmentId,
        athleteId: json.assessment?.athleteId,
      };
    } catch {
      return {
        ok: false,
        status: "error",
        error: "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.",
      };
    }
  },

  /**
   * Persists a Sport-Specific Assessment for the currently authenticated session user.
   */
  async submitSport(params: {
    sport: SportId;
    experienceLevel: ExperienceLevel;
    templateId: string;
    answers: AssessmentAnswers;
  }): Promise<SubmitAssessmentResult> {
    try {
      const res = await fetch("/api/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateId: params.templateId,
          sport: params.sport,
          experienceLevel: params.experienceLevel,
          answers: params.answers,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        assessment?: { assessmentId: string; athleteId: string };
      };

      if (res.status === 401) {
        return {
          ok: false,
          status: "unauthenticated",
          error: json.error ?? "برای ذخیره ارزیابی تخصصی لازم است وارد حساب کاربری خود شوید.",
        };
      }

      if (!res.ok || !json.ok) {
        return {
          ok: false,
          status: "error",
          error: json.error ?? "ذخیره ارزیابی رشته ورزشی با خطا مواجه شد.",
        };
      }

      this.clearSportDraft();
      return {
        ok: true,
        status: "submitted",
        assessmentId: json.assessment?.assessmentId,
        athleteId: json.assessment?.athleteId,
      };
    } catch {
      return {
        ok: false,
        status: "error",
        error: "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.",
      };
    }
  },

  /**
   * Legacy signature retained for callers that pass `(templateId, answers)`.
   * Never trusts any client-passed athleteId; server derives athleteId from `fitlytix_session`.
   */
  async submit(_ignoredAthleteId: string, templateId: string, answers: AssessmentAnswers) {
    return this.submitCommon({ templateId, answers });
  },
};
