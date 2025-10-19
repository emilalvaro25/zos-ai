/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import { Blob, FunctionDeclaration, GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TranscriptionEntry } from '../types';

// --- Audio Helper Functions ---
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
}
  
// --- Function Declarations for Gemini ---
const openAppFunctionDeclaration: FunctionDeclaration = {
    name: 'openApp',
    parameters: {
      type: Type.OBJECT,
      description: 'Opens a specified application on the ZOS desktop.',
      properties: {
        appName: {
          type: Type.STRING,
          description: 'The name of the application to open, e.g., "Text Editor", "System".',
        },
      },
      required: ['appName'],
    },
};

const closeAppFunctionDeclaration: FunctionDeclaration = {
    name: 'closeApp',
    parameters: {
      type: Type.OBJECT,
      description: 'Closes the currently active application window. Only works if an app is open.',
      properties: {},
    },
};

const getAppListFunctionDeclaration: FunctionDeclaration = {
    name: 'getAppList',
    parameters: {
      type: Type.OBJECT,
      description: 'Gets a list of all available applications on the desktop.',
      properties: {},
    },
};

const systemInstruction = `You are ZOS, a helpful and advanced AI assistant integrated into a futuristic operating system. Your primary role is to assist the user by orchestrating OS functions. You can open and close applications and list available applications. Respond to the user's voice commands concisely and naturally. When you execute a function, confirm the action in your spoken response. For example, if the user says "Open the text editor," you should call the openApp function and then say "Opening the text editor." If no app is open and the user asks to close one, inform them of this fact.`;

// --- LiveAssistant Component ---
interface LiveAssistantProps {
    onClose: () => void;
    transcriptionHistory: TranscriptionEntry[];
    setTranscriptionHistory: React.Dispatch<React.SetStateAction<TranscriptionEntry[]>>;
    openApp: (appName: string) => string;
    closeApp: () => string;
    getAppList: () => string;
    isAppOpen: boolean;
}
  
type AssistantStatus = 'idle' | 'listening' | 'processing';

export const LiveAssistant: React.FC<LiveAssistantProps> = ({
    onClose,
    transcriptionHistory,
    setTranscriptionHistory,
    openApp,
    closeApp,
    getAppList,
    isAppOpen
}) => {
    const [assistantStatus, setAssistantStatus] = useState<AssistantStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);
  
    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

    useEffect(() => {
        if (transcriptContainerRef.current) {
          transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
        }
    }, [transcriptionHistory]);

    const stopAudioPlayback = () => {
        if (outputAudioContextRef.current) {
          outputSourcesRef.current.forEach(source => {
            source.stop();
          });
          outputSourcesRef.current.clear();
          nextStartTimeRef.current = 0;
        }
    };

    const stopMicrophone = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
    };
    
    const handleStartListening = useCallback(async () => {
        setAssistantStatus('listening');
        setError(null);
        currentInputTranscription.current = '';
        currentOutputTranscription.current = '';

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            
            const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) {
              setError("Your browser doesn't support the Web Audio API.");
              setAssistantStatus('idle');
              return;
            }

            inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
            outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
            
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' }}},
                    systemInstruction,
                    tools: [{ functionDeclarations: [openAppFunctionDeclaration, closeAppFunctionDeclaration, getAppListFunctionDeclaration] }],
                },
                callbacks: {
                    onopen: () => {
                        if (!inputAudioContextRef.current || !mediaStreamRef.current) return;
                        
                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                         // State management based on message content
                         if (message.serverContent?.turnComplete || message.serverContent?.interrupted) {
                            if (message.serverContent?.interrupted) {
                                stopAudioPlayback();
                            }
                            setAssistantStatus('listening');
                        } else if (message.serverContent?.outputTranscription || message.serverContent?.modelTurn?.parts[0]?.inlineData.data) {
                            setAssistantStatus('processing');
                        }
                        
                        // Handle transcriptions
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscription.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscription.current.trim();
                            const fullOutput = currentOutputTranscription.current.trim();
                            
                            setTranscriptionHistory(prev => {
                                const newHistory = [...prev];
                                if (fullInput) newHistory.push({ speaker: 'user', text: fullInput });
                                if (fullOutput) newHistory.push({ speaker: 'agent', text: fullOutput });
                                return newHistory;
                            });
                            
                            currentInputTranscription.current = '';
                            currentOutputTranscription.current = '';
                        }
                        
                        // Handle function calls
                        if (message.toolCall?.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                let result = '';
                                if (fc.name === 'openApp') {
                                    result = openApp(fc.args.appName);
                                } else if (fc.name === 'closeApp') {
                                    result = closeApp();
                                } else if (fc.name === 'getAppList') {
                                    result = getAppList();
                                }

                                if (sessionPromiseRef.current) {
                                    sessionPromiseRef.current.then(session => {
                                        session.sendToolResponse({
                                            functionResponses: { id: fc.id, name: fc.name, response: { result } }
                                        });
                                    });
                                }
                            }
                        }

                        // Handle audio output
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                            
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            source.addEventListener('ended', () => { outputSourcesRef.current.delete(source); });
                            
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            outputSourcesRef.current.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setError('A connection error occurred.');
                        setAssistantStatus('idle');
                    },
                    onclose: () => {
                        // Session closed by server or due to an error.
                    },
                },
            });
        } catch (err: any) {
            console.error('Failed to start listening:', err);
            setError(err.message || 'Failed to access microphone.');
            setAssistantStatus('idle');
        }
    }, [openApp, closeApp, getAppList, setTranscriptionHistory]);

    const handleStopListening = useCallback(async () => {
        setAssistantStatus('idle');
        stopMicrophone();
        stopAudioPlayback();
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
            sessionPromiseRef.current = null;
        }
        if (inputAudioContextRef.current?.state !== 'closed') {
            inputAudioContextRef.current?.close();
        }
        if (outputAudioContextRef.current?.state !== 'closed') {
            outputAudioContextRef.current?.close();
        }
    }, []);

    const toggleListening = () => {
        if (assistantStatus !== 'idle') {
            handleStopListening();
        } else {
            handleStartListening();
        }
    };
    
    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            handleStopListening();
        };
    }, [handleStopListening]);
    
    return (
        <div className="assistant-overlay">
            <div className="assistant-window">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="llm-title text-cyan-300">ZOS Voice Assistant</h2>
                    <button onClick={onClose} className="llm-button !m-0 !py-1 !px-3 bg-gray-700 hover:bg-gray-600">Close</button>
                </div>
                <div ref={transcriptContainerRef} className="assistant-transcript-container">
                    {transcriptionHistory.map((entry, index) => (
                        <div key={index} className={`transcript-bubble transcript-bubble-${entry.speaker}`}>
                            {entry.text}
                        </div>
                    ))}
                </div>
                {error && <div className="p-2 text-center text-red-400">{error}</div>}
                <div className="assistant-controls">
                    <div onClick={toggleListening} className={`mic-button ${assistantStatus}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.7z"/></svg>
                    </div>
                </div>
            </div>
        </div>
    );
};