/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import React, {useCallback, useEffect, useState} from 'react';
import {GeneratedContent} from './components/GeneratedContent';
import {Icon} from './components/Icon';
import {ParametersPanel} from './components/ParametersPanel';
import {Window} from './components/Window';
import {APP_DEFINITIONS_CONFIG, INITIAL_MAX_HISTORY_LENGTH} from './constants';
import {streamAppContent} from './services/geminiService';
import {AppDefinition, InteractionData, TranscriptionEntry} from './types';
import { LiveAssistant } from './components/LiveAssistant';

const DesktopView: React.FC<{
  onAppOpen: (
    app: AppDefinition,
    event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ) => void;
}> = ({onAppOpen}) => (
  <div className="flex flex-wrap content-start justify-start p-2 md:p-4">
    {APP_DEFINITIONS_CONFIG.map((app) => (
      <Icon key={app.id} app={app} onInteract={(event) => onAppOpen(app, event)} />
    ))}
  </div>
);

const SplashScreen: React.FC = () => (
  <div className="absolute inset-0 bg-black flex items-center justify-center z-50">
     <div className="circuit-bg"></div>
     <div className="circuit-lines"></div>
    <h1 className="zos-logo">ZOS</h1>
  </div>
);


const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [activeApp, setActiveApp] = useState<AppDefinition | null>(null);
  const [previousActiveApp, setPreviousActiveApp] =
    useState<AppDefinition | null>(null);
  const [llmContent, setLlmContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [interactionHistory, setInteractionHistory] = useState<
    InteractionData[]
  >([]);
  const [isParametersOpen, setIsParametersOpen] = useState<boolean>(false);
  const [currentMaxHistoryLength, setCurrentMaxHistoryLength] =
    useState<number>(INITIAL_MAX_HISTORY_LENGTH);

  // Statefulness feature state
  const [isStatefulnessEnabled, setIsStatefulnessEnabled] =
    useState<boolean>(false);
  const [appContentCache, setAppContentCache] = useState<
    Record<string, string>
  >({});
  const [currentAppPath, setCurrentAppPath] = useState<string[]>([]); // For UI graph statefulness

  // Animation state
  const [animationState, setAnimationState] = useState<'idle' | 'opening' | 'closing'>('idle');
  const [animationOrigin, setAnimationOrigin] = useState<{ top: number; left: number } | null>(null);

  // Live Assistant State
  const [isAssistantActive, setIsAssistantActive] = useState<boolean>(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionEntry[]>([]);


  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const internalHandleLlmRequest = useCallback(
    async (historyForLlm: InteractionData[], maxHistoryLength: number) => {
      if (historyForLlm.length === 0) {
        setError('No interaction data to process.');
        return;
      }

      setIsLoading(true);
      setError(null);

      let accumulatedContent = '';

      try {
        const stream = streamAppContent(historyForLlm, maxHistoryLength);
        for await (const chunk of stream) {
          accumulatedContent += chunk;
          setLlmContent((prev) => prev + chunk);
        }
      } catch (e: any) {
        setError('Failed to stream content from the API.');
        console.error(e);
        accumulatedContent = `<div class="p-4 text-red-400 bg-red-900/50 rounded-md">Error loading content.</div>`;
        setLlmContent(accumulatedContent);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !isLoading &&
      currentAppPath.length > 0 &&
      isStatefulnessEnabled &&
      llmContent
    ) {
      const cacheKey = currentAppPath.join('__');
      if (appContentCache[cacheKey] !== llmContent) {
        setAppContentCache((prevCache) => ({
          ...prevCache,
          [cacheKey]: llmContent,
        }));
      }
    }
  }, [
    llmContent,
    isLoading,
    currentAppPath,
    isStatefulnessEnabled,
    appContentCache,
  ]);

  const handleInteraction = useCallback(
    async (interactionData: InteractionData) => {
      if (interactionData.id === 'app_close_button') {
        handleCloseAppView();
        return;
      }

      const newHistory = [
        interactionData,
        ...interactionHistory.slice(0, currentMaxHistoryLength - 1),
      ];
      setInteractionHistory(newHistory);

      const newPath = activeApp
        ? [...currentAppPath, interactionData.id]
        : [interactionData.id];
      setCurrentAppPath(newPath);
      const cacheKey = newPath.join('__');

      setLlmContent('');
      setError(null);

      if (isStatefulnessEnabled && appContentCache[cacheKey]) {
        setLlmContent(appContentCache[cacheKey]);
        setIsLoading(false);
      } else {
        internalHandleLlmRequest(newHistory, currentMaxHistoryLength);
      }
    },
    [
      interactionHistory,
      internalHandleLlmRequest,
      activeApp,
      currentMaxHistoryLength,
      currentAppPath,
      isStatefulnessEnabled,
      appContentCache,
    ],
  );

  const handleAppOpen = (
    app: AppDefinition,
    event?: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event?.currentTarget) {
      const iconRect = event.currentTarget.getBoundingClientRect();
      setAnimationOrigin({
        top: iconRect.top + iconRect.height / 2,
        left: iconRect.left + iconRect.width / 2,
      });
    } else {
      setAnimationOrigin({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
      });
    }

    setAnimationState('opening');

    const initialInteraction: InteractionData = {
      id: app.id,
      type: 'app_open',
      elementText: app.name,
      elementType: 'icon',
      appContext: app.id,
    };

    const newHistory = [initialInteraction];
    setInteractionHistory(newHistory);

    const appPath = [app.id];
    setCurrentAppPath(appPath);
    const cacheKey = appPath.join('__');

    if (isParametersOpen) {
      setIsParametersOpen(false);
    }
    setActiveApp(app);
    setLlmContent('');
    setError(null);

    if (isStatefulnessEnabled && appContentCache[cacheKey]) {
      setLlmContent(appContentCache[cacheKey]);
      setIsLoading(false);
    } else {
      internalHandleLlmRequest(newHistory, currentMaxHistoryLength);
    }
  };

  const handleCloseAppView = () => {
    if (!activeApp) return 'No active app to close.';

    const iconElement = document.querySelector(`[data-app-id='${activeApp.id}']`);
    if (iconElement) {
      const iconRect = iconElement.getBoundingClientRect();
      setAnimationOrigin({
        top: iconRect.top + iconRect.height / 2,
        left: iconRect.left + iconRect.width / 2,
      });
    } else {
      setAnimationOrigin({ top: window.innerHeight, left: window.innerWidth / 2 });
    }

    setAnimationState('closing');

    const appName = activeApp.name;
    setTimeout(() => {
      setActiveApp(null);
      setLlmContent('');
      setError(null);
      setInteractionHistory([]);
      setCurrentAppPath([]);
      setAnimationState('idle');
    }, 500);
    return `Closing ${appName}.`;
  };

  const handleToggleParametersPanel = () => {
    setIsParametersOpen((prevIsOpen) => {
      const isOpening = !prevIsOpen;
      if (isOpening) {
        setAnimationOrigin({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
        setAnimationState('opening');
        if (activeApp) {
          setPreviousActiveApp(activeApp);
          setActiveApp(null);
        }
      } else {
        setAnimationState('closing');
        setTimeout(() => {
          setAnimationState('idle');
        }, 500);
      }
      return isOpening;
    });
  };

  const handleUpdateHistoryLength = (newLength: number) => {
    setCurrentMaxHistoryLength(newLength);
    setInteractionHistory((prev) => prev.slice(0, newLength));
  };

  const handleSetStatefulness = (enabled: boolean) => {
    setIsStatefulnessEnabled(enabled);
    if (!enabled) {
      setAppContentCache({});
    }
  };

  const handleMasterClose = () => {
    if (isParametersOpen) {
      handleToggleParametersPanel();
    } else if (activeApp) {
      handleCloseAppView();
    }
  };

  // --- Live Assistant Orchestrator Functions ---
  const handleToggleAssistant = () => {
    setIsAssistantActive(prev => !prev);
    if (!isAssistantActive) {
      setTranscriptionHistory([{ speaker: 'system', text: 'ZOS Assistant Initialized. Press the microphone to begin.' }]);
    }
  };

  const handleOpenAppByName = (appName: string): string => {
    const appToOpen = APP_DEFINITIONS_CONFIG.find(
      (app) => app.name.toLowerCase() === appName.toLowerCase().trim()
    );

    if (appToOpen) {
      if (activeApp?.id === appToOpen.id) {
        return `The ${appName} app is already open.`;
      }
      handleAppOpen(appToOpen);
      return `Opening the ${appName} app.`;
    } else {
      return `Sorry, I couldn't find an app named "${appName}".`;
    }
  };

  const getDesktopAppsList = (): string => {
    const appNames = APP_DEFINITIONS_CONFIG.map((app) => app.name);
    return `The available apps are: ${appNames.join(', ')}.`;
  };
  
  if (showSplash) {
    return <SplashScreen />;
  }

  const isWindowVisible = !!activeApp || isParametersOpen;
  const windowTitle = isParametersOpen
    ? 'ZOS Parameters'
    : activeApp
      ? activeApp.name
      : 'ZOS';

  return (
    <div className={`w-full h-screen relative overflow-hidden ${isLoading ? 'cursor-zos-wait' : ''}`}>
      <div className="absolute inset-0">
        <div className="circuit-bg"></div>
        <div className="circuit-lines"></div>
      </div>
      <div className="relative w-full h-full overflow-y-auto pt-2 md:pt-0">
        <DesktopView onAppOpen={handleAppOpen} />
        <button
          className="assistant-fab"
          onClick={handleToggleAssistant}
          aria-label="Toggle ZOS Assistant"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>
        </button>
      </div>

      {isWindowVisible && (
         <Window
         title={windowTitle}
         onClose={handleMasterClose}
         isAppOpen={!!activeApp && !isParametersOpen}
         appId={activeApp?.id}
         onToggleParameters={handleToggleParametersPanel}
         onExitToDesktop={handleCloseAppView}
         isParametersPanelOpen={isParametersOpen}
         animationState={animationState}
         animationOrigin={animationOrigin}
         >
           {isParametersOpen ? (
             <ParametersPanel
               currentLength={currentMaxHistoryLength}
               onUpdateHistoryLength={handleUpdateHistoryLength}
               onClosePanel={handleToggleParametersPanel}
               isStatefulnessEnabled={isStatefulnessEnabled}
               onSetStatefulness={handleSetStatefulness}
             />
           ) : (
             <>
               {isLoading && llmContent.length === 0 && (
                 <div className="flex flex-col justify-center items-center h-full">
                   <div className="zos-spinner">
                     <div className="spinner-ring"></div>
                     <div className="spinner-ring"></div>
                     <div className="spinner-ring"></div>
                   </div>
                   <p className="llm-text mt-4 animate-pulse">Initializing Interface...</p>
                 </div>
               )}
               {error && (
                 <div className="p-4 text-red-400 bg-red-900/50 rounded-md">
                   {error}
                 </div>
               )}
               {activeApp && (!isLoading || llmContent) && (
                 <GeneratedContent
                   htmlContent={llmContent}
                   onInteract={handleInteraction}
                   appContext={activeApp.id}
                   isLoading={isLoading}
                 />
               )}
             </>
           )}
       </Window>
      )}

      {isAssistantActive && (
        <LiveAssistant
          onClose={handleToggleAssistant}
          transcriptionHistory={transcriptionHistory}
          setTranscriptionHistory={setTranscriptionHistory}
          openApp={handleOpenAppByName}
          closeApp={handleCloseAppView}
          getAppList={getDesktopAppsList}
          isAppOpen={!!activeApp}
        />
      )}
    </div>
  );
};

export default App;
