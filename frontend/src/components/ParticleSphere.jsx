import { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 520;

const ParticleSphere = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !('CanvasRenderingContext2D' in window)) return undefined;

    const context = canvas?.getContext('2d');
    if (!context) return undefined;

    const particles = Array.from({ length: PARTICLE_COUNT }, (_, index) => {
      const y = 1 - (index / (PARTICLE_COUNT - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const angle = Math.PI * (3 - Math.sqrt(5)) * index;
      return {
        x: Math.cos(angle) * radius,
        y,
        z: Math.sin(angle) * radius,
        size: 0.55 + ((index * 17) % 10) / 10,
        brightness: 0.35 + ((index * 29) % 65) / 100,
      };
    });

    let width = 0;
    let height = 0;
    let frameId;
    let rotation = 0;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resizeObserver = new ResizeObserver(() => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    });

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const radius = Math.min(width, height) * 0.43;
      const centerX = width / 2;
      const centerY = height / 2;
      const sine = Math.sin(rotation);
      const cosine = Math.cos(rotation);

      const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      glow.addColorStop(0, 'rgba(31, 233, 255, 0.16)');
      glow.addColorStop(0.52, 'rgba(31, 255, 165, 0.09)');
      glow.addColorStop(0.82, 'rgba(31, 229, 255, 0.045)');
      glow.addColorStop(1, 'rgba(31, 229, 255, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.fill();

      particles.forEach((particle) => {
        const x = particle.x * cosine - particle.z * sine;
        const z = particle.x * sine + particle.z * cosine;
        const depth = (z + 1) / 2;
        const perspective = 0.78 + depth * 0.22;
        const alpha = particle.brightness * (0.18 + depth * 0.82);
        context.beginPath();
        context.arc(
          centerX + x * radius * perspective,
          centerY + particle.y * radius * perspective,
          particle.size * (0.65 + depth * 0.55),
          0,
          Math.PI * 2,
        );
        context.fillStyle = `rgba(${depth > 0.76 ? '31, 233, 255' : '31, 255, 165'}, ${alpha})`;
        context.fill();
      });

      context.save();
      context.translate(centerX, centerY);
      context.rotate(-0.28);
      context.beginPath();
      context.ellipse(0, 0, radius * 1.13, radius * 0.31, 0, 0, Math.PI * 2);
      context.strokeStyle = 'rgba(31, 229, 255, 0.2)';
      context.lineWidth = 1;
      context.stroke();
      context.restore();
    };

    const animate = () => {
      draw();
      if (!motionQuery.matches && document.documentElement.dataset.lowData !== 'true') {
        rotation += 0.0025;
        frameId = window.requestAnimationFrame(animate);
      }
    };

    const start = () => {
      window.cancelAnimationFrame(frameId);
      animate();
    };
    const lowDataObserver = new MutationObserver(start);
    lowDataObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-low-data'],
    });
    motionQuery.addEventListener('change', start);
    resizeObserver.observe(canvas);
    start();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      lowDataObserver.disconnect();
      motionQuery.removeEventListener('change', start);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-sphere" aria-hidden="true" />;
};

export default ParticleSphere;
