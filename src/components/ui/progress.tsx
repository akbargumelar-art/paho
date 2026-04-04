import * as React from "react"
import { cn } from "@/lib/utils"

function Progress({ className, value, ...props }: React.ComponentProps<"div"> & { value?: number }) {
  return (
    <div
      data-slot="progress"
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
        style={{ width: `${value || 0}%` }}
      />
    </div>
  )
}

export { Progress }
