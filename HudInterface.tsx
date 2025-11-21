import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Mic, Cloud, Search, Wifi, Battery, BatteryCharging, MapPin } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- Helper Components ---

const Divider: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`h-[1px] bg-cyan-500/30 w-full ${className} relative`}>
    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-cyan-500/50 rounded-full"></div>
    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-cyan-500/50 rounded-full"></div>
  </div>
);

const CornerTick: React.FC<{ position: string }> = ({ position }) => {
    const classes = {
        'tl': 'top-0 left-0 border-t border-l',
        'tr': 'top-0 right-0 border-t border-r',
        'bl': 'bottom-0 left-0 border-b border-l',
        'br': 'bottom-0 right-0 border-b border-r',
    };
    return <div className={`absolute w-2 h-2 border-cyan-500/60 ${classes[position as keyof typeof classes]}`} />;
}

// --- Data & Config ---

const PLAYLIST = [
    { title: "Night City Dreams", artist: "Artemis Prime", duration: "03:45" },
    { title: "Neon Rain", artist: "Synth Walker", duration: "04:20" },
    { title: "Cyber Heart", artist: "Data Ghost", duration: "02:55" },
    { title: "Mainframe Breach", artist: "Null Pointer", duration: "03:10" },
];

const HudInterface: React.FC = () => {
  // --- State ---
  const [time, setTime] = useState(new Date());
  const [battery, setBattery] = useState<{ level: number, charging: boolean }>({ level: 100, charging: true });
  
  // Weather
  const [weather, setWeather] = useState<{ temp: string, condition: string, location: string }>({
      temp: "--",
      condition: "SCANNING...",
      location: "UNKNOWN SECTOR"
  });
  
  // Media Player
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [trackProgress, setTrackProgress] = useState(0);

  // Search & AI
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [groundingUrls, setGroundingUrls] = useState<{title: string, uri: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [newsHeadlines, setNewsHeadlines] = useState<string[]>([]);

  // --- Effects ---

  // Clock & Date
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Media Progress Simulation
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
        interval = setInterval(() => {
            setTrackProgress(prev => (prev + 1) % 100);
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Battery Status
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((bat: any) => {
        const updateBattery = () => {
            setBattery({ level: bat.level * 100, charging: bat.charging });
        };
        updateBattery();
        bat.addEventListener('levelchange', updateBattery);
        bat.addEventListener('chargingchange', updateBattery);
      });
    }
  }, []);

  // Initial News & Weather
  useEffect(() => {
    fetchNews();
    fetchWeather();
  }, []);

  // --- Handlers ---

  const fetchWeather = async () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            // Using Gemini with Google Search to get real-time weather
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `What is the current weather at latitude ${latitude}, longitude ${longitude}? Return a string strictly in this format: "LocationName | Temperature | Condition". Example: "Tokyo | 15°C | Rainy". Keep it brief.`,
                config: {
                    tools: [{ googleSearch: {} }],
                }
            });
            
            const text = response.text;
            if (text) {
                const parts = text.split('|').map(s => s.trim());
                if (parts.length >= 3) {
                    setWeather({
                        location: parts[0],
                        temp: parts[1],
                        condition: parts[2]
                    });
                } else {
                     // Fallback parsing if the model chats too much
                     setWeather(prev => ({ ...prev, condition: "DATA RECEIVED", location: "LOCAL" }));
                }
            }
          } catch (e) {
              console.error("Weather fetch failed", e);
              setWeather({ temp: "ERR", condition: "OFFLINE", location: "UNKNOWN" });
          }
      }, (err) => {
          console.warn("Geolocation denied");
          setWeather({ temp: "--", condition: "NO SIGNAL", location: "GPS ERROR" });
      });
  };

  const fetchNews = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Generate 3 short, punchy, cyberpunk-style futuristic news headlines based on real current technology trends. Return them as a plain text list separated by newlines. Do not include numbers or bullet points.',
        });
        const text = response.text;
        if (text) {
            setNewsHeadlines(text.split('\n').filter(line => line.trim() !== '').slice(0, 3));
        }
      } catch (e) {
        console.error("Failed to fetch news", e);
        setNewsHeadlines([
            "NETWORK ERROR: UNABLE TO SYNC WITH WORLD DATA.",
            "LOCAL CACHE LOADED.",
            "SYSTEM DIAGNOSTICS RECOMMENDED."
        ]);
      }
  };

  const handleSearch = async (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && searchQuery.trim()) {
          setIsSearching(true);
          setSearchResult(null);
          setGroundingUrls([]);
          
          try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: searchQuery,
                config: {
                    tools: [{ googleSearch: {} }],
                }
            });

            // Process response
            const text = response.text;
            setSearchResult(text);

            // Extract grounding chunks
            const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (chunks) {
                const urls = chunks
                    .map((c: any) => c.web)
                    .filter((w: any) => w) // filter out non-web chunks
                    .map((w: any) => ({ title: w.title, uri: w.uri }));
                setGroundingUrls(urls);
            }

          } catch (error) {
              setSearchResult("CONNECTION INTERRUPTED. TARGET NOT FOUND.");
          } finally {
              setIsSearching(false);
          }
      }
  };

  const togglePlay = () => setIsPlaying(!isPlaying);
  
  const nextTrack = () => {
      setCurrentTrackIndex((prev) => (prev + 1) % PLAYLIST.length);
      setTrackProgress(0);
      setIsPlaying(true);
  };

  // Formatters
  const formatTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }).toUpperCase();
  };
  
  const formatDate = (date: Date) => {
      const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
      return `${days[date.getDay()]} ${date.getDate().toString().padStart(2, '0')}`;
  };

  const currentTrack = PLAYLIST[currentTrackIndex];

  return (
    <div className="w-full h-full bg-slate-900 text-cyan-400 font-mono relative flex flex-col scanlines selection:bg-cyan-500/30 selection:text-cyan-100 overflow-hidden">
      
      {/* Background Texture & Glow */}
      <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-850 via-slate-900 to-black pointer-events-none"></div>
      
      {/* Top Status Bar */}
      <div className="flex justify-between items-center px-4 md:px-6 py-4 text-[12px] tracking-widest opacity-80 z-10 relative border-b border-cyan-900/30 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-cyan-300" />
          <span className="hidden md:inline text-cyan-300 font-bold">NET: CONNECTED</span>
          <span className="md:hidden text-cyan-300 font-bold">ON</span>
        </div>
        <div className="text-slate-400">{formatDate(time)}</div>
        <div className="flex items-center gap-2">
            <span>{Math.round(battery.level)}%</span>
            {battery.charging ? <BatteryCharging className="w-4 h-4 text-cyan-300" /> : <Battery className="w-4 h-4 text-cyan-300" />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-20 w-full">
        <div className="w-full h-full flex flex-col pt-6 px-4 md:px-8 max-w-7xl mx-auto">

            {/* Main Time Display */}
            <div className="z-10 relative mb-6">
                <div className="border border-cyan-500/30 bg-slate-900/50 p-1 relative group hover:border-cyan-500/60 transition-colors">
                    <CornerTick position="tl" />
                    <CornerTick position="tr" />
                    <CornerTick position="bl" />
                    <CornerTick position="br" />
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-850/50">
                        <div className="bg-slate-800 px-2 py-[2px] text-[10px] tracking-[0.2em] text-slate-400 hidden sm:block">SYSTEM TIME</div>
                        <div className="text-5xl md:text-7xl tracking-[0.15em] text-cyan-100 text-shadow-glow font-bold tabular-nums mx-auto sm:mx-0">
                            {formatTime(time)}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Weather Widget */}
                <div className="relative z-10 h-full">
                    <div className="flex items-start gap-4 h-full border border-cyan-500/30 bg-slate-900/50 p-3 relative">
                        <CornerTick position="tl" />
                        <CornerTick position="br" />
                        <div className="w-24 h-24 border border-cyan-500/30 flex flex-col items-center justify-center relative bg-slate-900/80 shrink-0">
                            <Cloud className="w-8 h-8 text-cyan-400 opacity-80 animate-pulse mb-1" strokeWidth={1.5} />
                            <span className="text-xl font-bold text-cyan-100">{weather.temp.replace('C', '')}°</span>
                        </div>
                        <div className="flex-1 flex flex-col justify-between h-24 py-1 overflow-hidden">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <div className="text-[10px] tracking-widest text-slate-400 uppercase flex items-center gap-1">
                                        <MapPin size={10} /> {weather.location}
                                    </div>
                                    <div className="text-xl text-cyan-100 uppercase truncate">{weather.condition}</div>
                                </div>
                                <button onClick={fetchWeather} className="text-[10px] border border-cyan-900 px-2 py-1 hover:bg-cyan-500/20 transition-colors uppercase text-cyan-600">
                                    Rescan
                                </button>
                            </div>
                            
                            {/* Custom Ruler Bar */}
                            <div className="w-full mt-2">
                                <div className="h-2 bg-cyan-900/30 w-full relative overflow-hidden">
                                    <div className="absolute top-0 left-0 h-full w-1/3 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-[shimmer_3s_infinite_linear]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Media Player */}
                <div className="relative z-10 h-full">
                    <div className="border border-cyan-500/30 p-3 relative bg-slate-900/50 h-full flex flex-col justify-between min-h-[120px]">
                        <CornerTick position="tr" />
                        <CornerTick position="bl" />
                        
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex flex-col gap-1 overflow-hidden">
                                <h2 className="text-cyan-100 text-sm tracking-widest uppercase truncate">{currentTrack.title}</h2>
                                <p className="text-cyan-600 text-[10px] uppercase tracking-wider font-bold">{currentTrack.artist}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button 
                                    onClick={togglePlay}
                                    className="border border-cyan-500/50 p-2 hover:bg-cyan-500/20 transition-colors"
                                >
                                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                </button>
                                <button 
                                    onClick={nextTrack}
                                    className="border border-cyan-500/50 p-2 hover:bg-cyan-500/20 transition-colors"
                                >
                                    <SkipForward size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Slider Bar */}
                        <div className="py-2 relative flex items-center justify-center w-full mt-auto">
                            <div className="w-full h-[1px] bg-slate-700"></div>
                            <div 
                                className="absolute h-3 w-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all duration-1000 ease-linear"
                                style={{ left: `${trackProgress}%` }}
                            ></div>
                        </div>
                        
                        <div className="flex justify-between text-[10px] text-slate-500 tracking-widest font-light">
                            <span>00:{trackProgress.toString().padStart(2, '0')}</span>
                            <span>{currentTrack.duration}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dynamic Data Feed (News or Search Results) */}
            <div className="flex-1 z-10 relative flex flex-col min-h-[200px] mb-4">
                <div className="flex justify-between items-center mb-2 bg-slate-800/30 py-1 px-2 border-l-2 border-cyan-500/50">
                    <span className="text-xs text-cyan-300 uppercase tracking-wider">
                        {searchResult ? 'SEARCH RESULTS / GROUNDED' : 'DATA FEED / LIVE STREAM'}
                    </span>
                    <div className="flex flex-col items-center justify-center w-6 h-6 border border-slate-600 animate-pulse">
                        <div className="w-1 h-1 bg-cyan-500"></div>
                    </div>
                </div>

                <div className="flex-1 bg-slate-900/30 border border-slate-800 p-4 overflow-y-auto custom-scrollbar relative min-h-[150px]">
                    {isSearching ? (
                        <div className="flex items-center justify-center h-full text-cyan-400 animate-pulse tracking-widest">
                            QUERYING GLOBAL NETWORK...
                        </div>
                    ) : searchResult ? (
                        <div className="space-y-4">
                             <div className="text-sm text-cyan-100 leading-relaxed whitespace-pre-wrap font-sans opacity-90">
                                {searchResult}
                             </div>
                             {groundingUrls.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-cyan-900/50">
                                    <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-widest">Source Links:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {groundingUrls.map((url, i) => (
                                            <a 
                                                key={i} 
                                                href={url.uri} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-[10px] text-cyan-400 border border-cyan-900 px-2 py-1 hover:bg-cyan-900/30 truncate max-w-full md:max-w-[200px]"
                                            >
                                                {url.title}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                             )}
                        </div>
                    ) : (
                        <div className="space-y-4 text-sm text-slate-400 tracking-wider leading-relaxed">
                            {newsHeadlines.length === 0 ? (
                                <p className="animate-pulse">INITIALIZING FEED...</p>
                            ) : (
                                newsHeadlines.map((headline, idx) => (
                                    <div key={idx} className="border-b border-slate-800 pb-2 last:border-0">
                                        <span className="text-cyan-600 mr-2">[{String(idx + 1).padStart(2, '0')}]</span>
                                        {headline}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Search Bar (Fixed Bottom) */}
      <div className="p-4 z-20 relative bg-gradient-to-t from-black via-black to-transparent pt-8 shrink-0">
          <div className="max-w-7xl mx-auto w-full">
            <div className="border border-cyan-700/50 p-2 flex justify-between items-center bg-slate-900/90 shadow-glow focus-within:border-cyan-400 transition-colors group">
                <div className="flex items-center gap-3 w-full">
                    <Search className="w-4 h-4 text-cyan-600 group-focus-within:text-cyan-400" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearch}
                        placeholder="ENTER COMMAND OR SEARCH QUERY..."
                        className="bg-transparent border-none outline-none text-cyan-400 w-full text-xs uppercase tracking-[0.2em] placeholder-slate-600 font-mono"
                        autoComplete="off"
                    />
                </div>
                <div className="text-cyan-400 opacity-70 flex gap-1">
                    <div className="w-[2px] h-3 bg-cyan-400 animate-pulse delay-75"></div>
                    <div className="w-[2px] h-2 bg-cyan-400 animate-pulse delay-150"></div>
                </div>
            </div>
            
            {/* Footer Nav */}
            <div className="flex justify-between items-center pt-4 mt-2 border-t border-cyan-500/30 relative">
                <div className="absolute -top-[3px] left-0 w-1 h-1 bg-cyan-500 rounded-full"></div>
                <div className="absolute -top-[3px] right-0 w-1 h-1 bg-cyan-500 rounded-full"></div>

                <button onClick={() => setSearchResult(null)} className="w-1/4 py-2 border-r border-slate-800 text-[10px] tracking-widest text-cyan-400 hover:bg-cyan-900/20 transition-colors uppercase">
                    HOME
                </button>
                <button className="w-1/4 py-2 border-r border-slate-800 text-[10px] tracking-widest text-slate-400 hover:bg-cyan-900/20 transition-colors uppercase hover:text-cyan-400">
                    LOGS
                </button>
                <button className="w-1/4 py-2 border-r border-slate-800 text-[10px] tracking-widest text-slate-400 hover:bg-cyan-900/20 transition-colors uppercase hover:text-cyan-400">
                    COMMS
                </button>
                <button className="w-1/4 py-2 text-[10px] tracking-widest text-slate-400 hover:bg-cyan-900/20 transition-colors uppercase hover:text-cyan-400">
                    SYS
                </button>
            </div>
          </div>
      </div>
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #0f172a; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #22d3ee; 
            border-radius: 2px;
        }
      `}</style>

    </div>
  );
};

export default HudInterface;