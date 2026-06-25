import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Pencil, Trash2, User } from "lucide-react";
import { useTask } from "@/hooks/useTasks";
import { formatDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/tasks/StatusBadge";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { DeleteTaskDialog } from "@/components/tasks/DeleteTaskDialog";

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: task, isLoading, isError } = useTask(id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
      <Link to="/tasks">
        <ArrowLeft className="size-4" />
        Back to tasks
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <div className="rounded-md border border-dashed bg-background py-16 text-center">
          <p className="font-medium">Task not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been deleted, or you don&apos;t have access to it.
          </p>
        </div>
      </div>
    );
  }

  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <CardTitle className="text-xl leading-snug">{task.title}</CardTitle>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleting(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium">Description</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {task.description || "No description provided."}
            </p>
          </div>

          <Separator />

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Assignee</dt>
              <dd className="mt-0.5 flex items-center gap-1.5">
                <User className="size-3.5" />
                {task.assignedTo?.name ?? "Unassigned"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Due date</dt>
              <dd
                className={cn(
                  "mt-0.5 flex items-center gap-1.5",
                  overdue && "font-medium text-destructive"
                )}
              >
                <CalendarDays className="size-3.5" />
                {formatDate(task.dueDate)}
                {overdue && " (overdue)"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created by</dt>
              <dd className="mt-0.5">{task.createdBy?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="mt-0.5">{formatDate(task.createdAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
      <DeleteTaskDialog
        task={deleting ? task : null}
        onOpenChange={(open) => !open && setDeleting(false)}
        onDeleted={() => navigate("/tasks")}
      />
    </div>
  );
}
