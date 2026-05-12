import React, { useState, useEffect } from 'react';
import { useTranslation } from '../contexts/I18nContext';

export default function TitleBar() {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.electronAPI.window.isMaximized().then(setIsMaximized);
  }, []);

  const handleMinimize = () => window.electronAPI.window.minimize();
  const handleMaximize = async () => {
    await window.electronAPI.window.maximize();
    const maximized = await window.electronAPI.window.isMaximized();
    setIsMaximized(maximized);
  };
  const handleClose = () => window.electronAPI.window.close();

  return (
    <div
      className="h-8 w-full bg-surface-container-lowest border-b border-outline-variant/30 flex items-center justify-between px-3 z-50 shrink-0 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 w-1/3">
        <span
          className="material-symbols-outlined text-primary"
          style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
        >
          straighten
        </span>
        <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-tight">
          V{__APP_VERSION__}
        </span>
      </div>

      <div className="flex-1 text-center">
        <h1 className="text-xs font-bold text-on-surface font-headline">
          {t('Etiquette Tailor')}
        </h1>
      </div>

      <div
        className="flex items-center justify-end w-1/3 space-x-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="w-10 h-8 flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            remove
          </span>
        </button>
        <button
          onClick={handleMaximize}
          className="w-10 h-8 flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            {isMaximized ? 'filter_none' : 'check_box_outline_blank'}
          </span>
        </button>
        <button
          onClick={handleClose}
          className="w-10 h-8 flex items-center justify-center hover:bg-error hover:text-on-primary text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            close
          </span>
        </button>
      </div>
    </div>
  );
}
