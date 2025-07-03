// app/components/PageLayout.tsx
"use client";

import { useState } from 'react';
import SideNav from "./SideNav";

export default function PageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <SideNav 
        isCollapsed={isSidebarCollapsed} 
        toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />
      <div className="w-px bg-border" />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}