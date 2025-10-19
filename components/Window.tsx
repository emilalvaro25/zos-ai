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
          <div className="py-2 px-2 md:px-4 border-y border-gray-700 select-none flex gap-2 md:gap-4 flex-shrink-0 text-xs md:text-sm text-gray-400 items-center bg-black/20">
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
    </div>
  );
};
