import React, { useRef, useEffect, useState } from 'react';

const ParticleSphere = ({ isAgentSpeaking }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const [sphereCtx, setSphereCtx] = useState(null);

  // Sphere animation variables
  const numParticles = 1500;
  const particleSphereRadius = 100;
  const rotationSpeed = 0.002;
  const baseParticleColor = 'rgba(97, 218, 251, 0.7)';
  const speakingParticleColor = 'rgba(255, 140, 0, 0.9)';
  
  // Wave animation properties
  const waveAmplitude = 20;
  const waveFrequency = 2;
  const waveSpeed = 0.05;
  
  const sphereRotationRef = useRef({ x: 0, y: 0 });
  const wavePhaseRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  // Initialize particles
  const initializeParticles = () => {
    const particles = [];
    for (let i = 0; i < numParticles; i++) {
      // Distribute points on a sphere using Fibonacci lattice
      const phi = Math.acos(-1 + (2 * i) / numParticles);
      const theta = Math.sqrt(numParticles * Math.PI) * phi;

      const x = particleSphereRadius * Math.cos(theta) * Math.sin(phi);
      const y = particleSphereRadius * Math.sin(theta) * Math.sin(phi);
      const z = particleSphereRadius * Math.cos(phi);

      particles.push({
        x: x, y: y, z: z,
        ox: x, oy: y, oz: z, // Store original positions
        color: baseParticleColor
      });
    }
    particlesRef.current = particles;
  };

  // Draw particle sphere
  const drawParticleSphere = (timestamp) => {
    if (!sphereCtx || !canvasRef.current) return;

    const canvas = canvasRef.current;
    // const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = timestamp;

    sphereCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Simple auto-rotation
    sphereRotationRef.current.y += rotationSpeed;

    if (isAgentSpeaking) {
      wavePhaseRef.current += waveSpeed;
    }

    const halfWidth = canvas.width / 2;
    const halfHeight = canvas.height / 2;

    // Sort particles by Z for pseudo-3D effect
    const sortedParticles = [...particlesRef.current].sort((a, b) => a.z - b.z);

    sortedParticles.forEach(p => {
      let x = p.ox;
      let y = p.oy;
      let z = p.oz;
      let currentParticleColor = baseParticleColor;

      if (isAgentSpeaking) {
        currentParticleColor = speakingParticleColor;
        // Apply wavy animation
        const originalAngle = Math.atan2(p.oy, p.ox);
        const waveEffect = Math.sin(originalAngle * waveFrequency + p.oz * 0.1 + wavePhaseRef.current) * waveAmplitude;
        const waveFactor = (particleSphereRadius + waveEffect) / particleSphereRadius;
        
        x = p.ox * waveFactor;
        y = p.oy * waveFactor;
      }

      // 3D Rotation around Y axis
      const rotY_x = x * Math.cos(sphereRotationRef.current.y) - z * Math.sin(sphereRotationRef.current.y);
      const rotY_z = x * Math.sin(sphereRotationRef.current.y) + z * Math.cos(sphereRotationRef.current.y);
      x = rotY_x;
      z = rotY_z;

      // Simple perspective projection
      const perspectiveFactor = 300 / (300 + z);
      const projectedX = x * perspectiveFactor + halfWidth;
      const projectedY = y * perspectiveFactor + halfHeight;
      
      // Vary particle size and opacity with depth
      let particleSize = Math.max(0.5, 2.5 * perspectiveFactor);
      let alpha = Math.max(0.1, 0.8 * perspectiveFactor);
      if (z < -particleSphereRadius * 0.5) alpha *= 0.5;

      sphereCtx.beginPath();
      sphereCtx.arc(projectedX, projectedY, particleSize, 0, 2 * Math.PI);
      
      // Adjust color alpha
      let finalColor = currentParticleColor.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3,${alpha.toFixed(2)})`);
      sphereCtx.fillStyle = finalColor;
      sphereCtx.fill();
    });

    animationRef.current = requestAnimationFrame(drawParticleSphere);
  };

  // Initialize canvas and start animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    setSphereCtx(ctx);
    initializeParticles();

    lastFrameTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(drawParticleSphere);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawParticleSphere]);

  // Update animation when speaking state changes
  useEffect(() => {
    // Animation will automatically respond to isAgentSpeaking changes
    // through the drawParticleSphere function
  }, [isAgentSpeaking]);

  return (
    <canvas 
      ref={canvasRef}
      className="sphere-canvas"
      width={300}
      height={300}
    />
  );
};

export default ParticleSphere; 