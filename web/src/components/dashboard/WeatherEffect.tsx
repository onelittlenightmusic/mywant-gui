import React, { useEffect, useRef } from 'react';

export type WeatherCondition = 'rain' | 'storm' | 'cloudy' | 'snow' | 'fog' | 'sunny' | 'default' | '';

interface WeatherEffectProps {
  condition: WeatherCondition;
  intensity?: number; // 0-100
}

// ── Rain / Storm ─────────────────────────────────────────────────────────────

interface Raindrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  opacity: number;
  width: number;
}

function initRaindrops(canvas: HTMLCanvasElement, count: number, isStorm: boolean): Raindrop[] {
  const drops: Raindrop[] = [];
  for (let i = 0; i < count; i++) {
    drops.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      len:   isStorm ? 22 + Math.random() * 40  : 10 + Math.random() * 20,
      speed: isStorm ? 18 + Math.random() * 22  :  8 + Math.random() * 12,
      opacity: isStorm ? 0.35 + Math.random() * 0.55 : 0.2 + Math.random() * 0.5,
      width: isStorm ? 0.9 + Math.random() * 1.3 : 0.5 + Math.random() * 1,
    });
  }
  return drops;
}

function drawRain(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  drops: Raindrop[],
  isStorm: boolean,
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (isStorm) {
    ctx.fillStyle = 'rgba(5,5,25,0.13)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const angle = isStorm ? 0.35 : 0.18; // radians — storm is more slanted
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (const drop of drops) {
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x + drop.len * sin, drop.y + drop.len * cos);
    ctx.strokeStyle = isStorm
      ? `rgba(180,200,255,${drop.opacity})`
      : `rgba(160,190,240,${drop.opacity})`;
    ctx.lineWidth = drop.width;
    ctx.stroke();

    // advance
    drop.x += drop.speed * sin;
    drop.y += drop.speed * cos;

    if (drop.y > canvas.height || drop.x > canvas.width) {
      drop.x = Math.random() * canvas.width - canvas.width * 0.2;
      drop.y = -drop.len;
    }
  }
}

function useRainAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isStorm: boolean,
  intensity: number,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const count = isStorm
      ? Math.floor(200 + intensity * 3.0)   // storm: 200-500 drops
      : Math.floor(60  + intensity * 1.4);  // rain:  60-200 drops
    const drops = initRaindrops(canvas, count, isStorm);
    let rafId = 0;

    const frame = () => {
      drawRain(ctx, canvas, drops, isStorm);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [canvasRef, isStorm, intensity, active]);
}

// ── Snow ─────────────────────────────────────────────────────────────────────

interface Snowflake {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  driftPhase: number;
  opacity: number;
}

function initSnowflakes(canvas: HTMLCanvasElement, count: number): Snowflake[] {
  const flakes: Snowflake[] = [];
  for (let i = 0; i < count; i++) {
    flakes.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 1.5 + Math.random() * 3.5,
      speed: 0.5 + Math.random() * 1.5,
      drift: (Math.random() - 0.5) * 0.8,
      driftPhase: Math.random() * Math.PI * 2,
      opacity: 0.4 + Math.random() * 0.5,
    });
  }
  return flakes;
}

function useSnowAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  intensity: number,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const count = Math.floor(40 + intensity * 0.6);
    const flakes = initSnowflakes(canvas, count);
    let t = 0;
    let rafId = 0;

    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.01;
      for (const flake of flakes) {
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230,240,255,${flake.opacity})`;
        ctx.fill();

        flake.y += flake.speed;
        flake.x += flake.drift * Math.sin(t + flake.driftPhase);

        if (flake.y > canvas.height) {
          flake.y = -flake.r;
          flake.x = Math.random() * canvas.width;
        }
        if (flake.x < 0) flake.x = canvas.width;
        if (flake.x > canvas.width) flake.x = 0;
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [canvasRef, intensity, active]);
}

// ── Clouds ────────────────────────────────────────────────────────────────────

interface Cloud {
  x: number;       // logical position 0..1 of cloud center
  y: number;       // 0..1 height
  w: number;       // logical width 0..1
  h: number;       // logical height 0..1
  speed: number;   // logical/sec
  opacity: number;
  layers: number;  // number of "bumps"
}

function initClouds(count: number): Cloud[] {
  // Distribute clouds across distinct horizontal streaks (筋).
  const streakCount = Math.max(3, Math.ceil(count * 0.75));
  const clouds: Cloud[] = [];

  for (let s = 0; s < streakCount; s++) {
    // Evenly space streak Y levels between 5% and 42% of canvas height.
    const baseY = 0.05 + (s / Math.max(streakCount - 1, 1)) * 0.37;
    // Each streak moves at the same speed so clouds stay in formation.
    const streakSpeed = 0.004 + Math.random() * 0.014;
    const perStreak = 2 + Math.floor(Math.random() * 2); // 2-3 clouds per streak

    for (let i = 0; i < perStreak; i++) {
      const w = 0.14 + Math.random() * 0.22;
      clouds.push({
        // Spread initial X so streaks are not all on the left edge.
        x: Math.random(),
        // Small Y jitter within the streak lane.
        y: baseY + (Math.random() - 0.5) * 0.025,
        w,
        h: 0.036 + Math.random() * 0.052,
        speed: streakSpeed,
        opacity: 0.45 + Math.random() * 0.4,
        layers: 3 + Math.floor(Math.random() * 4),
      });
    }
  }
  return clouds;
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number,
  layers: number,
  opacity: number,
  isShadow: boolean,
) {
  const bumpW = w / layers;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = isShadow ? 'rgba(60,60,80,1)' : 'rgba(230,235,245,1)';

  // base ellipse
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.4, w * 0.5, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  // top bumps
  for (let i = 0; i < layers; i++) {
    const bx = cx - w * 0.4 + bumpW * i + bumpW * 0.5;
    const by = cy + h * 0.1;
    const br = h * (0.45 + 0.25 * Math.sin((i / (layers - 1)) * Math.PI));
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function useCloudAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  intensity: number,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const count = Math.floor(3 + intensity * 0.05); // 3-8 → produces 3-8 streaks * 2-3 clouds each
    const clouds = initClouds(count);
    let last = performance.now();
    let rafId = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width;
      const H = canvas.height;

      for (const cloud of clouds) {
        // advance
        cloud.x += cloud.speed * dt;
        if (cloud.x - cloud.w / 2 > 1.1) {
          cloud.x = -cloud.w;
          // Keep y to maintain streak lane; only vary opacity.
          cloud.opacity = 0.45 + Math.random() * 0.4;
        }

        const cx = cloud.x * W;
        const cy = cloud.y * H;
        const w = cloud.w * W;
        const h = cloud.h * H;

        // Shadow on canvas floor: constant offset from cloud so inter-cloud
        // spacing is preserved (bird's-eye projection — no Y compression).
        const shadowOffsetY = H * 0.52;
        const shadowCx = cx;            // same X as cloud
        const shadowCy = cy + shadowOffsetY;
        const shadowScaleX = 1.3;
        const shadowScaleY = 0.20;
        const shadowOpacity = cloud.opacity * 0.11;

        ctx.save();
        ctx.scale(shadowScaleX, shadowScaleY);
        drawCloud(
          ctx,
          shadowCx / shadowScaleX,
          (shadowCy + h * 0.5) / shadowScaleY,
          w, h * 2,
          cloud.layers,
          shadowOpacity,
          true,
        );
        ctx.restore();

        // cloud itself
        drawCloud(ctx, cx, cy + h, w, h, cloud.layers, cloud.opacity, false);
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [canvasRef, intensity, active]);
}

// ── Fog ──────────────────────────────────────────────────────────────────────

function useFogAnimation(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  intensity: number,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let t = 0;
    let rafId = 0;
    const baseAlpha = 0.06 + intensity * 0.0012;

    const frame = () => {
      t += 0.003;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const alpha = baseAlpha + Math.sin(t) * 0.015;
      ctx.fillStyle = `rgba(200,210,220,${alpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // drifting fog bands
      for (let i = 0; i < 3; i++) {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        const offset = ((t * (0.5 + i * 0.3)) % 1 + i / 3) % 1;
        grad.addColorStop(0, 'rgba(200,215,225,0)');
        grad.addColorStop(offset, `rgba(200,215,225,${baseAlpha * 1.5})`);
        grad.addColorStop(Math.min(offset + 0.3, 1), 'rgba(200,215,225,0)');
        grad.addColorStop(1, 'rgba(200,215,225,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, (canvas.height / 3) * i, canvas.width, canvas.height / 3);
      }
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [canvasRef, intensity, active]);
}

// ── Main component ────────────────────────────────────────────────────────────

export const WeatherEffect: React.FC<WeatherEffectProps> = ({ condition, intensity = 60 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isRain  = condition === 'rain';
  const isStorm = condition === 'storm';
  const isCloudy = condition === 'cloudy';
  const isSnow  = condition === 'snow';
  const isFog   = condition === 'fog';

  useRainAnimation(canvasRef, isStorm, intensity, isRain || isStorm);
  useSnowAnimation(canvasRef, intensity, isSnow);
  useCloudAnimation(canvasRef, intensity, isCloudy);
  useFogAnimation(canvasRef, intensity, isFog);

  // Resize canvas when container resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    });
    ro.observe(parent);
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    return () => ro.disconnect();
  }, []);

  const visible = isRain || isStorm || isCloudy || isSnow || isFog;
  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    />
  );
};
