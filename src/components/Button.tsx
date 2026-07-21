import type { ReactNode } from "react";

type ButtonProps = {
  href?: string;
  children: ReactNode;
  variant?: "rosa" | "soft" | "olive";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
};

export function Button({
  href,
  children,
  variant = "rosa",
  className = "",
  onClick,
  type = "button",
}: ButtonProps) {
  const styles =
    variant === "rosa"
      ? "bg-rosa text-white shadow-[0_12px_28px_rgba(196,91,134,0.28)] hover:bg-rosa-deep"
      : variant === "olive"
        ? "bg-olive text-white shadow-[0_10px_24px_rgba(111,129,100,0.25)] hover:brightness-95"
        : "bg-sand/90 text-ink hover:bg-sand";

  const cls = `inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.12em] transition duration-300 hover:scale-[1.02] active:scale-[0.98] ${styles} ${className}`;

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className={cls}
      >
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
