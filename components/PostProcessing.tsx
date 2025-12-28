import React from 'react';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';

export const PostProcessing: React.FC = () => {
  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom 
        intensity={1.0} 
        luminanceThreshold={0.5} 
        luminanceSmoothing={0.9} 
        height={300} 
      />
      <Noise opacity={0.01} /> 
      {/* Reduced darkness for lighter feel */}
      <Vignette eskil={false} offset={0.1} darkness={0.4} /> 
    </EffectComposer>
  );
};