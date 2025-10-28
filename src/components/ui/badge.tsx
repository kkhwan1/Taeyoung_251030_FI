import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-gray-400 dark:focus-visible:border-gray-500 focus-visible:ring-gray-400/50 dark:focus-visible:ring-gray-500/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 [a&]:hover:bg-gray-200 dark:[a&]:hover:bg-gray-700",
        secondary:
          "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-200 [a&]:hover:bg-gray-100 dark:[a&]:hover:bg-gray-800",
        destructive:
          "border-2 border-destructive bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 [a&]:hover:bg-gray-100 dark:[a&]:hover:bg-gray-800 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 [a&]:hover:bg-gray-100 dark:[a&]:hover:bg-gray-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
