
import React, { useMemo, useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeState, PhotoData, HandGesture, COLORS } from '../types';
import { PostProcessing } from './PostProcessing';
import { gsap } from 'gsap';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      pointLight: any;
      group: any;
      instancedMesh: any;
      sphereGeometry: any;
      meshStandardMaterial: any;
      mesh: any;
      points: any;
      bufferGeometry: any;
      bufferAttribute: any;
      planeGeometry: any;
      boxGeometry: any;
      meshBasicMaterial: any;
      octahedronGeometry: any;
      icosahedronGeometry: any;
      tetrahedronGeometry: any;
      pointsMaterial: any;
      color: any;
      fog: any;
      coneGeometry: any;
      cylinderGeometry: any;
      capsuleGeometry: any;
      torusGeometry: any;
      sprite: any;
      spriteMaterial: any;
      circleGeometry: any;
      shapeGeometry: any;
      extrudeGeometry: any;
      [elemName: string]: any;
    }
  }
}

interface SceneProps {
  treeState: TreeState;
  photos: PhotoData[];
  focusedPhotoId: string | null;
  isFlipped: boolean;
  handGesture: HandGesture | null;
  onSelectPhoto: (id: string) => void;
}

// RESTORED LIGHT COUNT
const TOTAL_ELEMENTS = 1000; 
const BRANCH_COUNT = 500;
const ORNAMENT_COUNT = 150;
const LIGHT_COUNT = 350; 

// Helper to distribute items in a cone
const getConePosition = (normHeight: number, maxRadius: number, bias: 'surface' | 'volume' | 'spiral', index = 0) => {
  const h = 12; 
  const y = (normHeight * h) - (h / 2) + 0.5; 
  const rBase = (1 - Math.pow(normHeight, 0.75)) * maxRadius; 
  
  let theta = Math.random() * Math.PI * 2;
  let r = rBase;

  if (bias === 'volume') {
    r = rBase * Math.sqrt(Math.random()) * 0.95; 
    theta = index * 2.39996; 
  } else if (bias === 'surface') {
    r = rBase * 0.85 + Math.random() * 0.4; 
  } else if (bias === 'spiral') {
    const spiralTurns = 9;
    theta = normHeight * Math.PI * 2 * spiralTurns;
    r = rBase + 0.25; 
  }

  return new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
};

export const Scene: React.FC<SceneProps> = ({ 
  treeState, 
  photos, 
  focusedPhotoId, 
  isFlipped,
  handGesture,
  onSelectPhoto 
}) => {
  const { camera } = useThree();
  
  const branchesRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const ornamentSpheresRef = useRef<THREE.InstancedMesh>(null);
  const ornamentBoxesRef = useRef<THREE.InstancedMesh>(null);
  const ornamentDiamondsRef = useRef<THREE.InstancedMesh>(null);
  
  const groupRef = useRef<THREE.Group>(null);
  const starRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // References to all photo groups for interaction
  const photoRefs = useRef<(THREE.Group | null)[]>([]);
  
  // Track drift intensity for smooth transitions (0 = closed, 1 = scattered)
  const driftIntensity = useRef(0);
  
  // Track star visibility state for animation (1 = visible, 0 = hidden)
  const starVisibility = useRef(1);

  // Target Transforms for Group (Tree)
  const groupTarget = useRef({ 
    pos: new THREE.Vector3(0, -1.0, 0), 
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(0.85, 0.85, 0.85)
  });

  const animState = useRef(Array.from({ length: TOTAL_ELEMENTS }, (_, i) => {
    let type: 'branch' | 'ornament' | 'light';
    let ornamentType: 'sphere' | 'box' | 'diamond' = 'sphere';
    let treePos: THREE.Vector3;
    let baseScale = 1;
    let color = new THREE.Color();
    let rotationSpeed = new THREE.Vector3();

    if (i < BRANCH_COUNT) {
      type = 'branch';
      const norm = i / BRANCH_COUNT;
      treePos = getConePosition(norm, 6.0, 'volume', i);
      baseScale = 0.5 + Math.random() * 0.3; 
      color.set(COLORS.TREE_GREEN).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15); 
      rotationSpeed.set(Math.random()*0.01, Math.random()*0.01, Math.random()*0.01);
    } else if (i < BRANCH_COUNT + ORNAMENT_COUNT) {
      type = 'ornament';
      const rand = Math.random();
      if (rand < 0.5) ornamentType = 'sphere';
      else if (rand < 0.8) ornamentType = 'box';
      else ornamentType = 'diamond';

      const norm = (i - BRANCH_COUNT) / ORNAMENT_COUNT;
      treePos = getConePosition(norm, 5.8, 'surface');
      
      if (ornamentType === 'sphere') baseScale = 0.35 + Math.random() * 0.25;
      if (ornamentType === 'box') baseScale = 0.3 + Math.random() * 0.2; 
      if (ornamentType === 'diamond') baseScale = 0.25 + Math.random() * 0.2;

      if (Math.random() > 0.4) color.set(COLORS.GOLD);
      else color.set(COLORS.RED);
      
      rotationSpeed.set(Math.random()*0.02, Math.random()*0.02, Math.random()*0.02);
    } else {
      type = 'light';
      const norm = (i - (BRANCH_COUNT + ORNAMENT_COUNT)) / LIGHT_COUNT;
      treePos = getConePosition(norm, 6.2, 'spiral');
      baseScale = 0.18; 
      color.set(COLORS.LIGHT_WARM);
    }

    // SPHERICAL FORMATION logic
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    
    const layerRand = Math.random();
    let radius;
    
    if (layerRand < 0.20) {
      radius = 4.5 + Math.random() * 3.0;
    } else if (layerRand < 0.85) {
      radius = 7.5 + Math.random() * 5.0;
    } else {
      radius = 12.5 + Math.random() * 2.0;
    }

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi) + 1.5; 
    const z = radius * Math.sin(phi) * Math.sin(theta);

    const scatterPos = new THREE.Vector3(x, y, z);

    return {
      type,
      ornamentType,
      treePos,
      scatterPos,
      currentPos: treePos.clone(),
      currentScale: 0,
      baseScale,
      color,
      rotationSpeed,
      phase: Math.random() * Math.PI * 2,
    };
  }));

  useEffect(() => {
    if (!branchesRef.current || !ornamentSpheresRef.current || !ornamentBoxesRef.current || !ornamentDiamondsRef.current || !lightsRef.current) return;
    
    let bIdx = 0, osIdx = 0, obIdx = 0, odIdx = 0, lIdx = 0;
    
    animState.current.forEach((item) => {
      if (item.type === 'branch') {
        branchesRef.current!.setColorAt(bIdx++, item.color);
      } else if (item.type === 'ornament') {
        if (item.ornamentType === 'sphere') ornamentSpheresRef.current!.setColorAt(osIdx++, item.color);
        else if (item.ornamentType === 'box') ornamentBoxesRef.current!.setColorAt(obIdx++, item.color);
        else ornamentDiamondsRef.current!.setColorAt(odIdx++, item.color);
      } else {
        lightsRef.current!.setColorAt(lIdx++, item.color);
      }
    });
    
    branchesRef.current.instanceColor!.needsUpdate = true;
    ornamentSpheresRef.current.instanceColor!.needsUpdate = true;
    ornamentBoxesRef.current.instanceColor!.needsUpdate = true;
    ornamentDiamondsRef.current.instanceColor!.needsUpdate = true;
    lightsRef.current.instanceColor!.needsUpdate = true;
  }, []);

  useEffect(() => {
    const isClosed = treeState === TreeState.CLOSED;
    const isRomantic = treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING;
    
    // Animate Star Visibility - Hide in Romantic
    gsap.to(starVisibility, {
      current: (isClosed && !isRomantic) ? 1 : 0,
      duration: 1.0, 
      ease: "power2.inOut"
    });
    
    animState.current.forEach((item, i) => {
      // Logic:
      // CLOSED: items at treePos
      // SCATTERED/FOCUS: items at scatterPos
      // ROMANTIC / ENDING: items at currentPos but SCALE to 0 (Hide Tree)

      if (isRomantic) {
          // Scale to 0 to hide
          gsap.to(item, {
              currentScale: 0,
              duration: 1.5,
              ease: "power2.in",
              delay: Math.random() * 0.5
          });
      } else {
          // Normal states
          const useScatter = !isClosed;
          const targetPos = useScatter ? item.scatterPos : item.treePos;
          
          gsap.to(item.currentPos, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: isClosed ? 1.6 : 2.0, 
            ease: isClosed ? "back.out(0.6)" : "power2.inOut", 
            delay: isClosed ? (1 - (item.treePos.y + 7)/14) * 0.4 : Math.random() * 0.3,
          });

          const targetScale = isClosed ? item.baseScale : item.baseScale * 0.6;
          gsap.to(item, {
            currentScale: targetScale,
            duration: 1.0,
            ease: "back.out(1.2)",
            delay: i * 0.0001
          });
      }
    });

    // Reset Group Transform when closing or in ending
    if (treeState === TreeState.CLOSED || treeState === TreeState.ROMANTIC_ENDING) {
       gsap.to(groupTarget.current.pos, { x: 0, y: -1.0, z: 0, duration: 1.0 });
       gsap.to(groupTarget.current.rot, { x: 0, y: 0, z: 0, duration: 1.0 });
    }

  }, [treeState]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Drift: CLOSED=0, SCATTERED=1, FOCUS=1
    const targetDrift = (treeState === TreeState.SCATTERED || treeState === TreeState.FOCUS) ? 1 : 0;
    driftIntensity.current = THREE.MathUtils.lerp(driftIntensity.current, targetDrift, 0.05);

    // --- INTERACTION & GROUP TRANSFORMS ---
    // Move group based on hand only when NOT in FOCUS mode or when in SCATTERED
    
    if (treeState === TreeState.SCATTERED && handGesture) {
        const ndcX = (handGesture.position.x - 0.5) * 2; 
        const ndcY = -((handGesture.position.y - 0.5) * 2);

        const moveRangeX = 8;
        const moveRangeY = 4;
        const rotRangeY = 0.8;
        const rotRangeX = 0.4;

        groupTarget.current.pos.x = THREE.MathUtils.lerp(groupTarget.current.pos.x, ndcX * moveRangeX, 0.05);
        groupTarget.current.pos.y = THREE.MathUtils.lerp(groupTarget.current.pos.y, ndcY * moveRangeY - 1.0, 0.05);
        groupTarget.current.rot.y = THREE.MathUtils.lerp(groupTarget.current.rot.y, ndcX * rotRangeY, 0.05);
        groupTarget.current.rot.x = THREE.MathUtils.lerp(groupTarget.current.rot.x, -ndcY * rotRangeX, 0.05);

    } else if (treeState === TreeState.FOCUS) {
        groupTarget.current.pos.x = THREE.MathUtils.lerp(groupTarget.current.pos.x, 0, 0.05);
        groupTarget.current.pos.y = THREE.MathUtils.lerp(groupTarget.current.pos.y, -1.0, 0.05);
        groupTarget.current.rot.y = THREE.MathUtils.lerp(groupTarget.current.rot.y, 0, 0.05);
        groupTarget.current.rot.x = THREE.MathUtils.lerp(groupTarget.current.rot.x, 0, 0.05);
    } else if (treeState === TreeState.CLOSED) {
        groupTarget.current.rot.y = Math.sin(t * 0.08) * 0.08;
        groupTarget.current.pos.x = THREE.MathUtils.lerp(groupTarget.current.pos.x, 0, 0.05);
        groupTarget.current.pos.y = THREE.MathUtils.lerp(groupTarget.current.pos.y, -1.0, 0.05);
    } else if (treeState === TreeState.ROMANTIC_ENDING) {
        // Steady in ending
        groupTarget.current.pos.x = THREE.MathUtils.lerp(groupTarget.current.pos.x, 0, 0.05);
        groupTarget.current.pos.y = THREE.MathUtils.lerp(groupTarget.current.pos.y, -1.0, 0.05);
        groupTarget.current.rot.y = THREE.MathUtils.lerp(groupTarget.current.rot.y, 0, 0.05);
        groupTarget.current.rot.x = THREE.MathUtils.lerp(groupTarget.current.rot.x, 0, 0.05);
    }

    // Apply Transforms to Group
    if (groupRef.current) {
       groupRef.current.position.copy(groupTarget.current.pos);
       groupRef.current.rotation.copy(groupTarget.current.rot);
    }

    // --- CAMERA LOGIC ---
    if (treeState === TreeState.FOCUS || treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING) {
        // Center camera in romantic modes
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, 0.05);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.0, 0.05);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 25, 0.05);
    } else {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, Math.sin(t * 0.1) * 2, 0.01);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.0, 0.05);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, 25, 0.05);
    }
    camera.lookAt(0, 0, 0);

    if (starRef.current) {
      const pulse = 1 + Math.sin(t * 2.5) * 0.08;
      const visibleScale = pulse * starVisibility.current;
      starRef.current.scale.setScalar(visibleScale);
      starRef.current.rotation.z = Math.sin(t * 0.8) * 0.08;
    }

    let bIdx = 0, osIdx = 0, obIdx = 0, odIdx = 0, lIdx = 0;
    const dummy = new THREE.Object3D();

    const dIntensity = driftIntensity.current;

    animState.current.forEach((item) => {
      const breathY = Math.sin(t * 1.2 + item.phase) * 0.03;
      const tOffset = t + item.phase;
      const driftX = Math.sin(tOffset * 0.15) * 0.6; 
      const driftY = Math.sin(tOffset * 0.12) * 0.6; 
      const driftZ = Math.sin(tOffset * 0.18) * 0.4;

      dummy.position.x = item.currentPos.x + driftX * dIntensity;
      dummy.position.y = item.currentPos.y + breathY * (1 - dIntensity) + driftY * dIntensity;
      dummy.position.z = item.currentPos.z + driftZ * dIntensity;

      if (item.type === 'branch') {
        dummy.lookAt(0, item.currentPos.y, 0);
        dummy.rotation.x += Math.PI / 3.5; 
        dummy.rotation.z += driftX * 0.1 * dIntensity;
      } else {
        dummy.rotation.set(
          t * item.rotationSpeed.x + item.phase, 
          t * item.rotationSpeed.y + item.phase, 
          t * item.rotationSpeed.z
        );
      }

      let scale = item.currentScale;
      if (item.type === 'light') {
        const twinkle = Math.sin(t * 4 + item.phase) * 0.4 + 1.1;
        scale *= twinkle;
      }

      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      if (item.type === 'branch') {
        branchesRef.current!.setMatrixAt(bIdx++, dummy.matrix);
      } else if (item.type === 'ornament') {
        if (item.ornamentType === 'sphere') ornamentSpheresRef.current!.setMatrixAt(osIdx++, dummy.matrix);
        else if (item.ornamentType === 'box') ornamentBoxesRef.current!.setMatrixAt(obIdx++, dummy.matrix);
        else ornamentDiamondsRef.current!.setMatrixAt(odIdx++, dummy.matrix);
      } else {
        lightsRef.current!.setMatrixAt(lIdx++, dummy.matrix);
      }
    });

    if (branchesRef.current) branchesRef.current.instanceMatrix.needsUpdate = true;
    if (ornamentSpheresRef.current) ornamentSpheresRef.current.instanceMatrix.needsUpdate = true;
    if (ornamentBoxesRef.current) ornamentBoxesRef.current.instanceMatrix.needsUpdate = true;
    if (ornamentDiamondsRef.current) ornamentDiamondsRef.current.instanceMatrix.needsUpdate = true;
    if (lightsRef.current) lightsRef.current.instanceMatrix.needsUpdate = true;

    if (particlesRef.current) {
        // Hide particles in ROMANTIC mode, but SHOW in ROMANTIC_ENDING (Dreamy particles)
        // Also show in normal states
        if (treeState === TreeState.ROMANTIC) {
             particlesRef.current.visible = false;
        } else {
             particlesRef.current.visible = true;
             
             // In ending scene, slow down particles and make them drift up slowly
             const isEnding = treeState === TreeState.ROMANTIC_ENDING;
             
             const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
             const totalPoints = positions.length / 3;
             for (let i = 0; i < totalPoints; i++) {
                const idx = i * 3;
                let speed = 0.035 + (i % 5) * 0.008;
                
                if (isEnding) speed *= 0.5; // Slower in ending
                
                positions[idx + 1] -= speed; 
                
                // If ending, maybe drift up instead? The prompt says "Floating light particles".
                // Let's keep existing flow but softer.
                
                if (positions[idx + 1] < -12) {
                     positions[idx + 1] = 15;
                     positions[idx] = (Math.random() - 0.5) * 35;
                     positions[idx + 2] = (Math.random() - 0.5) * 35;
                }
                positions[idx] += Math.sin(t * 0.5 + i) * 0.01; 
              }
              particlesRef.current.geometry.attributes.position.needsUpdate = true;
        }
    }
  });

  return (
    <>
      <color attach="background" args={['#051a10']} />
      <fog attach="fog" args={['#051a10', 15, 60]} />

      <ambientLight intensity={0.7} color="#fff0e0" />
      <pointLight position={[10, 10, 10]} intensity={2.5} color="#ffeebb" distance={50} decay={2} />
      <pointLight position={[-10, 5, -5]} intensity={1.5} color="#ffaa88" distance={50} decay={2} />
      <pointLight position={[0, 8, 2]} intensity={3} color={COLORS.GOLD} distance={20} decay={1.5} />
      
      {/* Extra soft light for Romantic Ending */}
      {treeState === TreeState.ROMANTIC_ENDING && (
        <pointLight position={[0, 0, 10]} intensity={1.5} color="#ffb6c1" distance={30} decay={2} />
      )}

      {/* Characters Group - Fixed World Position */}
      <group position={[9.5, -3.85, 6.0]} rotation={[0, -0.3, 0]}>
        <ChibiCharacter 
          name="小华"
          position={[-0.65, 0, 0]} 
          rotation={[0, -0.1, 0]} 
          scale={1.2}
          type="boy"
          primaryColor="#6B8CAE" 
          secondaryColor="#DDE6ED"
          gesture={handGesture}
          treeState={treeState}
        />
        <ChibiCharacter 
          name="盼盼"
          position={[0.65, 0, 0]} 
          rotation={[0, 0.1, 0]} 
          scale={1.2}
          type="girl"
          primaryColor="#E6A4B4" 
          secondaryColor="#F5EBE0" 
          gesture={handGesture}
          treeState={treeState}
        />
        {/* Floating Hearts for Romantic Mode AND Ending */}
        {(treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING) && <HeartParticles count={50} />}
      </group>

      {/* Tree Group */}
      <group ref={groupRef} position={[0, -1.0, 0]} scale={0.85}>
        
        {/* Instanced Meshes */}
        <instancedMesh ref={branchesRef} args={[undefined, undefined, BRANCH_COUNT]}>
          <tetrahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={COLORS.TREE_GREEN} roughness={0.7} metalness={0.2} flatShading />
        </instancedMesh>
        <instancedMesh ref={ornamentSpheresRef} args={[undefined, undefined, ORNAMENT_COUNT]}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial roughness={0.15} metalness={0.8} envMapIntensity={1.5} emissive="#400000" emissiveIntensity={0.2} />
        </instancedMesh>
        <instancedMesh ref={ornamentBoxesRef} args={[undefined, undefined, ORNAMENT_COUNT]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.2} metalness={0.6} envMapIntensity={1.2} emissive="#330000" emissiveIntensity={0.1} />
        </instancedMesh>
        <instancedMesh ref={ornamentDiamondsRef} args={[undefined, undefined, ORNAMENT_COUNT]}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial roughness={0.05} metalness={0.9} envMapIntensity={2.0} emissive={COLORS.GOLD} emissiveIntensity={0.2} />
        </instancedMesh>
        <instancedMesh ref={lightsRef} args={[undefined, undefined, LIGHT_COUNT]}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshStandardMaterial color={COLORS.LIGHT_WARM} emissive={COLORS.LIGHT_WARM} emissiveIntensity={4} toneMapped={false} />
        </instancedMesh>

        <group ref={starRef} position={[0, 7.0, 0]}>
          <mesh>
             <octahedronGeometry args={[1.0, 0]} />
             <meshStandardMaterial color={COLORS.GOLD} emissive={COLORS.GOLD} emissiveIntensity={5} toneMapped={false} />
          </mesh>
          <mesh rotation={[0,0,Math.PI/4]}>
             <octahedronGeometry args={[1.0, 0]} />
             <meshStandardMaterial color={COLORS.GOLD} emissive={COLORS.GOLD} emissiveIntensity={5} toneMapped={false} />
          </mesh>
          <mesh>
             <sphereGeometry args={[1.8, 32, 32]} />
             <meshBasicMaterial color={COLORS.GOLD} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
           <mesh>
             <sphereGeometry args={[3.2, 32, 32]} />
             <meshBasicMaterial color={COLORS.LIGHT_WARM} transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <pointLight intensity={3} color={COLORS.GOLD} distance={15} decay={2} position={[0, -0.5, 0]} />
        </group>

        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={600}
              array={useMemo(() => {
                const positions = new Float32Array(600 * 3);
                for(let i=0; i<600*3; i++) {
                  positions[i] = (Math.random() - 0.5) * 35;
                }
                return positions;
              }, [])}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial size={0.15} color="#fff" transparent opacity={0.6} sizeAttenuation={true} depthWrite={false} />
        </points>

        {/* Photos with Ref Callback */}
        {photos.map((photo, index) => (
          <PhotoCard 
            key={photo.id} 
            data={photo} 
            index={index} 
            total={photos.length}
            treeState={treeState}
            isFocused={focusedPhotoId === photo.id}
            isFlipped={isFlipped && focusedPhotoId === photo.id}
            onSelect={() => onSelectPhoto(photo.id)}
            setRef={(el) => { photoRefs.current[index] = el; }}
            handGesture={handGesture}
          />
        ))}
      </group>

      <PostProcessing />
    </>
  );
};

// --- Subcomponents ---

// HEART PARTICLES FOR ROMANTIC MODE
const HeartParticles: React.FC<{ count: number }> = ({ count }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    // Heart Shape
    const heartShape = useMemo(() => {
        const x = 0, y = 0;
        const shape = new THREE.Shape();
        shape.moveTo(x + 0.25, y + 0.25);
        shape.bezierCurveTo(x + 0.25, y + 0.25, x + 0.20, y, x, y);
        shape.bezierCurveTo(x - 0.30, y, x - 0.30, y + 0.35, x - 0.30, y + 0.35);
        shape.bezierCurveTo(x - 0.30, y + 0.55, x - 0.10, y + 0.77, x + 0.25, y + 0.95);
        shape.bezierCurveTo(x + 0.60, y + 0.77, x + 0.80, y + 0.55, x + 0.80, y + 0.35);
        shape.bezierCurveTo(x + 0.80, y + 0.35, x + 0.80, y, x + 0.50, y);
        shape.bezierCurveTo(x + 0.35, y, x + 0.25, y + 0.25, x + 0.25, y + 0.25);
        return shape;
    }, []);

    const particles = useMemo(() => {
        return new Array(count).fill(0).map(() => ({
            position: new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                Math.random() * 3,
                (Math.random() - 0.5) * 2
            ),
            velocity: Math.random() * 0.02 + 0.01,
            scale: Math.random() * 0.3 + 0.2,
            color: Math.random() > 0.5 ? COLORS.HEART_RED : COLORS.HEART_PINK,
            offset: Math.random() * 100
        }));
    }, [count]);

    useFrame((state) => {
        if (!meshRef.current) return;
        
        particles.forEach((p, i) => {
            const t = state.clock.getElapsedTime();
            
            // Rise up
            p.position.y += p.velocity;
            if (p.position.y > 5) p.position.y = -1;

            // Wiggle
            const wiggleX = Math.sin(t * 2 + p.offset) * 0.01;
            p.position.x += wiggleX;

            dummy.position.copy(p.position);
            // Rotate 180 on Z to make heart point up (Shape defaults to pointing down-ish relative to draw logic usually, check visual)
            // Actually the shape logic draws it pointing DOWN to 0,0 from top usually? 
            // Shape defined above points UP mostly. 
            // Let's add some rotation.
            dummy.rotation.z = Math.PI; 
            dummy.rotation.y = Math.sin(t + p.offset) * 0.5;
            
            // Pulse scale
            const pulse = 1 + Math.sin(t * 3 + p.offset) * 0.1;
            dummy.scale.setScalar(p.scale * pulse);
            
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
            meshRef.current!.setColorAt(i, new THREE.Color(p.color));
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.instanceColor!.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]} position={[0, -0.5, 0]}>
            <shapeGeometry args={[heartShape]} />
            <meshBasicMaterial side={THREE.DoubleSide} transparent opacity={0.8} />
        </instancedMesh>
    );
};

interface PhotoCardProps {
  data: PhotoData;
  index: number;
  total: number;
  treeState: TreeState;
  isFocused: boolean;
  isFlipped: boolean;
  onSelect: () => void;
  setRef?: (el: THREE.Group | null) => void;
  handGesture: HandGesture | null;
}

const PhotoCard: React.FC<PhotoCardProps> = ({ 
  data, index, total, treeState, isFocused, isFlipped, onSelect, setRef, handGesture
}) => {
  const group = useRef<THREE.Group>(null);
  const { viewport, camera } = useThree();
  
  // Expose ref to parent
  useImperativeHandle(setRef as any, () => group.current);

  // Use TextureLoader with fallback
  const texture = useLoader(THREE.TextureLoader, data.url, (loader) => {
    loader.setCrossOrigin('anonymous');
  });
  
  const textTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#fefae0'; 
    ctx.fillRect(0, 0, 512, 512);
    
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 15;
    ctx.strokeRect(15, 15, 482, 482);
    
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#c0a030';
    ctx.strokeRect(30, 30, 452, 452);
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#5d4037';
    ctx.font = '45px "ZCOOL KuaiLe", "Fredoka", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const maxWidth = 380;
    const lineHeight = 60;
    const lines: string[] = [];
    
    const chars = data.text.split('');
    let line = '';
    
    for (let n = 0; n < chars.length; n++) {
      const char = chars[n];
      const testLine = line + char;
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = char;
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    const startY = 256 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => {
        ctx.fillText(l, 256, startY + (i * lineHeight));
    });

    return new THREE.CanvasTexture(canvas);
  }, [data.text]);

  const scatteredPos = useMemo(() => {
      // 2.分散状态 (SCATTERED) logic
      const r = 15 + Math.random() * 25; // Radius 15 to 40
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);
      
      const rot = new THREE.Vector3(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
      );

      return { pos: new THREE.Vector3(x, y, z), rot };
  }, []); 

  const treePos = useMemo(() => {
      // 1.聚拢状态 (CLOSED) logic
      const startH = 0.15; 
      const endH = 0.85;
      const range = endH - startH;
      const normHeight = startH + (index / Math.max(total - 1, 1)) * range;

      const h = 12; 
      const yBase = (normHeight * h) - (h / 2) + 0.5;

      const spiralTurns = 9;
      const theta = normHeight * Math.PI * 2 * spiralTurns;

      const maxRadius = 6.2;
      const r = (1 - Math.pow(normHeight, 0.75)) * maxRadius + 0.25; 

      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);

      const y = yBase - 0.6; 

      return new THREE.Vector3(x, y, z);
  }, [index, total]);

  // 3.引入代理对象 (anim Ref)
  const anim = useRef({
      pos: treePos.clone(),
      rot: new THREE.Vector3(0, Math.atan2(treePos.x, treePos.z), 0),
      scale: new THREE.Vector3(0.6, 0.6, 0.6)
  });

  useFrame((state) => {
      if (!group.current) return;
      
      let { x, y, z } = anim.current.pos;
      let { x: rx, y: ry, z: rz } = anim.current.rot;
      const { x: sx, y: sy, z: sz } = anim.current.scale;
      
      if (treeState === TreeState.SCATTERED && !isFocused) {
          const t = state.clock.getElapsedTime();
          y += Math.sin(t * 0.5 + index) * 0.5;
          rz += Math.cos(t * 0.3 + index) * 0.05;
      }
      
      group.current.position.set(x, y, z);
      group.current.rotation.set(rx, ry, rz);
      group.current.scale.set(sx, sy, sz);
  });

  useEffect(() => {
    let targetPos = new THREE.Vector3();
    let targetRot = new THREE.Vector3(); 
    let targetScale = new THREE.Vector3();
    let duration = 1.0;
    let ease = "power2.inOut";
    let delay = 0;

    if (treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING) {
        targetPos.copy(anim.current.pos); 
        targetRot.copy(anim.current.rot);
        targetScale.set(0, 0, 0);
        duration = 1.0;
        ease = "power2.in";
    }
    else if (isFocused) {
      targetPos.set(0, 1.0, 20);
      targetRot.set(0, isFlipped ? Math.PI : 0, 0);
      targetScale.set(3.0, 3.0, 3.0);
      
      duration = 0.8;
      ease = "back.out(1.2)";
    } else if (treeState === TreeState.CLOSED) {
      targetPos.copy(treePos);
      const angle = Math.atan2(treePos.x, treePos.z);
      targetRot.set(0, angle, 0); 
      targetScale.set(0.6, 0.6, 0.6);

      duration = 1.6;
      ease = "back.out(0.6)";
      // 4. CLOSED delay logic
      delay = (1 - (index / Math.max(total, 1))) * 0.5;

    } else {
      // SCATTERED
      targetPos.copy(scatteredPos.pos);
      targetRot.copy(scatteredPos.rot);
      targetScale.set(0.5, 0.5, 0.5); 

      duration = 2.0;
      ease = "power2.inOut";
      // 4. SCATTERED random delay
      delay = Math.random() * 0.5; 
    }

    gsap.to(anim.current.pos, {
        x: targetPos.x, y: targetPos.y, z: targetPos.z,
        duration: duration,
        ease: ease,
        delay: delay
    });
    
    gsap.to(anim.current.rot, {
        x: targetRot.x, y: targetRot.y, z: targetRot.z,
        duration: duration,
        ease: ease,
        delay: delay
    });

    gsap.to(anim.current.scale, {
        x: targetScale.x, y: targetScale.y, z: targetScale.z,
        duration: duration,
        ease: ease,
        delay: delay
    });

  }, [treeState, isFocused, isFlipped, index, total, treePos, scatteredPos]); 

  return (
    <group ref={group} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      <mesh visible={false}>
        <planeGeometry args={[3.5, 3.5]} />
        <meshBasicMaterial color="red" wireframe />
      </mesh>
      
      <mesh>
        <boxGeometry args={[1.05, 1.05, 0.05]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      <mesh position={[0, 0, 0.03]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial 
            map={texture} 
            side={THREE.DoubleSide} 
            toneMapped={false} 
            polygonOffset
            polygonOffsetFactor={-1}
        />
      </mesh>
      <mesh position={[0, 0, -0.03]} rotation={[0, Math.PI, 0]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial 
            map={textTexture} 
            side={THREE.DoubleSide} 
            toneMapped={false} 
            polygonOffset
            polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  );
};

interface ChibiCharacterProps {
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  type: 'boy' | 'girl';
  primaryColor: string;
  secondaryColor: string;
  gesture: HandGesture | null;
  treeState: TreeState;
}

const ChibiCharacter: React.FC<ChibiCharacterProps> = ({ 
  name, position, rotation, scale, type, primaryColor, secondaryColor, gesture, treeState 
}) => {
  const group = useRef<THREE.Group>(null);
  const headGroup = useRef<THREE.Group>(null);
  const eyesGroup = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);

  // Generate Name Texture
  const nameTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    ctx.clearRect(0, 0, 256, 128);
    // Glow effect
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 12;
    
    ctx.font = 'bold 50px "Mountains of Christmas", "Segoe UI", "Microsoft YaHei", sans-serif'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFF5CC'; 
    
    ctx.fillText(name, 128, 64);
    return new THREE.CanvasTexture(canvas);
  }, [name]);

  const isBoy = type === 'boy';
  const bodyRadius = isBoy ? 0.75 : 0.42; 
  const bodyHeight = isBoy ? 1.05 : 0.65;
  const headRadius = isBoy ? 0.8 : 0.62; 
  const hairRadius = headRadius + 0.02;
  const legRadius = isBoy ? 0.22 : 0.16;
  const legLength = isBoy ? 0.75 : 0.60; 
  const legSpacing = isBoy ? 0.35 : 0.22;
  const bootRadius = legRadius * 1.5;
  const bootHeight = bootRadius * 0.8;
  const bootScale = [1, 0.7, 1.4] as [number, number, number]; 
  const bootY = bootHeight * 0.4;
  const legY = bootHeight * 0.8 + (legLength / 2);
  const bodyY = (bootHeight * 0.8) + legLength + (bodyHeight / 2) - 0.1; 
  const scarfY = bodyY + (bodyHeight / 2) - 0.05;
  const armY = bodyY + (bodyHeight * 0.25);
  const headY = bodyY + (bodyHeight / 2) + (headRadius * 0.75);
  const baseHeadY = headY;
  const nameTagY = headRadius + (isBoy ? 0.6 : 0.9);

  // Animation State Machine
  useEffect(() => {
    if (!leftArm.current || !rightArm.current || !headGroup.current || !bodyGroup.current || !group.current) return;

    if (treeState === TreeState.ROMANTIC || treeState === TreeState.ROMANTIC_ENDING) {
        // ROMANTIC MODE & ENDING: Look at each other
        gsap.killTweensOf([rightArm.current.rotation, leftArm.current.rotation, headGroup.current.rotation, bodyGroup.current.position, group.current.rotation]);
        
        // Turn bodies towards center (0,0,0) approx
        if (isBoy) {
             gsap.to(group.current.rotation, { y: -1.2, duration: 1.2, ease: "power2.inOut" });
        } else {
             gsap.to(group.current.rotation, { y: 1.2, duration: 1.2, ease: "power2.inOut" });
        }

        // Arms: Holding hands out towards each other? Or shy?
        // Let's do shy/cute. Hands near chest.
        gsap.to(rightArm.current.rotation, { z: 1.0, x: 0.5, duration: 1.0 });
        gsap.to(leftArm.current.rotation, { z: -1.0, x: 0.5, duration: 1.0 });

        // Head: Look up slightly
        gsap.to(headGroup.current.rotation, { x: -0.2, duration: 1.0 });

    } else if (treeState === TreeState.SCATTERED) {
      gsap.killTweensOf([rightArm.current.rotation, leftArm.current.rotation, headGroup.current.rotation, bodyGroup.current.position, group.current.rotation]);
      
      // Reset body rotation to default
      gsap.to(group.current.rotation, { y: rotation[1], duration: 0.8 });

      gsap.to(rightArm.current.rotation, { z: 2.5, x: 0.2, duration: 0.6, ease: "back.out(1.5)" });
      gsap.to(leftArm.current.rotation, { z: -2.5, x: 0.2, duration: 0.6, ease: "back.out(1.5)" });
      gsap.to(headGroup.current.rotation, { x: 0, y: 0, z: 0, duration: 0.6 }); 
      gsap.to(bodyGroup.current.position, { y: 0.3, duration: 0.5, ease: "power2.out" });

    } else if (treeState === TreeState.FOCUS || gesture?.type === 'GRAB') {
      gsap.killTweensOf([rightArm.current.rotation, leftArm.current.rotation, headGroup.current.rotation, group.current.rotation]);
      
      // Reset body rotation
      gsap.to(group.current.rotation, { y: rotation[1], x: 0.15, duration: 0.5 }); 

      gsap.to(rightArm.current.rotation, { z: 0.1, x: 0.8, duration: 0.5 });
      gsap.to(leftArm.current.rotation, { z: -0.1, x: 0.8, duration: 0.5 });
      gsap.to(headGroup.current.rotation, { x: -0.15, z: 0, duration: 0.5 });

    } else {
      // IDLE
      gsap.killTweensOf([rightArm.current.rotation, leftArm.current.rotation, headGroup.current.rotation, group.current.rotation, bodyGroup.current.position]);
      
      gsap.to(bodyGroup.current.position, { y: 0, duration: 0.8 }); 
      gsap.to(group.current.rotation, { z: 0, x: 0, y: rotation[1], duration: 1.2 });
      gsap.to(headGroup.current.rotation, { z: 0, y: 0, x: 0, duration: 1.2 });
      
      if (isBoy) {
          gsap.to(rightArm.current.rotation, { z: 0.4, x: 0, duration: 1.2 });
          gsap.to(leftArm.current.rotation, { z: 0.3, x: 0, duration: 1.2 });
      } else {
          gsap.to(leftArm.current.rotation, { z: -0.4, x: 0, duration: 1.2 });
          gsap.to(rightArm.current.rotation, { z: -0.3, x: 0, duration: 1.2 });
      }
    }

  }, [gesture?.type, treeState, isBoy, rotation]);

  useFrame((state) => {
    if (headGroup.current) {
      const t = state.clock.getElapsedTime();
      headGroup.current.position.y = baseHeadY + Math.sin(t * 2) * 0.015;
    }
  });

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      
      <pointLight position={[0, 2, 2]} intensity={0.5} color="#ffdca8" distance={5} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
         <circleGeometry args={[bodyRadius * 1.3, 32]} />
         <meshBasicMaterial color="#000" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      <group ref={bodyGroup}>
        <group position={[0, bootY, 0]}>
             <mesh position={[-legSpacing, 0, 0.1]} scale={bootScale}>
                <sphereGeometry args={[bootRadius, 16, 16]} />
                <meshStandardMaterial color={secondaryColor} roughness={0.8} />
             </mesh>
             <mesh position={[legSpacing, 0, 0.1]} scale={bootScale}>
                <sphereGeometry args={[bootRadius, 16, 16]} />
                <meshStandardMaterial color={secondaryColor} roughness={0.8} />
             </mesh>
        </group>

        <group position={[0, legY, 0]}>
            <mesh position={[-legSpacing, 0, 0]}>
                <capsuleGeometry args={[legRadius, legLength, 4, 8]} />
                <meshStandardMaterial color={primaryColor} roughness={0.6} />
            </mesh>
            <mesh position={[legSpacing, 0, 0]}>
                <capsuleGeometry args={[legRadius, legLength, 4, 8]} />
                <meshStandardMaterial color={primaryColor} roughness={0.6} />
            </mesh>
        </group>

        <mesh position={[0, bodyY, 0]}>
          <capsuleGeometry args={[bodyRadius, bodyHeight, 4, 16]} />
          <meshStandardMaterial color={primaryColor} roughness={0.6} />
        </mesh>

        <group ref={headGroup} position={[0, headY, 0]}>
          
          <sprite position={[0, nameTagY, 0]} scale={[1.8, 0.9, 1]}>
             <spriteMaterial map={nameTexture} transparent opacity={0.95} depthWrite={false} />
          </sprite>

          <mesh>
            <sphereGeometry args={[headRadius, 32, 32]} />
            <meshStandardMaterial color="#FFE0BD" roughness={0.3} /> 
          </mesh>

          <mesh position={[0, 0.1, -0.05]} rotation={[0,0,0]}>
             <sphereGeometry args={[hairRadius, 32, 32, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
             <meshStandardMaterial color={type === 'boy' ? primaryColor : "#5D4037"} />
          </mesh>

          {type === 'boy' ? (
             <mesh position={[0, 0.8, 0]}>
               <sphereGeometry args={[0.2, 16, 16]} />
               <meshStandardMaterial color={secondaryColor} />
             </mesh>
          ) : (
             <group>
               <mesh rotation={[0, 0, 0]}>
                 <torusGeometry args={[0.65, 0.04, 6, 24, Math.PI * 2]} />
                 <meshStandardMaterial color={primaryColor} />
               </mesh>
               <mesh position={[0.66, 0.05, 0]} scale={[0.7, 1, 1]}>
                 <sphereGeometry args={[0.25, 16, 16]} />
                 <meshStandardMaterial color={secondaryColor} roughness={0.8} />
               </mesh>
               <mesh position={[-0.66, 0.05, 0]} scale={[0.7, 1, 1]}>
                 <sphereGeometry args={[0.25, 16, 16]} />
                 <meshStandardMaterial color={secondaryColor} roughness={0.8} />
               </mesh>
             </group>
          )}

          <group position={[0, 0, headRadius - 0.05]}>
             <group ref={eyesGroup}>
                <mesh position={[0.2, 0.1, 0]}>
                  <capsuleGeometry args={[0.06, 0.1, 4, 8]} />
                  <meshBasicMaterial color="#333" />
                </mesh>
                <mesh position={[-0.2, 0.1, 0]}>
                  <capsuleGeometry args={[0.06, 0.1, 4, 8]} />
                  <meshBasicMaterial color="#333" />
                </mesh>
             </group>
          </group>

        </group>

        {/* Arms moved OUTWARD relative to body to avoid clipping */}
        <group position={[0, armY, 0]}>
          <group ref={leftArm} position={[-bodyRadius - 0.15, 0, 0]}>
             <mesh position={[0, -0.325, 0]}>
                <capsuleGeometry args={[0.18, 0.65, 4, 8]} />
                <meshStandardMaterial color={primaryColor} roughness={0.6} />
             </mesh>
             <mesh position={[0, -0.7, 0]} scale={[0.9, 0.9, 0.9]}>
                <sphereGeometry args={[0.18, 16, 16]} />
                <meshStandardMaterial color="#FFE0BD" />
             </mesh>
          </group>
          
          <group ref={rightArm} position={[bodyRadius + 0.15, 0, 0]}>
             <mesh position={[0, -0.325, 0]}>
                <capsuleGeometry args={[0.18, 0.65, 4, 8]} />
                <meshStandardMaterial color={primaryColor} roughness={0.6} />
             </mesh>
             <mesh position={[0, -0.7, 0]} scale={[0.9, 0.9, 0.9]}>
                <sphereGeometry args={[0.18, 16, 16]} />
                <meshStandardMaterial color="#FFE0BD" />
             </mesh>
          </group>

        </group>

        <mesh position={[0, scarfY, 0]} rotation={[0.2, 0, 0]}>
           <torusGeometry args={[bodyRadius * 0.75, 0.15, 8, 24]} />
           <meshStandardMaterial color={secondaryColor} />
        </mesh>

      </group>
    </group>
  );
};
