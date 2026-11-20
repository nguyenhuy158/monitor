import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

export type MenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** To do cho hanh dong xoa / khong hoan tac duoc. */
  destructive?: boolean;
  disabled?: boolean;
};

export type MenuProps = {
  /** Nut mo menu. Nhan onClick tu Menu, thuong la mot <Button size="icon">. */
  trigger: (props: { onClick: () => void; "aria-expanded": boolean }) => ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  className?: string;
};

/** Menu tha xuong. Dong khi bam ra ngoai, bam Esc, hoac chon mot muc. */
export function Menu({ trigger, items, align = "right", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    // pointerdown chu khong phai click: dong ngay khi vua cham, khong doi nha tay.
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger({ onClick: () => setOpen((value) => !value), "aria-expanded": open })}

      {open && (
        <div
          role="menu"
          style={{ animation: "ui-slide-down 120ms ease-out" }}
          className={cn(
            "absolute z-50 mt-1 min-w-48 overflow-hidden rounded-ui border border-border bg-surface py-1.5 shadow-xl ring-1 ring-black/5",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2 text-left text-sm outline-none transition",
                "hover:bg-surface-muted focus-visible:bg-surface-muted",
                "disabled:pointer-events-none disabled:opacity-50",
                item.destructive ? "text-danger" : "text-fg",
              )}
            >
              {item.icon && <span className="shrink-0 opacity-70">{item.icon}</span>}
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
