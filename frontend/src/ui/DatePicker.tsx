import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./cn";

/* Ngay luon o dang chuoi "YYYY-MM-DD", khong dung Date cho gia tri.
   Date luon keo theo mui gio: `new Date("2026-01-01")` la 00:00 UTC, o Viet Nam
   doc ra van la 01/01 nhung o mui gio am se thanh 31/12. Voi ngay-thang-nam
   thuan tuy thi chuoi la kieu du lieu dung. */
export type DateString = string;

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function toDateString(year: number, month: number, day: number): DateString {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parse(value: DateString | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month: month - 1, day };
}

/** Hien thi kieu Viet Nam: 05/03/2026. */
export function formatDate(value: DateString | undefined): string {
  const parsed = parse(value);
  if (!parsed) return "";
  return `${String(parsed.day).padStart(2, "0")}/${String(parsed.month + 1).padStart(2, "0")}/${parsed.year}`;
}

/** Thu trong tuan cua ngay 1, quy ve thu Hai = 0 (lich Viet Nam bat dau tu thu Hai). */
function firstWeekdayOffset(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export type DatePickerProps = {
  value?: DateString;
  onChange: (value: DateString) => void;
  /** Gioi han duoi/tren, cung dang "YYYY-MM-DD". */
  min?: DateString;
  max?: DateString;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Chọn ngày",
  disabled,
  invalid,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const now = new Date();
    return toDateString(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const selected = parse(value);
  const [view, setView] = useState(() => {
    const base = selected ?? parse(today)!;
    return { year: base.year, month: base.month };
  });

  // Mo lai lich thi nhay ve thang cua ngay dang chon, khong giu thang cu.
  useEffect(() => {
    if (!open) return;
    const base = parse(value) ?? parse(today)!;
    setView({ year: base.year, month: base.month });
  }, [open, value, today]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const shiftMonth = (delta: number) => {
    setView((current) => {
      const month = current.month + delta;
      // Chia lay du de tu nhay nam khi vuot qua thang 12 hoac lui truoc thang 1.
      return {
        year: current.year + Math.floor(month / 12),
        month: ((month % 12) + 12) % 12,
      };
    });
  };

  const offset = firstWeekdayOffset(view.year, view.month);
  const total = daysInMonth(view.year, view.month);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-ui border border-border bg-surface px-3 text-left sm:h-10",
          "text-base sm:pointer-fine:text-sm",
          "outline-none transition focus:border-primary focus:ring-2 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-60",
          invalid && "border-danger",
          value ? "text-fg" : "text-fg-muted",
        )}
      >
        {value ? formatDate(value) : placeholder}
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 text-fg-muted">
          <rect x="3" y="4.5" width="14" height="12" rx="2" />
          <path d="M3 8h14M7 3v3m6-3v3" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Chọn ngày"
          style={{ animation: "ui-slide-down 120ms ease-out" }}
          className="absolute left-0 z-50 mt-1 w-72 rounded-ui border border-border bg-surface p-3 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Tháng trước"
              className="grid h-8 w-8 place-items-center rounded-ui text-fg-muted transition hover:bg-surface-muted"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-fg">
              Tháng {view.month + 1} / {view.year}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Tháng sau"
              className="grid h-8 w-8 place-items-center rounded-ui text-fg-muted transition hover:bg-surface-muted"
            >
              ›
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-1 text-center text-[11px] font-medium text-fg-muted">
                {weekday}
              </div>
            ))}

            {/* O trong lap cho den dung thu cua ngay mung 1. */}
            {Array.from({ length: offset }, (_, index) => (
              <div key={`pad-${index}`} />
            ))}

            {Array.from({ length: total }, (_, index) => {
              const day = index + 1;
              const date = toDateString(view.year, view.month, day);
              const isSelected = date === value;
              const isToday = date === today;
              // So sanh chuoi "YYYY-MM-DD" la du: dinh dang nay xep thu tu chu
              // cai trung voi thu tu thoi gian.
              const isDisabled = Boolean((min && date < min) || (max && date > max));

              return (
                <button
                  key={date}
                  type="button"
                  disabled={isDisabled}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(date);
                    setOpen(false);
                  }}
                  className={cn(
                    "grid h-9 place-items-center rounded-ui text-sm tabular outline-none transition",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:pointer-events-none disabled:opacity-30",
                    isSelected
                      ? "bg-primary font-semibold text-primary-fg"
                      : "text-fg hover:bg-surface-muted",
                    !isSelected && isToday && "font-semibold text-primary",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(today);
              setOpen(false);
            }}
            className="mt-2 w-full rounded-ui py-2 text-sm font-medium text-primary transition hover:bg-surface-muted"
          >
            Hôm nay
          </button>
        </div>
      )}
    </div>
  );
}
