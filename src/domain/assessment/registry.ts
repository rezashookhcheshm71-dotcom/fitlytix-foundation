import type { AssessmentTemplate, SportId } from "../types";
import { BODYBUILDING_ASSESSMENT } from "./bodybuilding";
import { COMMON_ASSESSMENT } from "./common";
import { CROSSFIT_ASSESSMENT } from "./crossfit";
import { FUNCTIONAL_ASSESSMENT } from "./functional";
import { HYROX_ASSESSMENT } from "./hyrox";
import { RUNNING_ASSESSMENT } from "./running";

export { COMMON_ASSESSMENT };

export const SPORT_ASSESSMENTS: Record<SportId, AssessmentTemplate> = {
  crossfit: CROSSFIT_ASSESSMENT,
  bodybuilding: BODYBUILDING_ASSESSMENT,
  hyrox: HYROX_ASSESSMENT,
  functional: FUNCTIONAL_ASSESSMENT,
  running: RUNNING_ASSESSMENT,
};