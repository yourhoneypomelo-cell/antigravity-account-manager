import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex gap-1.5 items-center justify-center whitespace-nowrap rounded-md text-[13px] font-normal transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none active:scale-[0.98] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover hover:shadow-sm hover:brightness-[1.03] active:bg-primary-active active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:brightness-105 hover:shadow-[0_2px_8px_rgba(220,38,38,0.25)] active:scale-[0.98]",
        outline:
          "border border-border bg-input shadow-xs hover:bg-accent hover:border-control-hover hover:shadow-sm active:bg-control-pressed active:scale-[0.98] text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border border-border-subtle shadow-xs hover:border-control-hover hover:bg-accent hover:shadow-sm active:bg-control-pressed active:scale-[0.98]",
        ghost:
          "hover:bg-accent hover:text-foreground active:bg-control-pressed active:scale-[0.97] text-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        subtle:
          "border border-border-subtle bg-transparent text-muted-foreground hover:text-foreground hover:bg-accent hover:border-control-hover hover:shadow-xs active:scale-[0.98]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        xs: "h-7 rounded px-2 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-8 w-8 p-0",
        "icon-sm": "h-7 w-7 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
