"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function SpaceBackground({ launching = false }) {
  const stars = useMemo(() => {
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 4,
    }));
  }, []);

  const asteroids = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      top: Math.random() * 90,
      size: Math.random() * 20 + 14,
      duration: Math.random() * 20 + 25,
      delay: Math.random() * -30,
    }));
  }, []);

  // One-shot rocket launch animation, replayed every time `launching` flips true
  const [launchKey, setLaunchKey] = useState(0);
  const prevLaunching = useRef(false);
  useEffect(() => {
    if (launching && !prevLaunching.current) {
      setLaunchKey((k) => k + 1);
    }
    prevLaunching.current = launching;
  }, [launching]);

  return (
    <div className="space-bg">
      {stars.map((s) => (
        <div
          key={s.id}
          className="star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {asteroids.map((a) => (
        <div
          key={a.id}
          className="asteroid"
          style={{
            top: `${a.top}%`,
            width: a.size,
            height: a.size,
            animationDuration: `${a.duration}s`,
            animationDelay: `${a.delay}s`,
          }}
        >
          ☄️
        </div>
      ))}

      {launching && (
        <div className="rocket-overlay" key={launchKey}>
          <div className="rocket">🚀</div>
          <div className="launch-text">LAUNCHING FLEETS...</div>
        </div>
      )}

      <style jsx>{`
        .space-bg {
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at bottom, #0f1a2e 0%, #05070d 100%);
          overflow: hidden;
          z-index: -1;
        }
        .star {
          position: absolute;
          background: white;
          border-radius: 50%;
          animation-name: twinkle;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        .asteroid {
          position: absolute;
          left: -60px;
          font-size: 20px;
          opacity: 0.5;
          animation-name: drift;
          animation-iteration-count: infinite;
          animation-timing-function: linear;
        }
        @keyframes drift {
          0% { transform: translateX(0) rotate(0deg); }
          100% { transform: translateX(110vw) rotate(360deg); }
        }
        .rocket-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 20;
          background: rgba(5, 7, 13, 0.55);
          pointer-events: none;
        }
        .rocket {
          font-size: 64px;
          animation: rocketFly 2.4s ease-in forwards;
        }
        @keyframes rocketFly {
          0% { transform: translateY(40vh) rotate(-45deg) scale(0.6); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-60vh) translateX(30vw) rotate(-45deg) scale(1.3); opacity: 0; }
        }
        .launch-text {
          color: #ffd166;
          font-weight: 700;
          letter-spacing: 2px;
          margin-top: 12px;
          animation: fadeOut 2.4s ease-in forwards;
        }
        @keyframes fadeOut {
          0%, 60% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}