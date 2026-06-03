import { useState, useEffect, useRef } from 'react';

function useTankSound(isMoving) {
  const audioCtxRef = useRef(null);
  const engineOscRef = useRef(null);
  const trackNoiseRef = useRef(null);
  const gainNodeRef = useRef(null);

  useEffect(() => {
    if (isMoving && !audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.gain.value = 0.1;
      gainNodeRef.current.connect(audioCtxRef.current.destination);

      engineOscRef.current = audioCtxRef.current.createOscillator();
      engineOscRef.current.type = 'sawtooth';
      engineOscRef.current.frequency.setValueAtTime(50, audioCtxRef.current.currentTime);
      const filter = audioCtxRef.current.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, audioCtxRef.current.currentTime);
      engineOscRef.current.connect(filter);
      filter.connect(gainNodeRef.current);
      engineOscRef.current.start();

      const bufferSize = 2 * audioCtxRef.current.sampleRate;
      const noiseBuffer = audioCtxRef.current.createBuffer(1, bufferSize, audioCtxRef.current.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      trackNoiseRef.current = audioCtxRef.current.createBufferSource();
      trackNoiseRef.current.buffer = noiseBuffer;
      trackNoiseRef.current.loop = true;
      const trackFilter = audioCtxRef.current.createBiquadFilter();
      trackFilter.type = 'bandpass';
      trackFilter.frequency.setValueAtTime(400, audioCtxRef.current.currentTime);
      const lfo = audioCtxRef.current.createOscillator();
      lfo.frequency.setValueAtTime(5, audioCtxRef.current.currentTime);
      const lfoGain = audioCtxRef.current.createGain();
      lfoGain.gain.setValueAtTime(0.5, audioCtxRef.current.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(trackFilter.frequency);
      lfo.start();
      trackNoiseRef.current.connect(trackFilter);
      trackFilter.connect(gainNodeRef.current);
      trackNoiseRef.current.start();
    }

    if (audioCtxRef.current) {
      if (isMoving) {
        audioCtxRef.current.resume();
        gainNodeRef.current.gain.setTargetAtTime(0.1, audioCtxRef.current.currentTime, 0.1);
      } else {
        gainNodeRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.1);
      }
    }
  }, [isMoving]);
}

function TankIcon({ className, rotation, leftTrack, rightTrack }) {
  return (
    <svg 
      viewBox="0 0 16 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <style>
        {`
          @keyframes trackMove {
            from { transform: translateY(-3px); }
            to { transform: translateY(3px); }
          }
          .track-left {
            animation: trackMove 0.2s linear infinite;
            animation-play-state: ${leftTrack !== 0 ? 'running' : 'paused'};
            animation-direction: ${leftTrack < 0 ? 'reverse' : 'normal'};
          }
          .track-right {
            animation: trackMove 0.2s linear infinite;
            animation-play-state: ${rightTrack !== 0 ? 'running' : 'paused'};
            animation-direction: ${rightTrack < 0 ? 'reverse' : 'normal'};
          }
        `}
      </style>
      <rect x="0" y="0" width="3" height="16" fill="#2D3436" />
      <rect x="13" y="0" width="3" height="16" fill="#2D3436" />
      <g className="track-left">
        {[...Array(7)].map((_, i) => (
          <rect key={i} x="1" y={-2 + i * 3} width="1" height="1" fill="#636E72" />
        ))}
      </g>
      <g className="track-right">
        {[...Array(7)].map((_, i) => (
          <rect key={i} x="14" y={-2 + i * 3} width="1" height="1" fill="#636E72" />
        ))}
      </g>
      <rect x="3" y="2" width="10" height="12" fill="#4B5320" />
      <rect x="5" y="5" width="6" height="6" fill="#556B2F" />
      <rect x="7" y="0" width="2" height="6" fill="#556B2F" />
    </svg>
  );
}

function App() {
  const [pos, setPos] = useState({ x: window.innerWidth / 2 - 50, y: window.innerHeight / 2 - 50 });
  const [rotation, setRotation] = useState(0);
  const [tracks, setTracks] = useState({ left: 0, right: 0 });
  const keys = useRef({});
  const stateRef = useRef({ rotation: 0, x: window.innerWidth / 2 - 50, y: window.innerHeight / 2 - 50 });

  useTankSound(tracks.left !== 0 || tracks.right !== 0);

  useEffect(() => {
    const handleKeyDown = (e) => { keys.current[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e) => { keys.current[e.key.toLowerCase()] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const speed = 3;
    const rotationSpeed = 3;
    let animationFrame;

    const update = () => {
      let left = 0;
      let right = 0;
      
      const w = keys.current['w'] || keys.current['arrowup'];
      const s = keys.current['s'] || keys.current['arrowdown'];
      const a = keys.current['a'] || keys.current['arrowleft'];
      const d = keys.current['d'] || keys.current['arrowright'];

      if (a) stateRef.current.rotation -= rotationSpeed;
      if (d) stateRef.current.rotation += rotationSpeed;

      const rad = (stateRef.current.rotation - 90) * (Math.PI / 180);

      if (w) {
        stateRef.current.x += Math.cos(rad) * speed;
        stateRef.current.y += Math.sin(rad) * speed;
        left = 1; right = 1;
        if (a) left = 0.5;
        if (d) right = 0.5;
      } else if (s) {
        stateRef.current.x -= Math.cos(rad) * speed;
        stateRef.current.y -= Math.sin(rad) * speed;
        left = -1; right = -1;
        if (a) left = -0.5;
        if (d) right = -0.5;
      } else if (a) {
        left = -1; right = 1;
      } else if (d) {
        left = 1; right = -1;
      }

      setRotation(stateRef.current.rotation);
      setPos({ x: stateRef.current.x, y: stateRef.current.y });
      setTracks({ left, right });

      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div 
      className="relative min-h-screen w-full bg-[#2d5a27] overflow-hidden select-none"
      style={{
        backgroundImage: `
          radial-gradient(#3a7a32 1px, transparent 1px),
          linear-gradient(45deg, #2d5a27 25%, #244a1f 25%, #244a1f 50%, #2d5a27 50%, #2d5a27 75%, #244a1f 75%, #244a1f 100%)
        `,
        backgroundSize: '20px 20px, 4px 4px'
      }}
    >
      <div 
        className="absolute will-change-transform"
        style={{ left: pos.x, top: pos.y }}
      >
        <TankIcon 
          className="w-[100px] h-[100px]" 
          rotation={rotation} 
          leftTrack={tracks.left} 
          rightTrack={tracks.right} 
        />
      </div>

      <div className="absolute bottom-4 left-4 text-white/30 font-mono text-[10px] uppercase tracking-[0.2em] bg-black/10 p-2 rounded backdrop-blur-[2px] pointer-events-none">
        WASD / Arrows to Move • Smooth Controls Optimized
      </div>
    </div>
  )
}

export default App
