"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] no-tap",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-brand)] text-white hover:brightness-110 shadow-lg shadow-[var(--color-brand)]/20",
        secondary: "bg-[var(--color-panel-2)] text-[var(--color-text)] hover:bg-[var(--color-border)]",
        outline: "border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-panel-2)]",
        ghost: "hover:bg-[var(--color-panel-2)] text-[var(--color-text)]",
        danger: "bg-[var(--color-danger)] text-white hover:brightness-110",
        success: "bg-[var(--color-accent)] text-[var(--color-base)] hover:brightness-110",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
Button.displayName = "Button";

export { buttonVariants };
