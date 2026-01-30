import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

// ============================================================================
// SOUND SYNTHESIS (Simplified jsfxr-style)
// ============================================================================

class SimpleSound {
  constructor(audioContext) {
    this.ctx = audioContext;
  }

  play(params) {
    const {
      frequency = 440,
      duration = 0.2,
      type = 'square',
      volume = 0.3,
      attack = 0.01,
      decay = 0.1,
      slide = 0,
      vibratoFreq = 0,
      vibratoDepth = 0
    } = params;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    
    // Frequency slide
    if (slide !== 0) {
      osc.frequency.exponentialRampToValueAtTime(
        frequency + slide,
        this.ctx.currentTime + duration
      );
    }
    
    // Vibrato
    if (vibratoFreq > 0) {
      const vibrato = this.ctx.createOscillator();
      const vibratoGain = this.ctx.createGain();
      vibrato.frequency.value = vibratoFreq;
      vibratoGain.gain.value = vibratoDepth;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start();
      vibrato.stop(this.ctx.currentTime + duration);
    }
    
    // Envelope
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
}

// ============================================================================
// ROBOT SOUND PRESETS
// ============================================================================

const ROBOT_SOUNDS = {
  idle: (personality, size) => ({
    frequency: 100 + (1 - size) * 100,
    duration: 0.15,
    type: 'sine',
    volume: 0.1,
    vibratoFreq: personality === 'energetic' ? 8 : 3,
    vibratoDepth: 5
  }),
  
  move: (personality, size) => ({
    frequency: 200 + Math.random() * 100,
    duration: 0.08,
    type: 'square',
    volume: 0.15,
    slide: personality === 'curious' ? 50 : -20
  }),
  
  interact: (personality, size) => ({
    frequency: 400 + (personality === 'grumpy' ? -100 : 100),
    duration: 0.2,
    type: personality === 'shy' ? 'sine' : 'sawtooth',
    volume: 0.2,
    vibratoFreq: 10,
    vibratoDepth: 20
  }),
  
  happy: () => ({
    frequency: 600,
    duration: 0.15,
    type: 'sine',
    volume: 0.25,
    slide: 200,
    vibratoFreq: 12,
    vibratoDepth: 30
  }),
  
  error: () => ({
    frequency: 150,
    duration: 0.3,
    type: 'sawtooth',
    volume: 0.2,
    slide: -100
  })
};

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

const PERSONALITIES = [
  { id: 'curious', name: 'Curious', emoji: '🔍', color: '#fbbf24' },
  { id: 'grumpy', name: 'Grumpy', emoji: '😠', color: '#ef4444' },
  { id: 'energetic', name: 'Energetic', emoji: '⚡', color: '#22d3ee' },
  { id: 'shy', name: 'Shy', emoji: '🙈', color: '#a78bfa' },
  { id: 'brave', name: 'Brave', emoji: '🦾', color: '#f97316' }
];

const HEAD_TYPES = ['box', 'round', 'tv', 'visor'];
const BODY_TYPES = ['bulky', 'slim', 'tank', 'core'];
const ARM_TYPES = ['jointed', 'claws', 'shield', 'piston'];
const LEG_TYPES = ['biped', 'treads', 'hover', 'wheels'];

const COLOR_PALETTES = [
  { name: 'Cyan Steel', primary: '#4a5568', secondary: '#2d3748', glow: '#00ffff', detail: '#f56565' },
  { name: 'Neon Pink', primary: '#1a1a2e', secondary: '#16213e', glow: '#ff00ff', detail: '#00ff00' },
  { name: 'Solar Gold', primary: '#2d2d44', secondary: '#1a1a2e', glow: '#ffd700', detail: '#ff6b35' },
  { name: 'Arctic Blue', primary: '#e0f7ff', secondary: '#b3e5fc', glow: '#4dd0e1', detail: '#0288d1' },
  { name: 'Danger Red', primary: '#2c1810', secondary: '#1a0f0a', glow: '#ff3333', detail: '#ffaa00' },
  { name: 'Toxic Green', primary: '#0d1b0d', secondary: '#071207', glow: '#39ff14', detail: '#ff00ff' }
];

const SCENES = [
  { id: 'factory', name: 'Factory Floor', color: '#4a5568', gridColor: '#fbbf24' },
  { id: 'neon', name: 'Neon Alley', color: '#1a0033', gridColor: '#ff00ff' },
  { id: 'space', name: 'Space Station', color: '#000011', gridColor: '#00ffff' },
  { id: 'junkyard', name: 'Junkyard', color: '#2d2416', gridColor: '#ff6b35' },
  { id: 'lab', name: 'Lab', color: '#0d1f2d', gridColor: '#00ff88' }
];

// ============================================================================
// 3D ROBOT COMPONENT (Canvas-based simplified 3D)
// ============================================================================

const Robot3D = ({ config, personality, isAnimating, onSound }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const rotationRef = useRef(0);
  const bobRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width = 400;
    const height = canvas.height = 500;
    
    const centerX = width / 2;
    const centerY = height / 2;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Apply animation
      if (isAnimating) {
        rotationRef.current += 0.02;
        bobRef.current += 0.1;
      }
      
      const bob = Math.sin(bobRef.current) * 5;
      const tilt = Math.sin(rotationRef.current) * 0.1;
      
      ctx.save();
      ctx.translate(centerX, centerY + bob);
      ctx.rotate(tilt);
      
      const scale = config.size || 1;
      ctx.scale(scale, scale);
      
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(-60, 140, 120, 10);
      
      // Legs
      drawLegs(ctx, config.legType, config.colors);
      
      // Body
      drawBody(ctx, config.bodyType, config.colors);
      
      // Arms
      drawArms(ctx, config.armType, config.colors, rotationRef.current);
      
      // Head
      drawHead(ctx, config.headType, config.colors, personality);
      
      // Personality indicator
      const pers = PERSONALITIES.find(p => p.id === personality);
      if (pers) {
        ctx.font = '32px Arial';
        ctx.fillText(pers.emoji, -15, -80);
      }
      
      ctx.restore();
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [config, personality, isAnimating]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// Drawing functions for robot parts
const drawHead = (ctx, type, colors, personality) => {
  ctx.fillStyle = colors.primary;
  ctx.strokeStyle = colors.glow;
  ctx.lineWidth = 2;
  
  switch (type) {
    case 'box':
      ctx.fillRect(-30, -60, 60, 50);
      ctx.strokeRect(-30, -60, 60, 50);
      // Eyes
      ctx.fillStyle = colors.glow;
      ctx.fillRect(-20, -45, 15, 15);
      ctx.fillRect(5, -45, 15, 15);
      break;
    case 'round':
      ctx.beginPath();
      ctx.arc(0, -35, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Eyes
      ctx.fillStyle = colors.glow;
      ctx.beginPath();
      ctx.arc(-12, -35, 8, 0, Math.PI * 2);
      ctx.arc(12, -35, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'tv':
      ctx.fillRect(-35, -65, 70, 55);
      ctx.strokeRect(-35, -65, 70, 55);
      // Screen
      ctx.fillStyle = colors.glow;
      ctx.fillRect(-25, -55, 50, 35);
      // Antenna
      ctx.strokeStyle = colors.detail;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -65);
      ctx.lineTo(0, -85);
      ctx.stroke();
      ctx.fillStyle = colors.detail;
      ctx.beginPath();
      ctx.arc(0, -85, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'visor':
      ctx.fillRect(-28, -55, 56, 45);
      ctx.strokeRect(-28, -55, 56, 45);
      // Visor
      ctx.fillStyle = colors.glow;
      ctx.fillRect(-24, -40, 48, 12);
      break;
  }
};

const drawBody = (ctx, type, colors) => {
  ctx.fillStyle = colors.primary;
  ctx.strokeStyle = colors.secondary;
  ctx.lineWidth = 2;
  
  switch (type) {
    case 'bulky':
      ctx.fillRect(-40, -10, 80, 70);
      ctx.strokeRect(-40, -10, 80, 70);
      // Panel
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(-25, 0, 50, 40);
      break;
    case 'slim':
      ctx.fillRect(-25, -10, 50, 80);
      ctx.strokeRect(-25, -10, 50, 80);
      break;
    case 'tank':
      ctx.fillRect(-50, -5, 100, 65);
      ctx.strokeRect(-50, -5, 100, 65);
      // Hatch
      ctx.fillStyle = colors.detail;
      ctx.fillRect(-15, 10, 30, 25);
      break;
    case 'core':
      ctx.beginPath();
      ctx.arc(0, 25, 35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Core glow
      ctx.fillStyle = colors.glow;
      ctx.beginPath();
      ctx.arc(0, 25, 15, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
};

const drawArms = (ctx, type, colors, rotation) => {
  const swing = Math.sin(rotation * 2) * 10;
  
  ctx.fillStyle = colors.secondary;
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;
  
  // Left arm
  ctx.save();
  ctx.translate(-45, 10);
  ctx.rotate(swing * Math.PI / 180);
  
  switch (type) {
    case 'jointed':
      ctx.fillRect(-8, 0, 16, 50);
      ctx.strokeRect(-8, 0, 16, 50);
      // Hand
      ctx.fillStyle = colors.detail;
      ctx.fillRect(-10, 50, 20, 15);
      break;
    case 'claws':
      ctx.fillRect(-6, 0, 12, 45);
      ctx.strokeRect(-6, 0, 12, 45);
      // Claws
      ctx.strokeStyle = colors.glow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, 45);
      ctx.lineTo(-12, 60);
      ctx.moveTo(8, 45);
      ctx.lineTo(12, 60);
      ctx.stroke();
      break;
    case 'shield':
      ctx.fillRect(-6, 0, 12, 40);
      // Shield
      ctx.fillStyle = colors.primary;
      ctx.fillRect(-20, 10, 30, 40);
      ctx.strokeRect(-20, 10, 30, 40);
      break;
    case 'piston':
      ctx.fillRect(-8, 0, 16, 35);
      // Piston
      ctx.fillStyle = colors.detail;
      ctx.fillRect(-5, 35, 10, 20);
      break;
  }
  
  ctx.restore();
  
  // Right arm (mirrored)
  ctx.save();
  ctx.translate(45, 10);
  ctx.rotate(-swing * Math.PI / 180);
  ctx.scale(-1, 1);
  
  switch (type) {
    case 'jointed':
      ctx.fillRect(-8, 0, 16, 50);
      ctx.strokeRect(-8, 0, 16, 50);
      ctx.fillStyle = colors.detail;
      ctx.fillRect(-10, 50, 20, 15);
      break;
    case 'claws':
      ctx.fillRect(-6, 0, 12, 45);
      ctx.strokeRect(-6, 0, 12, 45);
      ctx.strokeStyle = colors.glow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, 45);
      ctx.lineTo(-12, 60);
      ctx.moveTo(8, 45);
      ctx.lineTo(12, 60);
      ctx.stroke();
      break;
    case 'shield':
      ctx.fillRect(-6, 0, 12, 40);
      break;
    case 'piston':
      ctx.fillRect(-8, 0, 16, 35);
      ctx.fillStyle = colors.detail;
      ctx.fillRect(-5, 35, 10, 20);
      break;
  }
  
  ctx.restore();
};

const drawLegs = (ctx, type, colors) => {
  ctx.fillStyle = colors.secondary;
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 2;
  
  switch (type) {
    case 'biped':
      // Left leg
      ctx.fillRect(-30, 60, 18, 60);
      ctx.strokeRect(-30, 60, 18, 60);
      // Foot
      ctx.fillStyle = colors.detail;
      ctx.fillRect(-35, 120, 28, 10);
      
      // Right leg
      ctx.fillStyle = colors.secondary;
      ctx.fillRect(12, 60, 18, 60);
      ctx.strokeRect(12, 60, 18, 60);
      ctx.fillStyle = colors.detail;
      ctx.fillRect(7, 120, 28, 10);
      break;
    case 'treads':
      ctx.fillRect(-40, 70, 80, 30);
      ctx.strokeRect(-40, 70, 80, 30);
      // Tread marks
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = colors.detail;
        ctx.fillRect(-35 + i * 16, 75, 10, 20);
      }
      break;
    case 'hover':
      // Hover disc
      ctx.fillStyle = colors.glow;
      ctx.shadowBlur = 20;
      ctx.shadowColor = colors.glow;
      ctx.beginPath();
      ctx.ellipse(0, 90, 45, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    case 'wheels':
      // Left wheel
      ctx.beginPath();
      ctx.arc(-25, 90, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Right wheel
      ctx.beginPath();
      ctx.arc(25, 90, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
  }
};

// ============================================================================
// MAIN APP
// ============================================================================

const App = () => {
  const [config, setConfig] = useState({
    headType: 'tv',
    bodyType: 'bulky',
    armType: 'jointed',
    legType: 'biped',
    colors: COLOR_PALETTES[0],
    size: 1
  });
  
  const [personality, setPersonality] = useState('curious');
  const [scene, setScene] = useState(SCENES[0]);
  const [isAnimating, setIsAnimating] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  
  const audioContextRef = useRef(null);
  const soundEngineRef = useRef(null);

  // Initialize audio on first interaction
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      soundEngineRef.current = new SimpleSound(audioContextRef.current);
      setSoundEnabled(true);
    }
  };

  const playSound = (soundType) => {
    if (!soundEnabled || !soundEngineRef.current) return;
    
    const soundParams = ROBOT_SOUNDS[soundType](personality, config.size);
    soundEngineRef.current.play(soundParams);
  };

  // Idle sound loop
  useEffect(() => {
    if (!isAnimating || !soundEnabled) return;
    
    const interval = setInterval(() => {
      playSound('idle');
    }, 3000 + Math.random() * 2000);
    
    return () => clearInterval(interval);
  }, [isAnimating, soundEnabled, personality, config.size]);

  const randomizeRobot = () => {
    initAudio();
    setConfig({
      headType: HEAD_TYPES[Math.floor(Math.random() * HEAD_TYPES.length)],
      bodyType: BODY_TYPES[Math.floor(Math.random() * BODY_TYPES.length)],
      armType: ARM_TYPES[Math.floor(Math.random() * ARM_TYPES.length)],
      legType: LEG_TYPES[Math.floor(Math.random() * LEG_TYPES.length)],
      colors: COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)],
      size: 0.8 + Math.random() * 0.4
    });
    setPersonality(PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)].id);
    playSound('happy');
  };

  const currentScene = SCENES.find(s => s.id === scene.id) || SCENES[0];
  const currentPersonality = PERSONALITIES.find(p => p.id === personality);

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-900 text-white overflow-hidden" style={{ backgroundColor: currentScene.color }}>
      {/* Header */}
      <div className="bg-black/30 p-4 border-b border-white/10">
        <h1 className="text-3xl font-bold tracking-wider" style={{ color: config.colors.glow, textShadow: `0 0 10px ${config.colors.glow}` }}>
          RETROBOT FACTORY 🤖
        </h1>
        <p className="text-xs text-gray-400 mt-1">Build • Personalize • Make Noise</p>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* 3D Viewport */}
        <div className="flex-1 flex items-center justify-center p-8 relative">
          <Robot3D 
            config={config} 
            personality={personality} 
            isAnimating={isAnimating}
            onSound={playSound}
          />
          
          {/* Scene indicator */}
          <div className="absolute top-4 left-4 bg-black/50 px-3 py-2 rounded text-sm">
            <span className="text-gray-400">Scene:</span> <span style={{ color: currentScene.gridColor }}>{currentScene.name}</span>
          </div>

          {/* Animation toggle */}
          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className="absolute bottom-4 right-4 bg-black/50 px-4 py-2 rounded hover:bg-black/70 transition"
          >
            {isAnimating ? '⏸️ Pause' : '▶️ Play'}
          </button>
        </div>

        {/* Control Panel */}
        <div className="w-full md:w-80 bg-black/40 p-6 overflow-y-auto border-l border-white/10">
          <div className="space-y-6">
            {/* Personality */}
            <section>
              <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                <span>Personality</span>
                {currentPersonality && <span className="text-2xl">{currentPersonality.emoji}</span>}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {PERSONALITIES.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      initAudio();
                      setPersonality(p.id);
                      playSound('interact');
                    }}
                    className={`p-3 rounded border-2 transition ${
                      personality === p.id
                        ? 'border-white bg-white/20'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    <div className="text-2xl mb-1">{p.emoji}</div>
                    <div className="text-xs">{p.name}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Parts */}
            <section>
              <h3 className="text-sm font-bold text-gray-300 mb-3">Robot Parts</h3>
              
              <div className="space-y-3">
                <PartSelector
                  label="Head"
                  options={HEAD_TYPES}
                  value={config.headType}
                  onChange={(val) => {
                    initAudio();
                    setConfig({...config, headType: val});
                    playSound('move');
                  }}
                />
                
                <PartSelector
                  label="Body"
                  options={BODY_TYPES}
                  value={config.bodyType}
                  onChange={(val) => {
                    initAudio();
                    setConfig({...config, bodyType: val});
                    playSound('move');
                  }}
                />
                
                <PartSelector
                  label="Arms"
                  options={ARM_TYPES}
                  value={config.armType}
                  onChange={(val) => {
                    initAudio();
                    setConfig({...config, armType: val});
                    playSound('move');
                  }}
                />
                
                <PartSelector
                  label="Legs"
                  options={LEG_TYPES}
                  value={config.legType}
                  onChange={(val) => {
                    initAudio();
                    setConfig({...config, legType: val});
                    playSound('move');
                  }}
                />
              </div>
            </section>

            {/* Colors */}
            <section>
              <h3 className="text-sm font-bold text-gray-300 mb-3">Color Scheme</h3>
              <div className="grid grid-cols-2 gap-2">
                {COLOR_PALETTES.map((palette, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      initAudio();
                      setConfig({...config, colors: palette});
                      playSound('move');
                    }}
                    className={`p-2 rounded border-2 transition ${
                      config.colors.name === palette.name
                        ? 'border-white'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                  >
                    <div className="flex gap-1 mb-1">
                      <div className="w-full h-3 rounded" style={{ backgroundColor: palette.primary }} />
                      <div className="w-full h-3 rounded" style={{ backgroundColor: palette.glow }} />
                    </div>
                    <div className="text-[10px] text-gray-300">{palette.name}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Scene */}
            <section>
              <h3 className="text-sm font-bold text-gray-300 mb-3">Scene</h3>
              <div className="grid grid-cols-2 gap-2">
                {SCENES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      initAudio();
                      setScene(s);
                      playSound('interact');
                    }}
                    className={`p-3 rounded border-2 transition ${
                      scene.id === s.id
                        ? 'border-white'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                    style={{ backgroundColor: s.color }}
                  >
                    <div className="text-xs font-bold">{s.name}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Actions */}
            <section className="space-y-2">
              <button
                onClick={randomizeRobot}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-3 px-4 rounded font-bold transition"
              >
                🎲 Randomize Robot
              </button>
              
              <button
                onClick={() => {
                  initAudio();
                  playSound('happy');
                }}
                className="w-full bg-green-600 hover:bg-green-700 py-2 px-4 rounded font-bold transition"
              >
                🔊 Test Sound
              </button>
              
              {!soundEnabled && (
                <div className="text-xs text-yellow-400 text-center p-2 bg-yellow-900/20 rounded">
                  Click any button to enable sound!
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

const PartSelector = ({ label, options, value, onChange }) => (
  <div>
    <label className="text-xs text-gray-400 block mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-sm hover:border-white/40 focus:border-white focus:outline-none"
    >
      {options.map(opt => (
        <option key={opt} value={opt}>{opt.toUpperCase()}</option>
      ))}
    </select>
  </div>
);

// ============================================================================
// RENDER
// ============================================================================

createRoot(document.getElementById('root')).render(<App />);