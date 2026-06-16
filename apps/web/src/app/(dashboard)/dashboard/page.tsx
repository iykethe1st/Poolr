import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageShell>
      <DashboardContent />
    </PageShell>
  );
}
