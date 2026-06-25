import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import { useDeleteTask } from "@/hooks/useTasks";
import type { Task } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteTaskDialog({ task, onOpenChange, onDeleted }: Props) {
  const deleteTask = useDeleteTask();

  const handleDelete = async () => {
    if (!task) return;
    try {
      await deleteTask.mutateAsync(task._id);
      toast.success("Task deleted");
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <AlertDialog open={Boolean(task)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete{" "}
            <strong>{task?.title}</strong>. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleteTask.isPending}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
