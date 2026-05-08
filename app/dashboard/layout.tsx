import type { ReactNode } from "react";
import { GlobalCartWidget } from "@/components/global-cart-widget";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen">
      <GlobalCartWidget />
      {children}
    </div>
  );
}
