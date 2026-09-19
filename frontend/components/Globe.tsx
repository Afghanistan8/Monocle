"use client";

import { useEffect, useRef } from "react";

const DEG = Math.PI / 180;
const TILT = -18 * DEG; // view latitude: look slightly down on the northern hemisphere
const SPEED = 0.06; // degrees per frame

type Point = { lon: number; lat: number; cosLat: number; sinLat: number };

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let points: Point[] = [];
    let rotation = -20; // start over Africa/Europe
    let raf = 0;
    let visible = true;
    let dragging = false;
    let lastX = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width, height) * 0.42;
      ctx.clearRect(0, 0, width, height);

      // Body of the sphere.
      const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      body.addColorStop(0, "#1d1d20");
      body.addColorStop(1, "#0b0b0c");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = body;
      ctx.fill();

      // Land dots.
      const lon0 = rotation * DEG;
      const sinT = Math.sin(TILT);
      const cosT = Math.cos(TILT);
      for (const p of points) {
        const dl = p.lon - lon0;
        const cosDl = Math.cos(dl);
        const z = sinT * p.sinLat + cosT * p.cosLat * cosDl;
        if (z <= 0) continue;
        const x = p.cosLat * Math.sin(dl);
        const y = cosT * p.sinLat - sinT * p.cosLat * cosDl;
        const shade = 0.25 + 0.75 * z;
        ctx.fillStyle = `rgba(236, 236, 240, ${shade.toFixed(3)})`;
        const size = 0.7 + 0.9 * z;
        ctx.fillRect(cx + x * r - size / 2, cy - y * r - size / 2, size, size);
      }

      // Lit rim: bright along the lower-left edge, fading around.
      const rim = ctx.createLinearGradient(cx - r, cy + r, cx + r, cy - r);
      rim.addColorStop(0, "rgba(255,255,255,0.95)");
      rim.addColorStop(0.45, "rgba(255,255,255,0.35)");
      rim.addColorStop(1, "rgba(255,255,255,0.08)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = rim;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = "rgba(255,255,255,0.55)";
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Two thin orbit arcs hugging the top-left shoulder, outside the body.
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.055, Math.PI * 1.12, Math.PI * 1.46);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.arc(cx - r * 0.02, cy - r * 0.02, r * 1.11, Math.PI * 1.2, Math.PI * 1.36);
      ctx.stroke();
    };

    const tick = () => {
      if (visible && !dragging && !reduced) rotation += SPEED;
      draw();
      raf = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      rotation -= (e.clientX - lastX) * 0.35;
      lastX = e.clientX;
      if (reduced) draw();
    };
    const onUp = () => {
      dragging = false;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    observer.observe(canvas);

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    fetch("/globe-dots.json")
      .then((res) => res.json() as Promise<number[]>)
      .then((flat) => {
        const next: Point[] = [];
        for (let i = 0; i + 1 < flat.length; i += 2) {
          const lat = flat[i + 1] * DEG;
          next.push({ lon: flat[i] * DEG, lat, cosLat: Math.cos(lat), sinLat: Math.sin(lat) });
        }
        points = next;
        if (reduced) draw();
      })
      .catch(() => undefined);

    if (reduced) draw();
    else raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Rotating dotted globe" role="img" style={{ touchAction: "pan-y", cursor: "grab" }} />;
}
