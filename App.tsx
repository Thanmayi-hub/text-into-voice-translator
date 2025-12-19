
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  SUPPORTED_LANGUAGES, 
  VOICES, 
  TranslationResult, 
  VoiceName 
} from './types';
import { translateText, generateSpeech } from './services/geminiService';
import { decode, decodeAudioData } from './utils/audio';

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Zephyr');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [history, setHistory] = useState<TranslationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // Load history from localStorage
    const saved = localStorage.getItem('vox_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveToHistory = (result: TranslationResult) => {
    const newHistory = [result, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('vox_history', JSON.stringify(newHistory));
  };

  const handleTranslateAndSpeak = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      // 1. Translate
      const translation = await translateText(inputText, sourceLang, targetLang);
      setTranslatedText(translation);
      
      // 2. Add to history
      saveToHistory({
        originalText: inputText,
        translatedText: translation,
        sourceLang,
        targetLang,
        timestamp: Date.now(),
      });

      // 3. Speak
      await speakText(translation);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string) => {
    if (!text) return;
    
    setIsPlaying(true);
    try {
      const base64Audio = await generateSpeech(text, selectedVoice);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
        });
      }

      const ctx = audioContextRef.current;
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        ctx,
        24000,
        1
      );

      // Stop any current playing audio
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
      sourceNodeRef.current = source;

    } catch (err: any) {
      setError("Speech synthesis failed: " + err.message);
      setIsPlaying(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('vox_history');
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-5xl mx-auto">
      {/* Header */}
      <header className="w-full text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 mb-2">
          VoxTranslate AI
        </h1>
        <p className="text-slate-400 text-lg">Natural Voice Translation, Powered by Gemini</p>
      </header>

      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Interface */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-effect rounded-2xl p-6 shadow-xl space-y-4">
            {/* Language Selection */}
            <div className="flex items-center justify-between gap-4">
              <select 
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="bg-slate-800 text-white rounded-lg px-4 py-2 flex-1 focus:ring-2 focus:ring-blue-500 outline-none border border-slate-700"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={`src-${lang.code}`} value={lang.code}>{lang.name}</option>
                ))}
              </select>
              <button 
                onClick={() => {
                  const temp = sourceLang;
                  setSourceLang(targetLang);
                  setTargetLang(temp);
                }}
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="Swap Languages"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
              <select 
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="bg-slate-800 text-white rounded-lg px-4 py-2 flex-1 focus:ring-2 focus:ring-blue-500 outline-none border border-slate-700"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={`target-${lang.code}`} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>

            {/* Input Text Area */}
            <div className="relative">
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type text to translate and speak..."
                className="w-full h-40 bg-slate-900/50 text-white rounded-xl p-4 resize-none focus:ring-2 focus:ring-blue-500 outline-none border border-slate-700 text-lg placeholder-slate-500"
              />
              <div className="absolute bottom-4 right-4 text-xs text-slate-500">
                {inputText.length} characters
              </div>
            </div>

            {/* Voice Selection */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {VOICES.map((voice) => (
                <button
                  key={voice.name}
                  onClick={() => setSelectedVoice(voice.name)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all border ${
                    selectedVoice === voice.name 
                      ? 'bg-blue-600 border-blue-400 text-white' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <div className="font-semibold">{voice.name}</div>
                  <div className="text-[10px] opacity-70 whitespace-nowrap">{voice.description}</div>
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleTranslateAndSpeak}
                disabled={isLoading || !inputText.trim()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
                Translate & Speak
              </button>
              <button
                onClick={() => setInputText('')}
                className="bg-slate-800 hover:bg-slate-700 text-white py-3 px-6 rounded-xl transition-all border border-slate-700"
              >
                Clear
              </button>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Translation Result Output */}
          {translatedText && (
            <div className="glass-effect rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Translation</span>
                <button 
                  onClick={() => speakText(translatedText)}
                  className={`p-2 rounded-full hover:bg-blue-500/20 transition-all ${isPlaying ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <p className="text-xl text-white leading-relaxed">{translatedText}</p>
            </div>
          )}
        </div>

        {/* Sidebar / History */}
        <div className="lg:col-span-1 flex flex-col h-full">
          <div className="glass-effect rounded-2xl p-6 shadow-xl flex flex-col h-full max-h-[600px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Recent
              </h2>
              {history.length > 0 && (
                <button 
                  onClick={clearHistory}
                  className="text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm italic">
                  No translations yet. Start by typing something on the left!
                </div>
              ) : (
                history.map((item) => (
                  <div 
                    key={item.timestamp}
                    onClick={() => {
                      setInputText(item.originalText);
                      setTranslatedText(item.translatedText);
                      setSourceLang(item.sourceLang);
                      setTargetLang(item.targetLang);
                    }}
                    className="p-4 bg-slate-900/40 border border-slate-800 hover:border-blue-500/30 hover:bg-slate-900/60 rounded-xl cursor-pointer transition-all group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-[10px] font-bold text-blue-500 uppercase">
                        {item.sourceLang} &rarr; {item.targetLang}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 line-clamp-1 mb-1 font-medium">{item.originalText}</p>
                    <p className="text-sm text-slate-400 line-clamp-2">{item.translatedText}</p>
                    <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                      <span className="text-[10px] text-blue-400">Load Translation &rarr;</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="mt-12 text-slate-600 text-sm pb-8">
        Built with Gemini Pro & Flash Multi-modal models
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
};

export default App;
