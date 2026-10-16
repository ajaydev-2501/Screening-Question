"use client";

import { useEffect, useRef } from "react";

type ColorType = "white" | "ochre" | "ice" | "amber";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vyOffset: number;
  radius: number;
  opacity: number;
  colorType: ColorType;
  trailLength: number;
  phase: number;
}

/**
 * Animated particle flow effect for buttons during backend operations.
 * Renders dozens of glowing particles streaming smoothly across the button background
 * with organic sinusoidal wave drift, trailing tails, and soft lighting.
 */
export function ParticleFlow({
  active = true,
  count = 42,
  variant = "default",
}: {
  active?: boolean;
  count?: number;
  variant?: "default" | "ochre" | "subtle";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const updateDimensions = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(canvas);

    const colorTypes: ColorType[] =
      variant === "ochre"
        ? ["ochre", "amber", "white", "ochre"]
        : ["white", "ice", "ochre", "white", "ice"];

    const particles: Particle[] = Array.from({ length: count }, () => {
      const selectedColor = colorTypes[Math.floor(Math.random() * colorTypes.length)] ?? "white";
      return {
        x: Math.random() * (width || 200),
        y: Math.random() * (height || 50),
        vx: prefersReducedMotion ? 0.3 : 1.2 + Math.random() * 2.2,
        vyOffset: 0.02 + Math.random() * 0.04,
        radius: 1.0 + Math.random() * 2.2,
        opacity: 0.35 + Math.random() * 0.6,
        colorType: selectedColor,
        trailLength: prefersReducedMotion ? 4 : 10 + Math.random() * 22,
        phase: Math.random() * Math.PI * 2,
      };
    });

    let time = 0;

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

    const render = () => {
      time += prefersReducedMotion ? 0.01 : 0.035;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (!p) continue;

        p.x += p.vx;
        p.y += Math.sin(time + p.phase) * (prefersReducedMotion ? 0.1 : 0.35);

        // Wrap around when particle passes right edge
        if (p.x - p.trailLength > width) {
          p.x = -p.trailLength - Math.random() * 15;
          p.y = Math.random() * height;
          p.vx = prefersReducedMotion ? 0.3 : 1.2 + Math.random() * 2.2;
          p.phase = Math.random() * Math.PI * 2;
        }

        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const headAlpha = p.opacity;
        const color = getColor(p.colorType, headAlpha);
        const trailColorStart = getColor(p.colorType, 0);

        // Draw particle trail
        if (p.x > 0 && !prefersReducedMotion) {
          const trailStartX = Math.max(0, p.x - p.trailLength);
          const gradient = ctx.createLinearGradient(trailStartX, p.y, p.x, p.y);
          gradient.addColorStop(0, trailColorStart);
          gradient.addColorStop(1, color);

          ctx.beginPath();
          ctx.moveTo(trailStartX, p.y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = Math.max(0.75, p.radius * 0.7);
          ctx.lineCap = "round";
          ctx.stroke();
        }

        // Draw particle head with glowing highlight
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [active, count, variant]);

  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Ambient gentle light sweep overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50 mix-blend-overlay animate-pulse" />
    </div>
  );
}
