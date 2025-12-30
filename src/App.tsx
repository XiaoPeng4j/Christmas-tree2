
import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { HandTracker } from './components/HandTracker';
import { UI } from './components/UI';
import { TreeState, PhotoData, HandGesture, MusicTrack } from './types';
import { assetService } from './services/AssetService';
import { APP_CONFIG } from './data/config';
import { gsap } from 'gsap';

// --- ROMANTIC CONTENT ---
const ROMANTIC_TEXT = `

终于快制作完成了，
大概花了一周时间吧，
这两三天我几乎每天都忙到很晚，
早上醒来第一件事还是想再调一点、再改一点，
结果有时候反而越改越乱了。

在制作的过程中，
我把我们以前一起拍过的很多照片都重新看了一遍，
感触真的很深。
我发现，我们一起经历了太多太多的第一次——
第一次去汤泉，
第一次去酒吧，
第一次赶海，
第一次去雪山，
第一次戴头饰，
第一次被涂指甲油
真的数都数不过来……

我慢慢意识到，
我们在一起的意义，
也许就是去体验这些“第一次”。
那种开心、那种兴奋，
我相信即使过了很多年，
再想起来的时候，
心里依然会是温暖和快乐的。

现在想想，
我真的很幸运，
能够遇到你，
能够和你一起经历这么多。

以前的我并不够懂你，
也会忽略你的感受，
让你受委屈、一个人偷偷地哭。
真的很不应该。

这么可爱、这么漂亮，
又这么体贴、这么关心我的宝宝，
我怎么舍得再让你受委屈呢。
我想把你捧在手心里，
好好地呵护你，
珍惜你。

这是我们一起度过的第二个圣诞节。
希望以后，
我们还能一起过很多很多节日，
一直过到我们老了走不动为止...`;

interface RomanticScrollerProps {
  active: boolean;
  onComplete: () => void;
}

const RomanticScroller: React.FC<RomanticScrollerProps> = ({ active, onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active) {
      const container = containerRef.current;
      const text = textRef.current;
      if (!container || !text) return;
      // Kill previous animations
      gsap.killTweensOf(container);
      gsap.killTweensOf(text);

      // 1. Initial State
      gsap.set(container, { opacity: 0 });
      gsap.set(text, { y: 0 }); // Reset text position

      // Create Timeline
      const tl = gsap.timeline({
          onComplete: () => {
              onComplete();
          }
      });

      // 2. Fade In Container (Slow & Graceful)
      tl.to(container, { 
        opacity: 1, 
        duration: 3.0, 
        ease: "power2.out" 
      });

      // 3. Wait for viewer to settle (Longer pause)
      tl.to({}, { duration: 2.5 });

      // 4. Scroll Text (Much Slower)
      const containerHeight = container.clientHeight;
      const textHeight = text.clientHeight;
      // Scroll until the bottom of the text + padding aligns with bottom of container
      const distance = textHeight - containerHeight + 200; 
      
      if (distance > 0) {
          const speed = 15; // Decreased from 30 to 15 for a very calm read
          const duration = distance / speed;

          tl.to(text, {
              y: -distance,
              duration: duration,
              ease: "none", 
          });
      }

      // 5. Pause at end (Longer pause to absorb the ending)
      tl.to({}, { duration: 5.0 });

      // 6. Fade Out Container
      tl.to(container, { 
        opacity: 0, 
        duration: 2.5, 
        ease: "power2.inOut" 
      });

      return () => {
        tl.kill();
      };
    } else {
       if (containerRef.current) {
           gsap.set(containerRef.current, { opacity: 0 });
       }
    }
  }, [active, onComplete]);

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none z-40 flex justify-center overflow-hidden transition-opacity duration-500 ${active ? 'visible' : 'invisible'}`}
      style={{ opacity: 0 }} 
    >
        {/* Mask Container */}
        <div className="relative w-full max-w-2xl h-[80vh] mt-[10vh] overflow-hidden mask-image-gradient">
            {/* Text Wrapper */}
            <div 
                ref={textRef}
                className="absolute top-0 left-0 w-full px-8 pb-20"
            >
                 <div className="font-['ZCOOL_KuaiLe',_'KaiTi',_serif] text-xl md:text-2xl text-pink-100/90 leading-[2.5] tracking-widest text-left whitespace-pre-wrap drop-shadow-[0_0_10px_rgba(255,182,193,0.6)]" style={{ textShadow: "0 0 15px rgba(255,105,180,0.5)" }}>
                    {ROMANTIC_TEXT}
                 </div>
            </div>
            
            {/* Gradient Masks for cinematic fade edges */}
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#0b1e13] via-[#0b1e13]/80 to-transparent z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#0b1e13] via-[#0b1e13]/80 to-transparent z-10 pointer-events-none" />
        </div>
    </div>
  );
};

// --- ENDING SCENE OVERLAY ---
interface RomanticEndingOverlayProps {
    active: boolean;
    onComplete: () => void;
}

const RomanticEndingOverlay: React.FC<RomanticEndingOverlayProps> = ({ active, onComplete }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const heartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (active) {
            const container = containerRef.current;
            const heart = heartRef.current;
            if(!container || !heart) return;

            gsap.killTweensOf(container);
            gsap.killTweensOf(heart);

            // Initial
            gsap.set(container, { opacity: 0 });
            gsap.set(heart, { scale: 0.8 });

            const tl = gsap.timeline({
                onComplete: () => {
                    onComplete();
                }
            });

            // 1. Fade In
            tl.to(container, { opacity: 1, duration: 2.0, ease: "power2.out" });

            // 2. Heartbeat Animation Loop (concurrent)
            gsap.to(heart, {
                scale: 1.05,
                duration: 1.2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut"
            });

            // 3. Hold for 5 seconds
            tl.to({}, { duration: 5.0 });

            // 4. Fade Out
            tl.to(container, { opacity: 0, duration: 2.5, ease: "power2.inOut" });

        } else {
             if (containerRef.current) gsap.set(containerRef.current, { opacity: 0 });
        }
    }, [active, onComplete]);

    if (!active) return null;

    return (
        <div ref={containerRef} className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none bg-black/60 backdrop-blur-sm">
            <div ref={heartRef} className="relative flex flex-col items-center justify-center gap-6 md:gap-8">
                {/* Big Glowing Heart SVG - Softened Glow */}
                <div className="relative">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-40 h-40 md:w-56 md:h-56 text-pink-500/90 drop-shadow-[0_0_25px_rgba(244,114,182,0.6)]">
                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                    {/* Inner shine - Softer */}
                    <svg viewBox="0 0 24 24" fill="currentColor" className="absolute top-0 left-0 w-40 h-40 md:w-56 md:h-56 text-rose-200 opacity-20 mix-blend-screen">
                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                </div>

                {/* Confession Text - Refined & Elegant */}
                <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
                    <div className="font-['ZCOOL_KuaiLe'] text-3xl md:text-5xl text-rose-200 tracking-wider drop-shadow-md">
                        盼盼，
                    </div>
                    {/* Changed from Great Vibes to Mountains of Christmas for a warmer, clearer look */}
                    <div className="font-['Mountains_of_Christmas'] font-bold text-4xl md:text-6xl text-rose-50 tracking-wide drop-shadow-md mt-2">
                        I love you forever!!!
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- PROGRESS RING COMPONENT ---
const HoldProgressRing: React.FC<{ progress: number }> = ({ progress }) => {
  if (progress <= 0) return null;
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none flex flex-col items-center justify-center gap-4">
       <div className="relative w-24 h-24">
          <svg height="100%" width="100%" className="rotate-[-90deg]">
             <circle
               stroke="rgba(255,255,255,0.2)"
               strokeWidth={stroke}
               fill="transparent"
               r={normalizedRadius}
               cx={radius + 8}
               cy={radius + 8}
             />
             <circle
               stroke="#f472b6"
               strokeWidth={stroke}
               strokeLinecap="round"
               fill="transparent"
               r={normalizedRadius}
               cx={radius + 8}
               cy={radius + 8}
               style={{
                  strokeDasharray: circumference + ' ' + circumference,
                  strokeDashoffset,
                  transition: 'stroke-dashoffset 0.1s linear'
               }}
             />
          </svg>
       </div>
       <div className="text-pink-200 font-bold tracking-widest text-sm drop-shadow-md animate-pulse">
          HOLD FOR SURPRISE
       </div>
    </div>
  );
};


const App: React.FC = () => {
  const [treeState, setTreeState] = useState<TreeState>(TreeState.CLOSED);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [focusedPhotoId, setFocusedPhotoId] = useState<string | null>(null);
  const [gesture, setGesture] = useState<HandGesture | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewedPhotoIds, setViewedPhotoIds] = useState<Set<string>>(new Set());

  // --- ROMANTIC TRIGGER STATE ---
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100
  const holdStartRef = useRef<number | null>(null);
  const lastStablePosRef = useRef<{x: number, y: number, z: number} | null>(null);
  const ROMANTIC_HOLD_DURATION = 3000; // 3 seconds
  const STABILITY_THRESHOLD = 0.05; // Slightly increased for two-hand jitter

  // --- AUDIO STATE ---
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const [playlist, setPlaylist] = useState<MusicTrack[]>(APP_CONFIG.PLAYLIST);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const prevGestureType = useRef<HandGesture['type']>('NONE');
  const prevSecondaryType = useRef<HandGesture['type']>('NONE');

  // Load assets
  useEffect(() => {
    const loadAssets = async () => {
      try {
        const loadedPhotos = await assetService.getAssets();
        setPhotos(loadedPhotos);
      } catch (error) {
        console.error("Failed to load assets:", error);
      }
    };
    loadAssets();
  }, []);

  // --- AUDIO LOGIC ---
  
  // 1. Initialize Audio Object
  useEffect(() => {
    const audio = new Audio();
    audio.volume = APP_CONFIG.MUSIC_VOLUME;
    audioRef.current = audio;

    const handleEnded = () => {
       // If looping (Romantic mode), this won't trigger often, but logic is handled by loop=true attribute
       handleNextTrack();
    };
    
    // Error handling to prevent "No supported sources" crash
    const handleError = (e: Event) => {
        console.warn("Audio load error (check file path):", audio.src);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    }
  }, []);

  // 2. Handle Safe Playback Helper
  const safePlay = async () => {
      const audio = audioRef.current;
      if (!audio || !audio.src) return;
      
      try {
          await audio.play();
          setIsMusicPlaying(true);
      } catch (err: any) {
          if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
              console.error("Playback failed:", err);
          }
          if (err.name === 'NotAllowedError') {
              setIsMusicPlaying(false);
          }
      }
  };

  // 3. Handle Track Change (Load Source) - STANDARD PLAYLIST ONLY
  useEffect(() => {
    if (!audioRef.current || playlist.length === 0) return;
    
    // If we are in Romantic mode, do not let playlist changes override the specific song
    if (treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING) return;

    const audio = audioRef.current;
    const track = playlist[currentTrackIndex];

    if (!track || !track.url) return;

    const currentAudioSrc = audio.src;
    const isSameTrack = currentAudioSrc === track.url || currentAudioSrc.endsWith(track.url.replace(/^\.\//, ''));

    if (!isSameTrack) {
        audio.src = track.url;
        audio.loop = false; // Ensure normal tracks don't loop indefinitely
        if (isMusicPlaying) {
            safePlay();
        }
    }
  }, [currentTrackIndex, playlist, treeState]);

  // 4. Handle Romantic Music Mode Switching
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (treeState === TreeState.ROMANTIC) {
        // --- ENTERING ROMANTIC MODE ---
        // Switch to special romantic track
        audio.src = APP_CONFIG.ROMANTIC_MUSIC_URL;
        audio.loop = true; // Loop during the long scrolling text
        safePlay();
        setIsMusicPlaying(true);
    } 
    else if (treeState === TreeState.CLOSED) {
        // --- RETURNING TO NORMAL MODE ---
        // Only reset music if we are coming from a state where we might have changed it
        // Check if current source is the romantic one to avoid unnecessary reloads on init
        const isRomanticTrack = audio.src.endsWith(APP_CONFIG.ROMANTIC_MUSIC_URL.replace(/^\.\//, ''));
        
        if (isRomanticTrack) {
            audio.loop = false;
            // Restore current playlist track
            if (playlist.length > 0) {
                const track = playlist[currentTrackIndex];
                if (track && track.url) {
                    audio.src = track.url;
                    // Optionally keep playing or pause based on preference. 
                    // Let's keep playing background music.
                    safePlay();
                }
            }
        }
    }
  }, [treeState, playlist, currentTrackIndex]);

  // 5. Handle Play/Pause Toggle State
  useEffect(() => {
      if (!audioRef.current) return;
      
      if (isMusicPlaying) {
          if (audioRef.current.paused && audioRef.current.src) {
              safePlay();
          }
      } else {
          audioRef.current.pause();
      }
  }, [isMusicPlaying,]);


  // 6. Initial Autoplay Attempt
  useEffect(() => {
     const attemptPlay = () => {
       if (playlist.length > 0 && audioRef.current && audioRef.current.paused) {
             if (!audioRef.current.src) {
                 audioRef.current.src = playlist[0].url;
             }
             safePlay().then(() => {
                document.removeEventListener('click', attemptPlay);
                document.removeEventListener('keydown', attemptPlay);
                document.removeEventListener('touchstart', attemptPlay);
             });
        }
     };

     document.addEventListener('click', attemptPlay);
     document.addEventListener('keydown', attemptPlay);
     document.addEventListener('touchstart', attemptPlay);

     return () => {
        document.removeEventListener('click', attemptPlay);
        document.removeEventListener('keydown', attemptPlay);
        document.removeEventListener('touchstart', attemptPlay);
     }
  }, [playlist]);


  const toggleMusic = () => {
    setIsMusicPlaying(prev => !prev);
  };

  const handleNextTrack = () => {
    if (playlist.length === 0) return;
    // Don't skip tracks in Romantic Mode
    if (treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING) return;
    setCurrentTrackIndex(prev => (prev + 1) % playlist.length);
    setIsMusicPlaying(true); 
  };

  const handlePrevTrack = () => {
      if (playlist.length === 0) return;
      if (treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING) return;
      setCurrentTrackIndex(prev => (prev - 1 + playlist.length) % playlist.length);
      setIsMusicPlaying(true); 
  };

  const handleSelectTrack = (index: number) => {
      if (treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING) return;
      setCurrentTrackIndex(index);
      setIsMusicPlaying(true);
  };

  const handleAddTracks = (newTracks: MusicTrack[]) => {
      setPlaylist(prev => [...prev, ...newTracks]);
      if (playlist.length === 0 && newTracks.length > 0) {
          setCurrentTrackIndex(0);
      }
  };

  // Keyboard Interaction for Flip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && treeState === TreeState.FOCUS) {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [treeState]);

  // Callback after the text scroller finishes
  const handleRomanticSequenceComplete = useCallback(() => {
    // Transition to the Ending Scene (Big Heart + Text)
    setTreeState(TreeState.ROMANTIC_ENDING);
    
    // Reset triggers logic just in case
    holdStartRef.current = null;
    setHoldProgress(0);
  }, []);

  // Callback after the Ending Scene (Heart) finishes
  const handleEndingSceneComplete = useCallback(() => {
    // Transition back to main tree
    setTreeState(TreeState.CLOSED);
  }, []);

  // Handle gesture-driven state changes
  useEffect(() => {
    
    // -----------------------------------------------------------------
    // 1. GLOBAL BLOCK: IF IN ROMANTIC MODE OR ENDING, IGNORE ALL GESTURES
    // -----------------------------------------------------------------
    if ((treeState as TreeState) === TreeState.ROMANTIC || (treeState as TreeState) === TreeState.ROMANTIC_ENDING) {
        // Reset trackers to be safe
        holdStartRef.current = null;
        if (holdProgress > 0) setHoldProgress(0);
        
        // Update refs so we don't have stale state when we exit
        if (gesture) {
            prevGestureType.current = gesture.type;
            prevSecondaryType.current = gesture.secondaryType || 'NONE';
        }
        return;
    }

    if (!gesture) {
      // 2. No gesture: Revert to CLOSED if not in Romantic
      if ((treeState as TreeState) !== TreeState.CLOSED) {
          setTreeState(TreeState.CLOSED);
          setFocusedPhotoId(null);
          setIsFlipped(false);
      }
      
      // Reset Romantic Hold Logic
      holdStartRef.current = null;
      lastStablePosRef.current = null;
      setHoldProgress(0);

      prevGestureType.current = 'NONE';
      prevSecondaryType.current = 'NONE';
      return;
    }

    const currentType = gesture.type;
    const currentSecondary = gesture.secondaryType || 'NONE';
    const currentPos = gesture.position;

    // -----------------------------------------------------------------
    // 3. ROMANTIC MODE TRIGGER LOGIC (HEART GESTURE HOLD)
    // -----------------------------------------------------------------
    if (currentType === 'HEART') {
        const now = Date.now();
        
        // A. Check Stability
        let isStable = false;
        if (lastStablePosRef.current) {
            const dist = Math.sqrt(
                Math.pow(currentPos.x - lastStablePosRef.current.x, 2) +
                Math.pow(currentPos.y - lastStablePosRef.current.y, 2) +
                Math.pow(currentPos.z - lastStablePosRef.current.z, 2)
            );
            // If movement is small, we consider it stable for this frame
            if (dist < STABILITY_THRESHOLD) {
                isStable = true;
            }
        } else {
            // First frame of Heart is always "stable" start point
            isStable = true;
        }

        // Update stability reference
        lastStablePosRef.current = currentPos;

        if (isStable) {
            if (!holdStartRef.current) {
                holdStartRef.current = now;
            }
            
            const elapsed = now - holdStartRef.current;
            const progress = Math.min((elapsed / ROMANTIC_HOLD_DURATION) * 100, 100);
            setHoldProgress(progress);

            if (elapsed >= ROMANTIC_HOLD_DURATION) {
                // TRIGGER!
                setTreeState(TreeState.ROMANTIC);
                setFocusedPhotoId(null);
                holdStartRef.current = null; // Reset
                setHoldProgress(0);
                return; // Exit immediately
            }
        } else {
            // Unstable: Reset timer, but user is still making Heart
            holdStartRef.current = now; // Restart timer
            setHoldProgress(0);
        }
    } else {
        // Not Heart: Reset everything
        holdStartRef.current = null;
        lastStablePosRef.current = null;
        setHoldProgress(0);
    }


    // -----------------------------------------------------------------
    // 4. NORMAL GESTURE STATE MACHINE (If not Triggering)
    // -----------------------------------------------------------------
    
    // Only process normal gestures if we aren't deep in the "hold" process 
    if (currentType !== 'HEART') {

        const prevType = prevGestureType.current;
        const prevSec = prevSecondaryType.current;

        // FIST: Close Tree
        if (currentType === 'FIST') {
        if (treeState !== TreeState.CLOSED) {
            setTreeState(TreeState.CLOSED);
            setFocusedPhotoId(null);
            setIsFlipped(false);
        }
        } 
        // PALM: Scatter Tree
        else if (currentType === 'PALM') {
        if (treeState !== TreeState.SCATTERED && treeState !== TreeState.FOCUS) {
            setTreeState(TreeState.SCATTERED);
            setFocusedPhotoId(null);
            setIsFlipped(false);
        }
        } 
        // GRAB: Interaction
        else if (currentType === 'GRAB') {
            if (treeState === TreeState.SCATTERED && prevType !== 'GRAB') {
                const unviewed = photos.filter(p => !viewedPhotoIds.has(p.id));
                let targetId: string | null = null;
                let nextViewed = new Set(viewedPhotoIds);

                if (unviewed.length > 0) {
                    const idx = Math.floor(Math.random() * unviewed.length);
                    targetId = unviewed[idx].id;
                    nextViewed.add(targetId);
                } else if (photos.length > 0) {
                    const idx = Math.floor(Math.random() * photos.length);
                    targetId = photos[idx].id;
                    nextViewed = new Set([targetId]);
                }

                if (targetId) {
                setViewedPhotoIds(nextViewed);
                setFocusedPhotoId(targetId);
                setIsFlipped(false); 
                setTreeState(TreeState.FOCUS);
                }
            }

            if (treeState === TreeState.FOCUS) {
            if (currentSecondary === 'PALM' && prevSec !== 'PALM') {
                setIsFlipped(prev => !prev);
            }
            }
        } 
        
        // Exit Focus if ungrabbed (optional, or rely on Palm/Fist)
        if (treeState === TreeState.FOCUS && prevType === 'GRAB' && currentType === 'PALM') {
            setTreeState(TreeState.SCATTERED);
            setFocusedPhotoId(null);
            setIsFlipped(false);
        }
    }

    prevGestureType.current = currentType;
    prevSecondaryType.current = currentSecondary;

  }, [gesture, treeState, photos, viewedPhotoIds, holdProgress]);

  const handlePhotoUpload = async (source: File | string, text: string) => {
    try {
      const newPhoto = await assetService.saveAsset(source, text);
      setPhotos(prev => [...prev, newPhoto]);
    } catch (error) {
      console.error("Failed to save uploaded asset:", error);
    }
  };

  const handleBatchUpload = async (items: {source: File | string, text: string}[]) => {
    try {
      const newPhotos = await assetService.saveAssets(items);
      setPhotos(prev => [...prev, ...newPhotos]);
    } catch (error) {
      console.error("Failed to save batch assets:", error);
    }
  };

  const handleSelectPhoto = (id: string) => {
    if (treeState === TreeState.SCATTERED) {
      setFocusedPhotoId(id);
      setIsFlipped(false); 
      setTreeState(TreeState.FOCUS);
    }
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-[#0f172a] to-[#051a10] overflow-hidden">
      <Canvas
        shadows
        dpr={[1, 2]} 
        camera={{ position: [0, 1.0, 25], fov: 40 }} 
        gl={{ antialias: true, alpha: true, toneMappingExposure: 1.5 }}
        className="w-full h-full"
      >
        <Suspense fallback={null}>
          <Scene 
            treeState={treeState} 
            photos={photos} 
            focusedPhotoId={focusedPhotoId}
            isFlipped={isFlipped}
            handGesture={gesture}
            onSelectPhoto={handleSelectPhoto}
          />
        </Suspense>
      </Canvas>

      <HandTracker onGesture={setGesture} />

      <UI 
        treeState={treeState} 
        onUpload={handlePhotoUpload} 
        onBatchUpload={handleBatchUpload}
        gesture={gesture}
        
        // Audio Props
        isMusicPlaying={isMusicPlaying}
        onToggleMusic={toggleMusic}
        playlist={playlist}
        currentTrackIndex={currentTrackIndex}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        onSelectTrack={handleSelectTrack}
        onAddTracks={handleAddTracks}
      />
      
      {/* Visual Feedback for Romantic Hold Trigger */}
      <HoldProgressRing progress={holdProgress} />
      
      {/* ROMANTIC MESSAGE OVERLAY - Cinematic Scroller */}
      {/* Only active during ROMANTIC state */}
      <RomanticScroller active={treeState === TreeState.ROMANTIC} onComplete={handleRomanticSequenceComplete} />

      {/* ROMANTIC ENDING OVERLAY - Big Heart + Final Text */}
      <RomanticEndingOverlay active={treeState === TreeState.ROMANTIC_ENDING} onComplete={handleEndingSceneComplete} />

      {/* Legend */}
      <div className={`absolute bottom-6 left-6 pointer-events-none text-amber-100/90 text-sm tracking-widest font-light mix-blend-screen z-20 font-[sans-serif] transition-opacity duration-500 ${treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex flex-col gap-3 drop-shadow-md bg-black/20 p-5 rounded-xl border border-white/10 backdrop-blur-md">
          <p className="flex items-center gap-3">
            <span className="text-2xl">✊</span> 
            <span><span className="font-bold text-amber-300">握拳</span> : 聚拢</span>
          </p>
          <p className="flex items-center gap-3">
            <span className="text-2xl">✋</span> 
            <span><span className="font-bold text-amber-300">张开</span> : 散开</span>
          </p>
          <div className="flex flex-col gap-1 border-l-2 border-amber-300/30 pl-3">
            <p className="flex items-center gap-3">
              <span className="text-2xl">🤏</span> 
              <span><span className="font-bold text-amber-300">抓取</span> : 看照片</span>
            </p>  
            <p className="flex items-center gap-3">
              <span className="text-2xl">✋+ 🤏</span> 
              <span><span className="font-bold text-amber-300">张开且抓取</span> : 翻转照片</span>
            </p>
          </div>
          {/* Heart Gesture Legend */}
        </div>
      </div>
    </div>
  );
};

export default App;
