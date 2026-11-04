import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { LOCALE, faNumber } from "@/lib/locale";
import { cn } from "@/lib/utils";

/**
 * The product slideshow (spec P16), implementing the behaviour approved in the
 * P15 prototype: 7s autoplay, arrow keys, dots for jumping to a slide, a progress
 * bar, finger drag, pause on pointer hover - plus the counter and the explicit
 * pause button that the standing navigation rule requires.
 *
 * RTL NAVIGATION IS THE OPPOSITE OF THE LTR CONVENTION, AND THAT IS DELIBERATE.
 * The spec states it twice (lines 88-90 and 367): in right-to-left the LEFT
 * button advances and the RIGHT button goes back, and the arrow keys follow the
 * same mapping. components/ui/carousel.tsx does the reverse - it binds ArrowLeft
 * to scrollPrev, which is correct for LTR and wrong here. Nothing in the
 * repository imports that file; this component is the one the product uses.
 *
 * Placement uses logical properties rather than left/right so the mapping above
 * is a consequence of the document direction instead of a hardcoded guess:
 * inline-start is the right edge in RTL and the left edge in LTR, so "previous at
 * start, next at end" satisfies the spec today and would still be correct if the
 * locale ever flips.
 *
 * THE PROGRESS BAR FILLS FROM THE MINIMUM SIDE. The spec's range rule (line 368,
 * "کمینه در راست، بیشینه در چپ") applies to bars generally, so the fill grows
 * from the right edge in RTL. transform-origin has no logical keyword, so the
 * origin is chosen from LOCALE.dir explicitly.
 */

/** Round buttons are 46px on the slide edge, always visible - never hover-only. */
const BUTTON_PX = 46;

export type CarouselSlideItem = {
  id: string;
  content: React.ReactNode;
};

export function CarouselSlide({
  slides,
  autoMs = 7000,
  minHeight = 500,
  label = "نمایشِ اسلایدی",
  className,
}: {
  slides: CarouselSlideItem[];
  /** Autoplay interval in ms. 0 disables autoplay entirely. */
  autoMs?: number;
  minHeight?: number;
  /** Accessible name for the carousel region. */
  label?: string;
  className?: string | undefined;
}) {
  const rtl = LOCALE.dir === "rtl";
  const count = slides.length;

  const [emblaRef, api] = useEmblaCarousel({
    // A single slide has nothing to advance to; looping one slide fights the user.
    loop: count > 1,
    direction: rtl ? "rtl" : "ltr",
    align: "start",
  });

  const [index, setIndex] = React.useState(0);
  /** The user's own intent, toggled by the pause button. */
  const [wantsPlay, setWantsPlay] = React.useState(true);
  const [hovering, setHovering] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const barRef = React.useRef<HTMLDivElement | null>(null);

  /* Keep the rendered index in step with whatever embla settled on, including
     changes made by dragging or by the arrow keys. */
  React.useEffect(() => {
    if (!api) return;
    const onSelect = () => setIndex(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  /* Honour the platform's motion preference: a slideshow that advances by itself
     is exactly the kind of thing this setting exists to suppress. */
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const running = wantsPlay && !hovering && !focused && !reducedMotion && count > 1 && autoMs > 0;

  /* Autoplay and the progress bar share one clock so they can never disagree.
     The bar is driven through a ref instead of state: writing transform at 60fps
     through React would re-render the whole slide tree every frame, and the slide
     content can be expensive. The effect re-runs on `index`, which is what resets
     the bar after any navigation, automatic or manual. */
  React.useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    if (!running || !api) {
      bar.style.transform = "scaleX(0)";
      return;
    }

    let frame = 0;
    let startedAt = 0;
    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / autoMs);
      bar.style.transform = `scaleX(${progress})`;
      if (progress >= 1) {
        api.scrollNext();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, api, autoMs, index]);

  const goNext = React.useCallback(() => api?.scrollNext(), [api]);
  const goPrev = React.useCallback(() => api?.scrollPrev(), [api]);
  const goTo = React.useCallback((target: number) => api?.scrollTo(target), [api]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (count < 2) return;
    // In RTL, ArrowLeft advances and ArrowRight goes back (spec lines 89-90).
    const nextKey = rtl ? "ArrowLeft" : "ArrowRight";
    const prevKey = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === nextKey) {
      event.preventDefault();
      goNext();
    } else if (event.key === prevKey) {
      event.preventDefault();
      goPrev();
    }
  };

  // A slideshow with nothing in it is a caller mistake, not a state to render.
  if (count === 0) return null;

  const single = count === 1;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;

  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl border border-border bg-card", className)}
      style={{ minHeight }}
      dir={LOCALE.dir}
    >
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={() => setFocused(false)}
        className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-carousel-root=""
        data-carousel-playing={running}
        data-carousel-dir={LOCALE.dir}
      >
        {/* aria-live is off while the slides advance on their own and polite once
            the user has taken control, per the W3C carousel pattern: a region that
            announces itself every seven seconds is unreadable with a screen reader. */}
        <div ref={emblaRef} className="w-full" aria-live={running ? "off" : "polite"}>
          <div className="flex">
            {slides.map((slide, position) => (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`اسلایدِ ${faNumber(position + 1)} از ${faNumber(count)}`}
                aria-hidden={position !== index}
                className="min-w-0 shrink-0 grow-0 basis-full"
                data-carousel-slide={slide.id}
              >
                {slide.content}
              </div>
            ))}
          </div>
        </div>

        {/* Scrim, so the controls stay legible over any slide content. Written as
            an inline gradient rather than a utility class: Tailwind 4 renamed
            bg-gradient-to-t to bg-linear-to-t and a guessed class name compiles to
            nothing at all. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
          style={{ backgroundImage: "linear-gradient(to top, var(--background) 8%, transparent)" }}
        />

        {/* Edge buttons. Always rendered, never gated on hover, and positioned with
            logical properties: start = previous, end = next. */}
        {!single && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="اسلایدِ قبلی"
              data-carousel-prev=""
              className="glass absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full text-foreground transition hover:bg-card-elevated hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              style={{ insetInlineStart: "0.75rem", width: BUTTON_PX, height: BUTTON_PX }}
            >
              <PrevIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="اسلایدِ بعدی"
              data-carousel-next=""
              className="glass absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full text-foreground transition hover:bg-card-elevated hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              style={{ insetInlineEnd: "0.75rem", width: BUTTON_PX, height: BUTTON_PX }}
            >
              <NextIcon className="size-5" />
            </button>
          </>
        )}

        {/* Dots, counter and pause. */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-1.5" data-carousel-dots="">
            {slides.map((slide, position) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(position)}
                aria-label={`برو به اسلایدِ ${faNumber(position + 1)}`}
                aria-current={position === index}
                data-carousel-dot={position === index ? "active" : "idle"}
                className={cn(
                  "h-2 rounded-full transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  position === index
                    ? "bg-primary"
                    : "bg-muted-foreground/40 hover:bg-muted-foreground/70",
                )}
                style={{ width: position === index ? 22 : 8 }}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="num text-xs text-muted-foreground" data-carousel-counter="">
              {faNumber(index + 1)} / {faNumber(count)}
            </span>
            {!single && (
              <button
                type="button"
                onClick={() => setWantsPlay((value) => !value)}
                aria-label={wantsPlay ? "توقفِ پخشِ خودکار" : "ادامه‌یِ پخشِ خودکار"}
                aria-pressed={!wantsPlay}
                data-carousel-pause={wantsPlay ? "playing" : "paused"}
                className="flex size-8 items-center justify-center rounded-full border border-border bg-muted/60 text-muted-foreground transition hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {wantsPlay ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar, sharing the autoplay clock. Fills from the minimum side. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 z-10 h-[3px] bg-border"
          data-carousel-progress-track=""
        >
          <div
            ref={barRef}
            className="bg-gradient-ember h-full"
            style={{ transform: "scaleX(0)", transformOrigin: rtl ? "right" : "left" }}
            data-carousel-progress=""
          />
        </div>
      </div>
    </div>
  );
}
