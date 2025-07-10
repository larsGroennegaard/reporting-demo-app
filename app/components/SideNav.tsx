//  app/components/SideNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, LayoutDashboard, ChevronsLeft, ChevronsRight, MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/ask", label: "Ask", icon: MessageCircleQuestion },
  { href: "/reports", label: "Reports", icon: BarChart2 },
  { href: "/dashboards", label: "Dashboards", icon: LayoutDashboard },
];

interface SideNavProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
}

export default function SideNav({ isCollapsed, toggleSidebar }: SideNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn(
        "relative bg-gray-800 p-4 flex flex-col shadow-lg transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
    )}>
        <div className="flex items-center justify-between pb-6 border-b border-gray-700">
            <h1 className={cn("text-2xl font-bold text-white whitespace-nowrap", isCollapsed && "sr-only")}>Dreamdata</h1>
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8">
                {isCollapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
            </Button>
        </div>

      <ul className="space-y-2 flex-grow pt-4">
        {navLinks.map((link) => {
          const isActive = pathname.startsWith(link.href) && (link.href !== '/' || pathname === '/');
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white",
                  isCollapsed && "justify-center"
                )}
              >
                <link.icon className="h-5 w-5 shrink-0" />
                <span className={cn("truncate", isCollapsed && "sr-only")}>{link.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}