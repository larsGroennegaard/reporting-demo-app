// app/layout.tsx
"use client";

import { useState } from 'react';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SideNav from "./components/SideNav";
import { cn } from '@/lib/utils';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// This part can be uncommented if you need static metadata
export const metadata: Metadata = {
   title: "Dreamdata Report Prototype",
   description: "A demo app for our LLM based new reporting prototype",
 };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex h-screen bg-gray-900 text-gray-300">
          <SideNav 
            isCollapsed={isSidebarCollapsed} 
            toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
          />
          <div className="w-px bg-gray-700" />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}