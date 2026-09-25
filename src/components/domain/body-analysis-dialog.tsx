import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { bodyAnalysisService } from "@/services/body-analysis/service";
import { BodyAnalysisIntake, emptyBodyIntake, toBodyInput, type BodyIntakeState } from "./body-analysis";

export function zodErrors(issues: { path: (string | number)[]; message: string }[]) {
  return Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
}

export function AddBodyAnalysisDialog({ open, onOpenChange, athleteId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; athleteId: string; onSaved: () => void }) {
  const [state, setState] = useState<BodyIntakeState>(() => ({ ...emptyBodyIntake(), mode: "has" }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = () => {
    const parsed = bodyAnalysisService.validate(toBodyInput(state));
    if (!parsed.success) return setErrors(zodErrors(parsed.error.issues));
    bodyAnalysisService.add(athleteId, parsed.data);
    setErrors({});
    setState({ ...emptyBodyIntake(), mode: "has" });
    onSaved();
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir="rtl">
        <DialogHeader className="text-start"><DialogTitle>ثبت اندازه‌گیری جدید</DialogTitle><DialogDescription>یک رکورد تازه اضافه می‌شود؛ اندازه‌گیری‌های قبلی دست نمی‌خورند.</DialogDescription></DialogHeader>
        <BodyAnalysisIntake state={state} onChange={(s) => setState({ ...s, mode: "has" })} errors={errors} />
        <Button variant="hero" onClick={save}>ذخیره اندازه‌گیری</Button>
      </DialogContent>
    </Dialog>
  );
}
