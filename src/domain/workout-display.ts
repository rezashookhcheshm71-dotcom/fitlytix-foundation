import type { WorkoutMovement } from "./types";

export function readableScheme(scheme: string): string {
  const sets = scheme.match(/^(\d+)\s*[×xX]\s*(\d+)(?:\/leg)?$/);
  if (sets)
    return `${sets[1]} ست، هر ست ${sets[2]} تکرار${scheme.includes("/leg") ? " برای هر پا" : ""}`;
  const minutes = scheme.match(/^(\d+) min(?: easy)?$/i);
  if (minutes) return `${minutes[1]} دقیقه${scheme.toLowerCase().includes("easy") ? " آرام" : ""}`;
  const meters = scheme.match(/^(\d+)\s*[×xX]\s*(\d+)\s*m$/i);
  if (meters) return `${meters[1]} بار، هر بار ${meters[2]} متر`;
  const interval = scheme.match(/^(\d+):(\d+)\s*@\s*(\d+)%$/);
  if (interval) return `${interval[1]} دقیقه${interval[2] === "00" ? "" : ` و ${interval[2]} ثانیه`} با حدود ${interval[3]}٪ توان`;
  const minuteRep = scheme.match(/^(odd|even):\s*(\d+)\s*(reps|m)$/i);
  if (minuteRep) return `${minuteRep[1] === "odd" ? "دقیقه‌های فرد" : "دقیقه‌های زوج"}: ${minuteRep[2]} ${minuteRep[3] === "m" ? "متر" : "تکرار"}`;
  const seconds = scheme.match(/^(\d+):(\d+)$/);
  if (seconds) return `${seconds[1]} دقیقه و ${seconds[2]} ثانیه`;
  if (scheme === "21-15-9") return "سه دور: ۲۱، ۱۵ و ۹ تکرار";
  return scheme.replace(/\bmin\b/gi, "دقیقه").replace(/\breps\b/gi, "تکرار").replace(/\brest\b/gi, "استراحت");
}

export function readableTempo(notes?: string) {
  const code = notes?.match(/tempo\s+([0-9Xx]{4})/i)?.[1]?.toUpperCase();
  if (!code) return undefined;
  const [down, pause, up, top] = code;
  return `${down} ثانیه پایین برو، ${pause} ثانیه مکث کن، ${up === "X" ? "سریع" : `${up} ثانیه`} بالا بیا، ${top} ثانیه مکث کن`;
}

export function readableLoad(movement: WorkoutMovement) {
  return movement.load?.replace(/\bkg\b/g, "کیلوگرم").replace(/\bDB\b/g, "دمبل");
}
