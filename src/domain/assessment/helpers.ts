import type { AssessmentField, AssessmentOption } from "../types";

export const options = (...labels: string[]): AssessmentOption[] =>
  labels.map((label, index) => ({ value: `option_${index + 1}`, label }));

export const unknownOption: AssessmentOption = { value: "unknown", label: "نمی‌دونم / تا حالا تست نکردم" };

export const field = (value: AssessmentField): AssessmentField => value;