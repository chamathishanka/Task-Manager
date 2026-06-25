import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Dashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Overview coming soon</CardTitle>
          <CardDescription>
            Stats, charts, and overdue summaries land in a later phase. For now,
            head to <strong>Tasks</strong> to manage your work.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This page will show task counts by status and priority, overdue
          highlights, and (for admins) a team activity summary.
        </CardContent>
      </Card>
    </div>
  );
}
