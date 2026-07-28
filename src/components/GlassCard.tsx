import clsx from "clsx";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  level?: 1 | 2 | 3 | "solid";
  className?: string;
  onClick?: () => void;
  hairline?: boolean;
}

const levelClass = {
  1: "glass-1",
  2: "glass-2",
  3: "glass-3",
  solid: "glass-solid",
} as const;

export default function GlassCard({ children, level = 2, className, onClick, hairline }: Props) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        levelClass[level],
        "rounded-card shadow-card",
        hairline && "hairline-top overflow-hidden",
        onClick && "active:scale-[0.98] transition-transform cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}
