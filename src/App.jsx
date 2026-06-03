import { useState, useEffect, useRef, useMemo } from 'react';

// Pseudo-random number generator based on a seed
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function generateObstacles(seed, width, height) {
  const rand = mulberry32(seed);
  const obstacles = [];
  const count = 20; // Increased count since they are smaller
  
  for (let i = 0; i < count; i++) {
    const w = (40 + rand() * 100) * 0.6; // 60% scale
    const h = (40 + rand() * 100) * 0.6; // 60% scale
    const x = rand() * (width - w);
    const y = rand() * (height - h);
    
    // Starting point safe zone (100, 100)
    const dist = Math.sqrt(Math.pow(x + w/2 - 100, 2) + Math.pow(y + h/2 - 100, 2));
    if (dist > 100) {
      obstacles.push({ x, y, w, h });
    }
  }
  return obstacles;
}

function useTankSound(isMoving) {
  const audioCtxRef = useRef(null);
  const engineOscRef = useRef(null);
  const gainNodeRef = useRef(null);

  useEffect(() => {
    if (isMoving && !audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.gain.value = 0.05;
      gainNodeRef.current.connect(audioCtxRef.current.destination);

      engineOscRef.current = audioCtxRef.current.createOscillator();
      engineOscRef.current.type = 'sawtooth';
      engineOscRef.current.frequency.setValueAtTime(50, audioCtxRef.current.currentTime);
      const filter = audioCtxRef.current.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, audioCtxRef.current.currentTime);
      engineOscRef.current.connect(filter);
      filter.connect(gainNodeRef.current);
      engineOscRef.current.start();
    }

    if (audioCtxRef.current) {
      if (isMoving) {
        audioCtxRef.current.resume();
        gainNodeRef.current.gain.setTargetAtTime(0.05, audioCtxRef.current.currentTime, 0.1);
      } else {
        gainNodeRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.1);
      }
    }
  }, [isMoving]);

  const playShootSound = () => {
    if (!audioCtxRef.current) return;
    const osc = audioCtxRef.current.createOscillator();
    const gain = audioCtxRef.current.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtxRef.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtxRef.current.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, audioCtxRef.current.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtxRef.current.destination);
    osc.start();
    osc.stop(audioCtxRef.current.currentTime + 0.1);
  };

  return { playShootSound };
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

function checkCollision(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.w &&
    rect1.x + rect1.w > rect2.x &&
    rect1.y < rect2.y + rect2.h &&
    rect1.y + rect1.h > rect2.y
  );
}

function App() {
  const [seed, setSeed] = useState(12345);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [rotation, setRotation] = useState(0);
  const [tracks, setTracks] = useState({ left: 0, right: 0 });
  const [bullets, setBullets] = useState([]);
  const keys = useRef({});
  const stateRef = useRef({ rotation: 0, x: 50, y: 50 });
  const lastShootTime = useRef(0);

  const obstacles = useMemo(() => generateObstacles(seed, window.innerWidth, window.innerHeight), [seed]);

  const { playShootSound } = useTankSound(tracks.left !== 0 || tracks.right !== 0);

  useEffect(() => {
    const handleKeyDown = (e) => { 
      keys.current[e.key.toLowerCase()] = true; 
      if (e.code === 'Space') { shoot(); }
      if (e.key === 'r') { 
        setSeed(Math.floor(Math.random() * 100000)); 
        stateRef.current = { rotation: 0, x: 50, y: 50 }; 
        setPos({x:50, y:50}); 
        setRotation(0); 
      }
    };
    const handleKeyUp = (e) => { keys.current[e.key.toLowerCase()] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const speed = 2.5;
    const rotationSpeed = 3;
    const bulletSpeed = 7;
    let animationFrame;

    const shoot = () => {
      const now = Date.now();
      if (now - lastShootTime.current < 400) return;
      lastShootTime.current = now;
      playShootSound();
      const rad = (stateRef.current.rotation - 90) * (Math.PI / 180);
      // Adjusted shoot position for 60px tank
      const startX = stateRef.current.x + 30 + Math.cos(rad) * 25;
      const startY = stateRef.current.y + 30 + Math.sin(rad) * 25;
      setBullets(prev => [...prev, {
        id: now,
        x: startX,
        y: startY,
        vx: Math.cos(rad) * bulletSpeed,
        vy: Math.sin(rad) * bulletSpeed,
        rotation: stateRef.current.rotation
      }]);
    };

    const update = () => {
      let left = 0, right = 0;
      const w = keys.current['w'] || keys.current['arrowup'];
      const s = keys.current['s'] || keys.current['arrowdown'];
      const a = keys.current['a'] || keys.current['arrowleft'];
      const d = keys.current['d'] || keys.current['arrowright'];

      if (a) stateRef.current.rotation -= rotationSpeed;
      if (d) stateRef.current.rotation += rotationSpeed;

      const rad = (stateRef.current.rotation - 90) * (Math.PI / 180);
      let nextX = stateRef.current.x;
      let nextY = stateRef.current.y;

      if (w) {
        nextX += Math.cos(rad) * speed;
        nextY += Math.sin(rad) * speed;
        left = 1; right = 1;
        if (a) left = 0.5;
        if (d) right = 0.5;
      } else if (s) {
        nextX -= Math.cos(rad) * speed;
        nextY -= Math.sin(rad) * speed;
        left = -1; right = -1;
        if (a) left = -0.5;
        if (d) right = -0.5;
      } else if (a) {
        left = -1; right = 1;
      } else if (d) {
        left = 1; right = -1;
      }

      // Tank collision check (for 60x60 tank, with small padding)
      const tankRect = { x: nextX + 12, y: nextY + 12, w: 36, h: 36 };
      const hasCollision = obstacles.some(obs => checkCollision(tankRect, obs));
      
      // Screen boundary check
      const outOfBounds = nextX < 0 || nextX > window.innerWidth - 60 || nextY < 0 || nextY > window.innerHeight - 60;

      if (!hasCollision && !outOfBounds) {
        stateRef.current.x = nextX;
        stateRef.current.y = nextY;
      }

      setRotation(stateRef.current.rotation);
      setPos({ x: stateRef.current.x, y: stateRef.current.y });
      setTracks({ left, right });

      // Update bullets and check collisions
      setBullets(prev => prev
        .map(b => ({ ...b, x: b.x + b.vx, y: b.y + b.vy }))
        .filter(b => {
          const bulletRect = { x: b.x - 2, y: b.y - 2, w: 4, h: 4 };
          const hitWall = obstacles.some(obs => checkCollision(bulletRect, obs));
          const outOfBounds = b.x < -100 || b.x > window.innerWidth + 100 || b.y < -100 || b.y > window.innerHeight + 100;
          return !hitWall && !outOfBounds;
        })
      );

      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrame);
    };
  }, [obstacles]);

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
      {/* Obstacles */}
      {obstacles.map((obs, i) => (
        <div 
          key={i}
          className="absolute bg-[#576574] border-[3px] border-[#222f3e] shadow-lg rounded-sm"
          style={{ left: obs.x, top: obs.y, width: obs.w, height: obs.h }}
        >
          <div className="w-full h-full opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, #000 6px, #000 12px)' }}></div>
        </div>
      ))}

      {/* Bullets */}
      {bullets.map(b => (
        <div 
          key={b.id}
          className="absolute w-1.5 h-3 bg-yellow-400 rounded-full shadow-[0_0_8px_#facc15]"
          style={{ left: b.x - 3, top: b.y - 6, transform: `rotate(${b.rotation}deg)` }}
        />
      ))}

      {/* Tank */}
      <div className="absolute will-change-transform" style={{ left: pos.x, top: pos.y }}>
        <TankIcon className="w-[60px] h-[60px]" rotation={rotation} leftTrack={tracks.left} rightTrack={tracks.right} />
      </div>

      <div className="absolute top-4 left-4 text-white/50 font-mono text-[10px] bg-black/40 p-2 rounded-lg backdrop-blur-md flex flex-col gap-0.5 border border-white/10">
        <div className="flex justify-between gap-4"><span>SEED:</span> <span className="text-yellow-400">{seed}</span></div>
        <div className="text-[8px] opacity-70 italic tracking-tighter">PRESS 'R' TO REGENERATE MAP</div>
      </div>

      <div className="absolute bottom-4 left-4 text-white/30 font-mono text-[9px] uppercase tracking-[0.2em] bg-black/10 p-2 rounded backdrop-blur-[2px] pointer-events-none">
        WASD to Move • SPACE to Shoot • R to Shuffle Map
      </div>
    </div>
  )
}

export default App
