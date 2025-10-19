/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React from 'react';

interface WindowProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isAppOpen: boolean;
  appId?: string | null;
  onToggleParameters: () => void;
  onExitToDesktop: () => void;
  isParametersPanelOpen?: boolean;
}

const MenuItem: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({children, onClick, className}) => (
  <span
    className={`menu-item cursor-pointer hover:text-cyan-400 transition-colors ${className}`}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onClick?.();
    }}
    tabIndex={0}
    role="button">
    {children}
  </span>
);

export const Window: React.FC<WindowProps> = ({
  title,
  children,
  onClose,
  isAppOpen,
  onToggleParameters,
  onExitToDesktop,
  isParametersPanelOpen,
}) => {
  return (
    <div 
      className="w-full h-full md:w-[800px] md:h-[600px] flex flex-col relative font-sans p-0 md:p-[12px] bg-gradient-to-br from-gray-700 to-gray-900 shadow-none md:shadow-2xl md:shadow-cyan-500/10 window-shape"
    >
      {/* Inner Bevel */}
      <div 
        className="absolute inset-0 md:inset-[11px] border-black/50 border-none md:border inner-bevel-shape"
      ></div>
      {/* Main Frame */}
      <div 
        className="w-full h-full flex flex-col bg-gray-900/80 border-gray-600/50 border-none md:border main-frame-shape"
      >
        {/* Title Bar */}
        <div className="text-cyan-300 py-2 px-4 md:px-8 font-semibold text-base flex justify-between items-center select-none cursor-default flex-shrink-0">
          <span 
            className="title-bar-text uppercase tracking-widest"
            style={{
              textShadow: '0 0 5px rgba(0, 255, 255, 0.7)'
            }}
          >
            {title}
          </span>
        </div>

        {/* Menu Bar */}
        <div className="py-2 px-4 border-y border-gray-700 select-none flex gap-4 flex-shrink-0 text-sm text-gray-400 items-center bg-black/20">
          {!isParametersPanelOpen && (
            <MenuItem onClick={onToggleParameters}>
              <u>P</u>arameters
            </MenuItem>
          )}
          {isAppOpen && (
            <MenuItem onClick={onExitToDesktop} className="ml-auto">
              Exit to Desktop
            </MenuItem>
          )}
        </div>

        {/* Content */}
        <div className="flex-grow overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
};