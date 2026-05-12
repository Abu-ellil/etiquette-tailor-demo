import React, { useEffect, useState } from 'react';

interface DemoWatermarkProps {
  children: React.ReactNode;
}

export default function DemoWatermark({ children }: DemoWatermarkProps) {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    async function checkDemo() {
      const status = await window.electronAPI.license.getStatus();
      setIsDemo(status.isDemo);
    }
    checkDemo();
  }, []);

  if (!isDemo) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {children}
      <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center opacity-5">
        <div className="transform -rotate-45 text-center">
          <div className="text-6xl font-bold text-red-600 border-4 border-red-600 rounded-lg px-8 py-4 inline-block">
            DEMO VERSION
          </div>
          <div className="text-2xl text-red-600 mt-2 font-semibold">
            For Portfolio Showcase Only
          </div>
          <div className="text-lg text-red-600 mt-1">
            Not for Commercial Use
          </div>
        </div>
      </div>
    </div>
  );
}
