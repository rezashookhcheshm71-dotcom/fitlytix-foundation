import { BookOpen, VideoOff } from "lucide-react";
import type { ExerciseEducation } from "@/domain/exercise-education";
import { exerciseContextLabel } from "@/domain/exercise-education";
import type { SportId } from "@/domain/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function GuideBody({
  exercise,
  sport,
  close,
}: {
  exercise: ExerciseEducation;
  sport: SportId;
  close: () => void;
}) {
  return (
    <div className="space-y-5 pb-5 text-sm leading-7">
      <p className="text-muted-foreground">{exercise.shortDescription}</p>
      <section>
        <h3 className="mb-2 font-bold text-foreground">این حرکت رو چطور انجام بدی؟</h3>
        <ol className="list-decimal space-y-1 ps-6 marker:text-primary">
          {exercise.howToSteps?.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section>
        <h3 className="mb-2 font-bold">حواست به اینا باشه</h3>
        <ul className="list-disc space-y-1 ps-6 marker:text-primary">
          {exercise.coachingCues?.map((cue) => (
            <li key={cue}>{cue}</li>
          ))}
        </ul>
      </section>
      {exercise.breathingCue && (
        <p className="border-s-2 border-primary/50 ps-3">تنفس: {exercise.breathingCue}</p>
      )}
      <section>
        <h3 className="mb-2 font-bold">اشتباه‌های رایج</h3>
        <ul className="list-disc space-y-1 ps-6 marker:text-muted-foreground">
          {exercise.commonMistakes?.map((mistake) => (
            <li key={mistake}>{mistake}</li>
          ))}
        </ul>
      </section>
      <p className="text-muted-foreground">{exerciseContextLabel[sport]}</p>
      {exercise.primaryMuscles?.length ? (
        <p>عضله‌های درگیر: {exercise.primaryMuscles.join("، ")}</p>
      ) : null}
      {exercise.easierOption && (
        <p className="rounded-md bg-secondary p-3">
          <strong>اگر برات سخته: </strong>
          {exercise.easierOption}
        </p>
      )}
      {exercise.harderOption && (
        <p>
          <strong>اگر می‌خوای سخت‌ترش کنی: </strong>
          {exercise.harderOption}
        </p>
      )}
      {exercise.safetyNote && (
        <p className="border-s-2 border-warning ps-3">{exercise.safetyNote}</p>
      )}
      <div className="flex min-h-16 items-center gap-3 rounded-md border border-dashed border-border px-4 text-muted-foreground">
        <VideoOff className="size-5 shrink-0" />
        ویدیوی آموزش این حرکت به‌زودی اضافه می‌شود
      </div>
      <Button variant="outline" onClick={close} className="w-full">
        بستن آموزش
      </Button>
    </div>
  );
}

export function ExerciseGuide({
  exercise,
  sport,
  open,
  onOpenChange,
}: {
  exercise?: ExerciseEducation;
  sport: SportId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!exercise) return null;
  const title = exercise.nameFa || exercise.name;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="bottom-0 top-auto max-h-[90dvh] translate-y-0 overflow-y-auto rounded-t-lg text-start md:bottom-auto md:top-1/2 md:max-h-[85dvh] md:-translate-y-1/2 md:rounded-lg"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>آموزش حرکت · {exercise.name}</DialogDescription>
        </DialogHeader>
        <GuideBody exercise={exercise} sport={sport} close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
