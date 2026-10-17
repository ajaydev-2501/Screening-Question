"use client";

import { useEffect, useRef } from "react";

type ColorType = "white" | "ice" | "ochre" | "amber";

interface SwarmParticle {
  angle: number;
  speedScale: number;
  radiusFactor: number;
  wobblePhase: number;
  wobbleAmount: number;
  dot: number;
  opacity: number;
  tail: number;
  colorType: ColorType;
}

const TAU = Math.PI * 2;

/**
 * Loading indicator built entirely from orbiting particles: a dense swarm travelling around a
 * ring, brightest at the sweeping head and fading behind it, so it reads as a rotating loader.
 */
export function ParticleLoader({
  size = 18,
  count = 120,
  variant = "default",
}: {
  size?: number;
  count?: number;
  variant?: "default" | "ochre";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const center = size / 2;
    const ringRadius = size * 0.34;
    // One revolution of the swarm per ~1.25s, or ~5s when motion is reduced.
    const omega = reducedMotion ? 0.0012 : 0.005;

    const colorTypes: ColorType[] =
      variant === "ochre"
        ? ["ochre", "amber", "white", "ochre", "amber"]
        : ["white", "ice", "white", "ochre", "ice"];

    const particles: SwarmParticle[] = Array.from({ length: count }, (_, i) => {
      const colorType = colorTypes[i % colorTypes.length] ?? "white";
      return {
        // Even spacing keeps the ring dense and smooth; the small jitter stops it looking machined.
        angle: (i / count) * TAU + Math.random() * 0.05,
        speedScale: 0.97 + Math.random() * 0.07,
        radiusFactor: 0.86 + Math.random() * 0.28,
        wobblePhase: Math.random() * TAU,
        wobbleAmount: 0.02 + Math.random() * 0.04,
        dot: (0.28 + Math.random() * 0.42) * (size / 18),
        opacity: 0.34 + Math.random() * 0.36,
        tail: reducedMotion ? 0 : 0.05 + Math.random() * 0.08,
        colorType,
      };
    });

    const getColor = (type: ColorType, alpha: number) => {
      switch (type) {
        case "ochre":
          return `rgba(217, 160, 60, ${alpha})`;
        case "amber":
          return `rgba(245, 158, 11, ${alpha})`;
        case "ice":
          return `rgba(180, 215, 255, ${alpha})`;
        case "white":
        default:
          return `rgba(255, 255, 255, ${alpha})`;
      }
    };

    let elapsed = 0;
    let last = performance.now();
    let frameId = 0;

    const render = (now: number) => {
      // Clamp so a backgrounded tab does not jump the swarm forward by minutes.
      const dt = Math.min(40, now - last);
      last = now;
      elapsed += dt;

      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = "lighter";

      const head = elapsed * omega;

      for (const p of particles) {
        p.angle += omega * p.speedScale * dt;

        const radius = ringRadius * (p.radiusFactor + Math.sin(elapsed * 0.003 + p.wobblePhase) * p.wobbleAmount);
        // 0 at the sweeping head, 1 for a particle a full lap behind it. The smooth ramp is what
        // makes the ring read as a rotating loader rather than a static circle of dots.
        const behind = ((((head - p.angle) % TAU) + TAU) % TAU) / TAU;
        const twinkle = 0.78 + 0.22 * Math.sin(elapsed * 0.006 + p.wobblePhase * 3);
        const headAlpha = Math.min(0.85, p.opacity * (0.14 + 0.86 * Math.pow(1 - behind, 2.4)) * twinkle);

        const samples = p.tail > 0 ? 3 : 1;
        for (let s = 0; s < samples; s += 1) {
          const t = s / samples;
          const a = p.angle - p.tail * t;
          const alpha = headAlpha * (1 - t * 0.6);
          if (alpha < 0.015) continue;

          const x = center + Math.cos(a) * radius;
          const y = center + Math.sin(a) * radius;
          const color = getColor(p.colorType, alpha);

          if (s === 0 && !reducedMotion) {
            ctx.shadowBlur = size * 0.2;
            ctx.shadowColor = color;
          }
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.28, p.dot * (1 - t * 0.4)), 0, TAU);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      ctx.globalCompositeOperation = "source-over";
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(frameId);
  }, [count, size, variant]);

  return (
    <span
      role="status"
      aria-label="Processing"
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0" />
    </span>
  );
}
