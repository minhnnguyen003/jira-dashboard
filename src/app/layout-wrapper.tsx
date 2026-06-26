'use client';

import { useState } from 'react';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mainMargin = sidebarCollapsed ? 56 : 224;

  return (
    <>
      <div style={{ width: sidebarCollapsed ? 56 : 224, transition: 'width 0.2s' }}>
        {children}
      </div>
      <main style={{ marginLeft: mainMargin }} className="flex-1 flex flex-col h-screen overflow-y-auto transition-all duration-200">
        {children}
      </main>
    </>
  );
}
