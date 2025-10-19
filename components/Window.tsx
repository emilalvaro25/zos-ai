/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useEffect, useState} from 'react';

interface WindowProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isAppOpen: boolean;
  appId?: string | null;
  onToggleParameters: () => void;
  onExitToDesktop: () => void;
  isParametersPanelOpen?: boolean;
  animationState?: 'idle' | 'opening' | 'closing';
  animationOrigin?: { top: number; left: number } | null;
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
  animationState,
  animationOrigin,
}) => {
  const [isAnimatingOpen, setIsAnimatingOpen] = useState(false);

  useEffect(() => {
    if (animationState === 'opening') {
      const timer = requestAnimationFrame(() => {
        setIsAnimatingOpen(true);
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setIsAnimatingOpen(false);
    }
  }, [animationState]);
  
  const getWrapperStyle = (): React.CSSProperties => {
    const centeredStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%) scale(1)',
      opacity: 1,
    };

    if (!animationOrigin) {
      return centeredStyle;
    }

    const fromOriginStyle = {
      top: `${animationOrigin.top}px`,
      left: `${animationOrigin.left}px`,
      transform: 'translate(-50%, -50%) scale(0.1)',
      opacity: 0,
    };

    if (animationState === 'opening') {
      return isAnimatingOpen ? centeredStyle : fromOriginStyle;
    }
    if (animationState === 'closing') {
      return fromOriginStyle;
    }
    return centeredStyle; // idle
  };


  return (
    <div
      style={getWrapperStyle()}
      className="fixed transition-all duration-500 ease-in-out z-10 w-full h-full md:w-[800px] md:h-[600px] p-0 md:p-[12px]"
      >
      <div 
        className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 shadow-none md:shadow-2xl md:shadow-cyan-500/10 window-shape"
      >
        {/* Inner Bevel */}
        <div 
          className="absolute inset-0 md:inset-[11px] border-black/50 border-none md:border inner-bevel-shape"
        ></div>
        {/* Main Frame */}
        <div 
          className="w-full h-full flex flex-col bg-gray-900/80 border-gray-600/50 border-none md:border main-frame-shape font-sans"
        >
          {/* Responsive Header */}
          <div className="border-b border-gray-700 select-none flex-shrink-0 bg-black/20">
            {/* Mobile Header: visible on small screens */}
            <div className="md:hidden flex items-center justify-between h-14 px-4">
                <span 
                  className="font-semibold text-lg text-cyan-300"
                  style={{ textShadow: '0 0 5px rgba(0, 255, 255, 0.7)' }}
                >
                  {title}
                </span>
                <div className="flex items-center gap-2">
                  {!isParametersPanelOpen && (
                    <button onClick={onToggleParameters} className="window-header-icon" aria-label="Parameters">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                  )}
                  {(isAppOpen || isParametersPanelOpen) && (
                    <button onClick={isParametersPanelOpen ? onToggleParameters : onExitToDesktop} className="window-header-icon" aria-label="Close">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
            </div>

            {/* Desktop Header: hidden on small screens */}
            <div className="hidden md:block">
              {/* Title Bar */}
              <div className="text-cyan-300 py-2 px-8 font-semibold text-base flex justify-between items-center cursor-default">
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
              <div className="py-2 px-4 border-t border-gray-700 flex gap-4 text-sm text-gray-400 items-center">
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
                 {isParametersPanelOpen && (
                  <MenuItem onClick={onToggleParameters} className="ml-auto">
                    Close Parameters
                  </MenuItem>
                )}
              </div>
            </div>
          </div>


          {/* Content */}
          <div className="flex-grow overflow-hidden relative">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
