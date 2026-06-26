import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types";

interface Props {
  status: TaskStatus;
  count: number;
  children: ReactNode;
}

export function KanbanColumn({ status, count, children }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40 transition-colors",
        isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <span className="text-sm font-medium">{status}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {count === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No tasks
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
