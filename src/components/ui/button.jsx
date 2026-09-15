import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva("", {
  variants: {
    variant: {
      primary: "primary-button",
      secondary: "secondary-button",
      danger: "danger-button",
      text: "text-button",
    },
  },
  defaultVariants: { variant: "primary" },
});

export function Button({
  asChild = false,
  className,
  variant,
  type = "button",
  ...props
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
}
