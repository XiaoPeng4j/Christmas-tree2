
import React, { useState, useEffect, useRef } from 'react';
import { TreeState, HandGesture, MusicTrack } from '../types';

interface UIProps {
  treeState: TreeState;
  onUpload: (source: File | string, text: string) => void;
  onBatchUpload: (items: {source: File | string, text: string}[]) => void;
  gesture: HandGesture | null;
  
  // Audio Props
  isMusicPlaying: boolean;
  onToggleMusic: () => void;
  playlist: MusicTrack[];
  currentTrackIndex: number;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSelectTrack: (index: number) => void;
  onAddTracks: (tracks: MusicTrack[]) => void;
}

interface BatchItem {
  file: File;
  preview: string;
  text: string;
}

export const UI: React.FC<UIProps> = ({ 
  treeState, onUpload, onBatchUpload, gesture,
  isMusicPlaying, onToggleMusic, playlist, currentTrackIndex, onNextTrack, onPrevTrack, onSelectTrack, onAddTracks
}) => {
  const [inputText, setInputText] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file'); 
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [musicCode, setMusicCode] = useState<string | null>(null); 
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Music UI State
  const [showPlaylist, setShowPlaylist] = useState(false);
  const musicInputRef = useRef<HTMLInputElement>(null);
  
  // Batch Review State (Photos)
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      batchQueue.forEach(item => URL.revokeObjectURL(item.preview));
    };
  }, [batchQueue]);

  // Helper: Compress image before converting to Base64
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; 
          const scaleSize = MAX_WIDTH / img.width;
          
          if (scaleSize < 1) {
             canvas.width = MAX_WIDTH;
             canvas.height = img.height * scaleSize;
          } else {
             canvas.width = img.width;
             canvas.height = img.height;
          }

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedBase64);
        };
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText) return;

    if (activeTab === 'url' && inputUrl) {
      onUpload(inputUrl, inputText);
      generateCode([{ url: inputUrl, text: inputText }]);
      resetForm();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newItems: BatchItem[] = Array.from(files).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        text: inputText || file.name.replace(/\.[^/.]+$/, "")
      }));
      setBatchQueue(newItems);
    }
  };

  const handleUpdateBatchText = (index: number, newText: string) => {
    setBatchQueue(prev => prev.map((item, i) => i === index ? { ...item, text: newText } : item));
  };

  const handleRemoveBatchItem = (index: number) => {
    setBatchQueue(prev => prev.filter((_, i) => i !== index));
  };

  const processBatchQueue = async () => {
      if (batchQueue.length === 0) return;
      setIsProcessing(true);
      try {
        const processedItems: {source: string, text: string, url: string}[] = [];
        for (const item of batchQueue) {
            const base64String = await compressImage(item.file);
            processedItems.push({
                source: base64String,
                text: item.text,
                url: base64String
            });
        }
        onBatchUpload(processedItems);
        generateCode(processedItems);
        setBatchQueue([]);
        setShowUpload(false);
        setInputText('');
      } catch (err) {
        console.error("Batch processing failed", err);
        alert("处理失败，请重试");
      } finally {
        setIsProcessing(false);
      }
  };

  const generateCode = (items: {url: string, text: string}[]) => {
     const snippets = items.map(item => {
         const safeText = item.text.replace(/'/g, "\\'");
         return `
  {
    id: 'memory_${Date.now()}_${Math.random().toString(36).substr(2,4)}',
    text: '${safeText}',
    url: '${item.url}'
  }`;
     });
     setGeneratedCode(snippets.join(',') + ',');
  };

  // --- MUSIC HANDLERS ---

  const handleMusicUploadInternal = async (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files.length > 0) {
       setIsProcessing(true);
       const files = Array.from(e.target.files);
       const newTracks: MusicTrack[] = [];

       for (const file of files) {
          try {
             const base64 = await new Promise<string>((resolve, reject) => {
                 const reader = new FileReader();
                 reader.readAsDataURL(file);
                 reader.onload = () => resolve(reader.result as string);
                 reader.onerror = reject;
             });
             newTracks.push({
                 name: file.name.replace(/\.[^/.]+$/, ""),
                 url: base64
             });
          } catch(err) {
              console.error("Error reading audio file", err);
          }
       }
       
       onAddTracks(newTracks);
       setIsProcessing(false);
     }
  };

  const generateMusicPlaylistCode = () => {
      const code = `
  PLAYLIST: [
    ${playlist.map(track => `
    {
      name: "${track.name.replace(/"/g, '\\"')}",
      url: "${track.url}" 
    }`).join(',')}
  ] as MusicTrack[],
      `;
      setMusicCode(code);
  };

  const resetForm = () => {
    setInputText('');
    setInputUrl('');
    setShowUpload(false);
    setBatchQueue([]);
  };

  const copyToClipboard = (text: string | null) => {
    if (text) {
      navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  };

  return (
    <div className="absolute inset-0 pointer-events-none p-6">
      {/* Title - Hidden in Romantic Mode AND Ending */}
      <div 
        className={`absolute top-8 left-0 right-0 flex justify-center z-10 mt-4 md:mt-8 transition-opacity duration-1000 ${
          treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <h1 className="text-5xl md:text-7xl font-['Mountains_of_Christmas'] font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-amber-400 drop-shadow-[0_2px_10px_rgba(255,215,0,0.5)] select-none tracking-wide pb-4 px-4 leading-relaxed">
          Merry Christmas!
        </h1>
      </div>

      {/* State Badge & Music Control */}
      <div className="absolute top-8 left-8 pointer-events-auto flex flex-col gap-3 z-30">
         <div className={`bg-black/30 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-amber-200 text-xs font-bold flex items-center gap-2 shadow-lg w-max transition-opacity duration-500 ${
             treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING ? 'opacity-0' : 'opacity-100'
         }`}>
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${gesture ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-red-400'}`} />
            {treeState} MODE
         </div>
         
         <div className="flex gap-2">
            <button 
              onClick={onToggleMusic}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all duration-300 shadow-lg w-max ${
                isMusicPlaying 
                  ? 'bg-amber-500/20 border-amber-300/50 text-amber-300 shadow-[0_0_15px_rgba(252,211,77,0.2)]' 
                  : 'bg-black/30 border-white/10 text-gray-400 hover:bg-black/40'
              }`}
            >
              <span className="text-lg">{isMusicPlaying ? '🎵' : '🔇'}</span>
              <span className="text-xs font-bold">{isMusicPlaying ? 'ON' : 'OFF'}</span>
            </button>
            
            <button
               onClick={() => setShowPlaylist(!showPlaylist)}
               className={`flex items-center justify-center w-10 h-10 rounded-full border transition-colors backdrop-blur-md shadow-lg ${showPlaylist ? 'bg-amber-500 text-black border-amber-400' : 'border-white/10 bg-black/30 text-amber-200 hover:bg-black/50'}`}
               title="Playlist"
            >
               ☰
            </button>
         </div>

         {/* Playlist Dropdown Panel */}
         {showPlaylist && (
            <div className="bg-[#0b1e13]/90 border border-amber-500/30 backdrop-blur-xl rounded-xl p-4 w-72 shadow-2xl animate-in fade-in slide-in-from-top-4 flex flex-col gap-3">
               <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-amber-300 font-bold text-sm">Now Playing</span>
                  {playlist.length > 0 && (
                      <span className="text-[10px] text-gray-400">{currentTrackIndex + 1} / {playlist.length}</span>
                  )}
               </div>
               
               {/* Current Track Display */}
               <div className="text-center py-2">
                  <div className="text-white text-sm font-medium truncate px-2">
                      {playlist[currentTrackIndex]?.name || "No Music"}
                  </div>
                  <div className="flex justify-center gap-4 mt-2">
                      <button onClick={onPrevTrack} className="text-amber-200 hover:text-white text-xl">⏮</button>
                      <button onClick={onToggleMusic} className="text-amber-200 hover:text-white text-xl">
                          {isMusicPlaying ? '⏸' : '▶'}
                      </button>
                      <button onClick={onNextTrack} className="text-amber-200 hover:text-white text-xl">⏭</button>
                  </div>
               </div>

               {/* Track List */}
               <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-amber-900 border-t border-white/5 pt-2">
                  {playlist.map((track, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => onSelectTrack(idx)}
                        className={`text-xs px-2 py-1.5 rounded cursor-pointer truncate flex items-center gap-2 ${idx === currentTrackIndex ? 'bg-amber-500/20 text-amber-300 border border-amber-500/20' : 'text-gray-400 hover:bg-white/5'}`}
                      >
                         <span className="opacity-50 w-4">{idx + 1}.</span>
                         {track.name}
                      </div>
                  ))}
               </div>
               
               {/* Actions */}
               <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                   <button 
                      onClick={() => musicInputRef.current?.click()}
                      className="bg-white/5 hover:bg-white/10 text-gray-300 text-xs py-2 rounded transition-colors flex items-center justify-center gap-1"
                   >
                      {isProcessing ? 'Loading...' : '+ Upload'}
                   </button>
                   <button 
                      onClick={generateMusicPlaylistCode}
                      className="bg-amber-900/40 hover:bg-amber-900/60 text-amber-200 text-xs py-2 rounded transition-colors"
                   >
                      💾 Export Config
                   </button>
               </div>
               <input 
                   ref={musicInputRef}
                   type="file" 
                   accept="audio/*" 
                   multiple 
                   className="hidden" 
                   onChange={handleMusicUploadInternal}
               />
            </div>
         )}
      </div>

      {/* Music Playlist Config Code Modal */}
      {musicCode && (
         <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-auto bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0b1e13] border border-amber-500/50 p-6 rounded-xl w-[90%] max-w-2xl shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
               <div className="flex items-center gap-2 text-amber-300">
                  <span className="text-xl">🎵</span>
                  <h3 className="font-bold text-lg">播放列表配置代码</h3>
               </div>
               <p className="text-gray-300 text-xs leading-relaxed">
                  为了保存你的播放列表，请将以下代码复制到 <code>data/config.ts</code> 中。
               </p>
               <ol className="list-decimal list-inside text-xs text-gray-400 space-y-1 bg-black/30 p-3 rounded border border-white/5">
                  <li>点击 <strong>复制列表代码</strong>。</li>
                  <li>打开 <code>data/config.ts</code>。</li>
                  <li>替换整个 <code>PLAYLIST: [...]</code> 数组。</li>
               </ol>
               
               <div className="bg-black/50 p-3 rounded text-[10px] font-mono text-gray-500 h-32 overflow-hidden relative break-all border border-white/5 shadow-inner">
                  {musicCode.substring(0, 600)}... <span className="text-amber-500">[剩余内容已隐藏]</span>
               </div>
               
               <div className="flex gap-3 justify-end mt-2">
                  <button 
                     onClick={() => setMusicCode(null)}
                     className="px-4 py-2 rounded text-gray-400 hover:text-white text-sm transition-colors"
                  >
                     关闭
                  </button>
                  <button 
                     onClick={() => {
                        copyToClipboard(musicCode);
                        alert("代码已复制！请替换 data/config.ts 中的 PLAYLIST 字段。");
                     }}
                     className="px-6 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-lg font-bold text-sm shadow-lg transition-all"
                  >
                     <span>📋</span> 复制列表代码
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Photo Code Modal */}
      {generatedCode && !musicCode && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-auto bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b1e13] border border-amber-500/50 p-6 rounded-xl w-[90%] max-w-2xl shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
             <div className="flex items-center gap-2 text-amber-300">
               <span className="text-xl">💾</span>
               <h3 className="font-bold text-lg">批量保存照片代码</h3>
             </div>
             <p className="text-gray-300 text-xs leading-relaxed">
               只需一键复制并粘贴到文件中即可永久保存。
             </p>
             <ol className="list-decimal list-inside text-xs text-gray-400 space-y-1 bg-black/30 p-3 rounded border border-white/5">
                <li>点击 <strong>复制所有代码</strong>。</li>
                <li>打开 <code>data/memories.ts</code>。</li>
                <li>粘贴到 <code>PRELOADED_MEMORIES</code> 数组中。</li>
             </ol>
             
             <div className="bg-black/50 p-3 rounded text-[10px] font-mono text-gray-500 overflow-y-auto h-40 relative break-all border border-white/5 shadow-inner">
               <pre className="whitespace-pre-wrap">{generatedCode}</pre>
             </div>
             
             <div className="flex gap-3 justify-end mt-2">
               <button 
                 onClick={() => setGeneratedCode(null)}
                 className="px-4 py-2 rounded text-gray-400 hover:text-white text-sm transition-colors"
               >
                 关闭
               </button>
               <button 
                 onClick={() => {
                    copyToClipboard(generatedCode);
                    alert("代码已复制！请粘贴到 data/memories.ts。");
                    setGeneratedCode(null);
                 }}
                 className="px-6 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-lg font-bold text-sm shadow-lg transition-all"
               >
                 <span>📋</span> 复制所有代码
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Batch Review Modal */}
      {batchQueue.length > 0 && !generatedCode && !musicCode && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-auto bg-black/90 backdrop-blur-md">
           <div className="bg-[#0b1e13] border border-amber-500/50 p-5 rounded-xl w-[90%] max-w-lg shadow-2xl flex flex-col gap-4 max-h-[80vh]">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                 <h3 className="text-amber-300 font-bold">批量编辑 ({batchQueue.length})</h3>
                 <button onClick={() => setBatchQueue([])} className="text-gray-400 hover:text-white">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-amber-900 scrollbar-track-transparent">
                 {batchQueue.map((item, idx) => (
                    <div key={idx} className="flex gap-3 bg-white/5 p-2 rounded-lg border border-white/5 items-start">
                       <img src={item.preview} alt="preview" className="w-16 h-16 object-cover rounded bg-black" />
                       <div className="flex-1 flex flex-col gap-1">
                          <span className="text-[10px] text-gray-500 truncate">{item.file.name}</span>
                          <input 
                             type="text" 
                             value={item.text}
                             onChange={(e) => handleUpdateBatchText(idx, e.target.value)}
                             className="bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white w-full focus:border-amber-500 outline-none"
                             placeholder="Enter memory text..."
                          />
                       </div>
                       <button onClick={() => handleRemoveBatchItem(idx)} className="text-red-400 hover:text-red-300 px-2">
                          ✕
                       </button>
                    </div>
                 ))}
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-end gap-2">
                 {isProcessing ? (
                    <div className="text-amber-300 text-sm animate-pulse">正在处理图片...</div>
                 ) : (
                    <button 
                      onClick={processBatchQueue}
                      className="px-6 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-lg font-bold text-sm shadow-lg transition-all"
                    >
                      确认并生成
                    </button>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Upload Interface (Photos) - Bottom Right */}
      {treeState === TreeState.CLOSED && (
        <div className="absolute bottom-8 right-8 pointer-events-auto flex flex-col items-end z-10">
          {!showUpload ? (
            <button 
              onClick={() => setShowUpload(true)}
              className="px-6 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-300/50 rounded-full text-amber-200 text-sm font-medium transition-all duration-300 backdrop-blur-sm shadow-[0_0_15px_rgba(252,211,77,0.1)] hover:shadow-[0_0_20px_rgba(252,211,77,0.3)] hover:scale-105 active:scale-95"
            >
              + Add Memory
            </button>
          ) : (
            <div className="bg-black/80 p-5 rounded-2xl border border-amber-500/30 backdrop-blur-xl flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 shadow-2xl w-80">
              <h3 className="text-amber-300 text-center font-['Mountains_of_Christmas'] text-xl tracking-wide">New Holiday Memory</h3>
              
              <div className="flex bg-white/10 p-1 rounded-lg">
                  <button 
                      onClick={() => setActiveTab('file')}
                      className={`flex-1 py-1 text-xs rounded-md transition-all ${activeTab === 'file' ? 'bg-amber-500 text-black font-bold shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                      Local Upload
                  </button>
                  <button 
                      onClick={() => setActiveTab('url')}
                      className={`flex-1 py-1 text-xs rounded-md transition-all ${activeTab === 'url' ? 'bg-amber-500 text-black font-bold shadow' : 'text-gray-400 hover:text-white'}`}
                  >
                      Remote Link
                  </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <input 
                    type="text" 
                    placeholder={activeTab === 'file' ? "Default text..." : "Write text first..."} 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="bg-white/5 border border-amber-200/20 rounded-lg px-4 py-2 text-white placeholder-white/30 outline-none focus:border-amber-400 transition-colors text-sm"
                  />

                  {activeTab === 'url' ? (
                      <>
                       <input 
                          type="url" 
                          required
                          placeholder="Paste Image URL..." 
                          value={inputUrl}
                          onChange={(e) => setInputUrl(e.target.value)}
                          className="bg-white/5 border border-amber-200/20 rounded-lg px-4 py-2 text-white placeholder-white/30 outline-none focus:border-amber-400 transition-colors text-xs font-mono"
                        />
                        <button type="submit" className="mt-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-lg">
                           Add Remote Memory
                        </button>
                      </>
                  ) : (
                      <div className="relative mt-2">
                          <label className={`flex items-center justify-center w-full px-4 py-3 border border-dashed rounded-lg cursor-pointer transition-colors border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20`}>
                              <div className="text-center">
                                  <span className={`text-xs text-amber-200`}>
                                      Select Photos (Batch)
                                  </span>
                              </div>
                              <input 
                                  type="file" 
                                  multiple
                                  accept="image/*"
                                  onChange={handleFileChange}
                                  className="hidden"
                              />
                          </label>
                      </div>
                  )}
              </form>

              <button onClick={resetForm} className="text-white/40 text-xs hover:text-white transition-colors text-center w-full">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
