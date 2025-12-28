
import React, { useEffect, useRef } from 'react';
import { HandGesture } from '../types';

interface HandTrackerProps {
  onGesture: (gesture: HandGesture | null) => void;
}

export const HandTracker: React.FC<HandTrackerProps> = ({ onGesture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically load MediaPipe Hands and Camera Utils if not already on window
    if (!(window as any).Hands || !(window as any).Camera) {
      console.error("MediaPipe libraries not loaded");
      return;
    }

    const hands = new (window as any).Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2, // Enable 2 hands detection
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults(onResults);
    handsRef.current = hands;

    if (videoRef.current) {
      const camera = new (window as any).Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && handsRef.current) {
             await handsRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
      camera.start();
      cameraRef.current = camera;
    }

    return () => {
      if (handsRef.current) {
        handsRef.current.close();
      }
      if (cameraRef.current) {
         // Camera utils cleaning
      }
    };
  }, []);

  function onResults(results: any) {
    // Check for Two-Hand Heart Gesture first (Global override)
    if (results.multiHandLandmarks && results.multiHandLandmarks.length === 2) {
      const hand1 = results.multiHandLandmarks[0];
      const hand2 = results.multiHandLandmarks[1];
      
      if (isTwoHandHeart(hand1, hand2)) {
         // Calculate center position of the heart (average of index tips)
         const midX = (hand1[8].x + hand2[8].x) / 2;
         const midY = (hand1[8].y + hand2[8].y) / 2;
         const midZ = (hand1[8].z + hand2[8].z) / 2;

         onGesture({
           type: 'HEART',
           position: { x: midX, y: midY, z: midZ },
           rotation: { x: 0, y: 0, z: 0 },
           secondaryType: 'NONE'
         });
         return;
      }
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const gestures: HandGesture[] = results.multiHandLandmarks.map((landmarks: any) => 
        analyzeSingleHand(landmarks)
      );

      // LOGIC: Determine Primary vs Secondary Hand
      // 1. If we have a GRAB, that is the Primary (controlling position).
      // 2. The other hand becomes Secondary (controlling triggers like Flip).
      
      const grabIndex = gestures.findIndex(g => g.type === 'GRAB');
      
      let primaryGesture: HandGesture;
      let secondaryType: HandGesture['type'] = 'NONE';

      // Check for V-Sign in any hand to trigger special state (Legacy/Backup)
      const vSignIndex = gestures.findIndex(g => g.type === 'VSIGN');
      if (vSignIndex !== -1) {
          // If V-Sign detected, it overrides navigation
          primaryGesture = gestures[vSignIndex];
          if (gestures.length > 1) {
             secondaryType = gestures[vSignIndex === 0 ? 1 : 0].type;
          }
      } else if (grabIndex !== -1) {
        // We have a grabber
        primaryGesture = gestures[grabIndex];
        // If there is another hand, get its type
        if (gestures.length > 1) {
          // The other hand is the one that isn't the grabIndex
          const otherIndex = grabIndex === 0 ? 1 : 0;
          secondaryType = gestures[otherIndex].type;
        }
      } else {
        // No grabber, default to the first detected hand as primary
        primaryGesture = gestures[0];
        if (gestures.length > 1) {
          secondaryType = gestures[1].type;
        }
      }

      // Merge into final result
      onGesture({
        ...primaryGesture,
        secondaryType
      });

    } else {
      onGesture(null);
    }
  }

  function isTwoHandHeart(landmarks1: any[], landmarks2: any[]): boolean {
    // 4 = Thumb Tip, 8 = Index Tip
    const thumb1 = landmarks1[4];
    const index1 = landmarks1[8];
    const thumb2 = landmarks2[4];
    const index2 = landmarks2[8];

    // Distance threshold for "touching" (normalized coords 0-1)
    const TOUCH_THRESHOLD = 0.15;

    // Check distances between tips
    const thumbDist = Math.hypot(thumb1.x - thumb2.x, thumb1.y - thumb2.y);
    const indexDist = Math.hypot(index1.x - index2.x, index1.y - index2.y);

    // Basic check: Thumbs close, Index close
    if (thumbDist < TOUCH_THRESHOLD && indexDist < TOUCH_THRESHOLD) {
        // Shape check: Index tips should be ABOVE Thumb tips (y is smaller for higher up)
        // This ensures fingers are pointing up/arching, not just a fist bump
        if (index1.y < thumb1.y && index2.y < thumb2.y) {
            return true;
        }
    }
    return false;
  }

  function analyzeSingleHand(landmarks: any[]): HandGesture {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];

    // Distance thumb to index
    const grabDist = Math.sqrt(
      Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2)
    );

    // Finger extensions relative to PIP joint (using PIP y vs Tip y)
    // In MediaPipe, smaller Y is higher.
    const isFingerExtended = (tipIndex: number, pipIndex: number) => {
        return landmarks[tipIndex].y < landmarks[pipIndex].y;
    };

    const indexExt = isFingerExtended(8, 6);
    const middleExt = isFingerExtended(12, 10);
    const ringExt = isFingerExtended(16, 14);
    const pinkyExt = isFingerExtended(20, 18);

    const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

    let type: HandGesture['type'] = 'NONE';
    
    // 1. V-SIGN (Peace): Index & Middle Extended, Ring & Pinky Curled
    if (indexExt && middleExt && !ringExt && !pinkyExt) {
        type = 'VSIGN';
    }
    // 2. GRAB (Pinch): Thumb and Index close. 
    // Checked BEFORE Palm to allow "OK sign" pinch to register as Grab.
    else if (grabDist < 0.05) {
      type = 'GRAB';
    }
    // 3. FIST: All fingers curled (extendedCount 0 or 1 for loose thumb)
    else if (extendedCount === 0) {
      type = 'FIST';
    } 
    // 4. PALM: Fingers extended and not pinching
    else if (extendedCount >= 3) {
      type = 'PALM';
    }

    return {
      type,
      position: { x: wrist.x, y: wrist.y, z: wrist.z },
      rotation: { x: 0, y: 0, z: 0 },
      secondaryType: 'NONE' // Placeholder
    };
  }

  return (
    <video
      ref={videoRef}
      className="absolute top-4 right-4 w-48 h-36 rounded-lg border-2 border-amber-300/30 opacity-40 mirror pointer-events-none z-50"
      style={{ transform: 'scaleX(-1)', objectFit: 'cover' }}
      autoPlay
      playsInline
      muted
      width={640}
      height={480}
    />
  );
};
