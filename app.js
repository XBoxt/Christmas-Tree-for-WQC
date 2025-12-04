import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Float, Sparkles, Stars, CameraShake } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { AudioEngine } from './AudioEngine.js';

// 全局音频引擎实例
const audioSystem = new AudioEngine();

// --- 1. 智能猫咪粒子 ---
const CatVoxels = ({ count = 2500, colors, mode, isPlaying }) => {
    const bodyRef = useRef();
    const headRef = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    // 粒子初始数据
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            const t = i / count;
            // 完美螺旋树形
            const angle = t * Math.PI * 30;
            const radius = (1 - t) * 16;
            const y = t * 45 - 22;
            const treePos = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
            
            // 散落形态
            const scatterPos = new THREE.Vector3(
                (Math.random()-0.5)*100, (Math.random()-0.5)*80, (Math.random()-0.5)*100
            );

            temp.push({
                treePos, scatterPos,
                pos: scatterPos.clone(),
                speed: Math.random() * 0.5 + 0.5,
                phase: Math.random() * Math.PI * 2,
                colorType: Math.random()
            });
        }
        return temp;
    }, [count]);

    // 颜色动态更新
    useEffect(() => {
        if(!bodyRef.current) return;
        particles.forEach((p, i) => {
            const c = p.colorType < 0.33 ? colors[0] : (p.colorType < 0.66 ? colors[1] : colors[2]);
            bodyRef.current.setColorAt(i, c);
            headRef.current.setColorAt(i, c);
        });
        bodyRef.current.instanceColor.needsUpdate = true;
        headRef.current.instanceColor.needsUpdate = true;
    }, [colors]);

    useFrame((state, delta) => {
        if(!bodyRef.current) return;
        
        // --- 核心算力：获取音频能量 ---
        const energy = audioSystem.getEnergy(); 
        // 能量越大，树越膨胀
        const pulse = 1 + energy * 0.5; 

        const time = state.clock.elapsedTime;
        const isTree = mode === 'TREE';

        particles.forEach((p, i) => {
            // 1. 位置插值
            const targetBase = isTree ? p.treePos : p.scatterPos;
            let target = targetBase.clone();

            if (isTree) {
                // 旋转
                const rot = time * 0.15;
                target.applyAxisAngle(new THREE.Vector3(0,1,0), rot);
                // 音乐律动：随着低音膨胀
                target.multiplyScalar(pulse);
            }
            
            p.pos.lerp(target, delta * 2.5 * p.speed);

            // 2. 猫咪动作 (Bounce)
            let bounce = 0;
            if (isTree && isPlaying) {
                bounce = Math.sin(time * 12 + p.phase) * (0.2 + energy); // 音乐越响，跳得越高
            }

            // 3. 矩阵更新
            dummy.position.copy(p.pos);
            dummy.position.y += bounce;
            dummy.lookAt(0, p.pos.y, 0);
            
            // 音乐越强，猫咪也会稍微变大
            const scale = 0.4 * (1 + energy * 0.2); 
            dummy.scale.setScalar(scale);

            dummy.updateMatrix();
            bodyRef.current.setMatrixAt(i, dummy.matrix);
            headRef.current.setMatrixAt(i, dummy.matrix);
        });

        bodyRef.current.instanceMatrix.needsUpdate = true;
        headRef.current.instanceMatrix.needsUpdate = true;
    });

    const mat = <meshStandardMaterial roughness={0.2} metalness={0.8} />;
    return (
        <group>
            <instancedMesh ref={bodyRef} args={[null, null, count]}>{mat}<boxGeometry args={[1, 0.8, 1.2]} /></instancedMesh>
            <instancedMesh ref={headRef} args={[null, null, count]}>{mat}<primitive object={new THREE.BoxGeometry(0.8, 0.8, 0.8).translate(0, 0.8, 0.5)} attach="geometry" /></instancedMesh>
        </group>
    );
};

// --- 2. 场景组装 ---
const Scene = ({ onColorChange, colors }) => {
    const [mode, setMode] = useState('TREE');
    const [playing, setPlaying] = useState(false);
    
    // 摄像机运镜动画
    useFrame((state) => {
        if (!playing) return;
        // 简单的自动漫游: 缓慢拉远
        const t = state.clock.elapsedTime;
        state.camera.position.lerp(new THREE.Vector3(0, 0, 55 + Math.sin(t*0.2)*5), 0.02);
        state.camera.lookAt(0, 0, 0);
    });

    // 暴露给外部按钮的方法
    useEffect(() => {
        window.startShow = () => {
            setPlaying(true);
            audioSystem.playMelody();
        };
        window.toggleShape = () => setMode(prev => prev === 'TREE' ? 'SCATTER' : 'TREE');
    }, []);

    return (
        <>
            {/* 灯光 */}
            <ambientLight intensity={0.2} />
            <pointLight position={[10, 20, 10]} intensity={100} color={colors[1]} />
            <pointLight position={[-10, -10, -10]} intensity={50} color={colors[2]} />
            <spotLight position={[0, 50, 0]} intensity={200} angle={0.5} penumbra={1} color={colors[0]} castShadow />

            {/* 核心猫群 */}
            <CatVoxels count={3000} colors={colors} mode={mode} isPlaying={playing} />

            {/* 装饰元素 */}
            <Sparkles count={800} scale={50} size={4} speed={0.4} opacity={0.5} color={colors[1]} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            
            {/* 底部文字 */}
            <group position={[0, -25, 0]}>
                <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
                    <Text
                        fontSize={8}
                        color={colors[0]}
                        font="https://fonts.gstatic.com/s/raleway/v14/1Ptrg8zYS_SKggPNwK4vaqI.woff"
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.2}
                        outlineColor={colors[2]}
                    >
                        TO WQC
                    </Text>
                </Float>
            </group>

            {/* 后处理特效 */}
            <EffectComposer disableNormalPass>
                <Bloom luminanceThreshold={0.8} mipmapBlur intensity={1.5} radius={0.4} />
                <ChromaticAberration offset={[0.002, 0.002]} /> 
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
            
            {/* 摄像机震动 (Bass hits时增加临场感) */}
            <CameraShake yawFrequency={0.1} pitchFrequency={0.1} rollFrequency={0.1} intensity={0.2} />
        </>
    );
};

// --- 3. App 入口 ---
const App = () => {
    // 随机色生成器
    const getColors = () => {
        const h = Math.random();
        return [
            new THREE.Color().setHSL(h, 1, 0.6),      // 主色 (金/亮)
            new THREE.Color().setHSL((h+0.6)%1, 0.8, 0.5), // 辅色 (对比)
            new THREE.Color().setHSL((h+0.3)%1, 1, 0.8)    // 高光
        ];
    };
    const [colors, setColors] = useState(getColors());

    useEffect(() => {
        window.randomizeColors = () => setColors(getColors());
        // 移除 loader
        setTimeout(() => document.getElementById('loader').style.opacity = 0, 1000);
        setTimeout(() => document.getElementById('loader').style.display = 'none', 2000);
    }, []);

    return (
        <Canvas dpr={[1, 1.5]} gl={{ antialias: false }} camera={{ position: [0, 0, 10], fov: 45 }}>
            <Scene colors={colors} />
            <OrbitControls enablePan={false} maxDistance={90} minDistance={10} />
        </Canvas>
    );
};

const root = createRoot(document.getElementById('canvas-root'));
root.render(<App />);