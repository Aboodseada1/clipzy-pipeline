"use client";
import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitive.Provider;

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 pr-8 shadow-2xl",
  {
    variants: {
      variant: {
        default: "",
        success: "border-emerald-500/40",
        danger: "border-rose-500/40",
        warn: "border-amber-500/40",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn("fixed bottom-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 md:max-w-[380px]", className)}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-2", className)}
    {...props}
  />
));
Toast.displayName = "Toast";

function ToastTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <div className={cn("text-sm font-semibold", className)} {...props} />;
}
function ToastDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-xs text-[var(--color-muted)]", className)} {...props} />;
}

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "danger" | "warn";
};

const ToastCtx = React.createContext<{ push: (t: Omit<ToastItem, "id">) => void }>({ push: () => {} });

export function useToast() {
  return React.useContext(ToastCtx);
}

export function Toaster() {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      <ToastProvider duration={4000} swipeDirection="right">
        {items.map((t) => (
          <Toast key={t.id} variant={t.variant}>
            <div className="flex-1">
              <ToastTitle>{t.title}</ToastTitle>
              {t.description ? <ToastDescription>{t.description}</ToastDescription> : null}
            </div>
            <ToastPrimitive.Close className="absolute right-2 top-2 rounded p-1 text-[var(--color-muted)] hover:bg-[var(--color-panel-2)]">
              <X className="h-3.5 w-3.5" />
            </ToastPrimitive.Close>
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastCtx.Provider>
  );
}
