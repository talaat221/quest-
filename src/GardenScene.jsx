import scene from './garden-scene-layers.json';

/**
 * All artwork shares one coordinate system, including the partly off-canvas
 * clouds. Scale/crop the whole scene once, never individual sprite layers.
 * Layer IDs and pivots are retained for a later animation pass; nothing moves.
 */
export default function GardenScene() {
  return (
    <svg
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
