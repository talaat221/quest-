import { useEffect, useRef } from 'react';
import scene from './garden-scene-layers.json';
import { observeGardenVisibility } from './garden-scene-motion.js';
import './garden-scene-motion.css';

/**
 * All artwork shares one coordinate system, including the partly off-canvas
 * clouds. Scale/crop the whole scene once, never individual sprite layers.
 * Only the separate clouds, moon and wind-leaf sprite move. The artwork and
 * stacking order stay intact; the tree, crops and other scenery remain still.
 */
export default function GardenScene() {
  const sceneRef = useRef(null);
  useEffect(() => observeGardenVisibility(sceneRef.current), []);

  return (
    <svg
      ref={sceneRef}
      className="qd-garden-scene"
      viewBox={`0 0 ${scene.canvas.width} ${scene.canvas.height}`}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
      focusable="false"
    >
      {scene.layers.map((layer) => (
        <image
          key={layer.id}
          data-scene-layer={layer.id}
          href={layer.src}
          x={layer.x}
          y={layer.y}
          width={layer.width}
          height={layer.height}
          preserveAspectRatio="none"
        />
      ))}
    </svg>
  );
}
