import { Fragment, useEffect, useId, useRef } from 'react';
import scene from './garden-scene-layers.json';
import { observeGardenVisibility } from './garden-scene-motion.js';
import './garden-scene-motion.css';

/**
 * All artwork shares one coordinate system, including the partly off-canvas
 * clouds. Scale/crop the whole scene once, never individual sprite layers.
 * The canopy moves around its branch junction; the trunk stays rooted.
 * Flame motion is clipped to the lantern glass, leaving its frame untouched.
 * All original artwork and layer coordinates stay intact.
 */
export default function GardenScene() {
  const sceneRef = useRef(null);
  const flameClipId = useId();
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
        <Fragment key={layer.id}>
          <image
            data-scene-layer={layer.id}
            href={layer.src}
            x={layer.x}
            y={layer.y}
            width={layer.width}
            height={layer.height}
            preserveAspectRatio="none"
          />
          {layer.id === '10-lantern' && (
            <svg
              data-scene-effect="lantern-flame"
              x={layer.x}
              y={layer.y}
              width={layer.width}
              height={layer.height}
              viewBox={`0 0 ${layer.width} ${layer.height}`}
              focusable="false"
            >
              <defs>
                <clipPath id={flameClipId} clipPathUnits="userSpaceOnUse">
                  {/* The dark center bar and all outer metal stay uncovered. */}
                  <rect x="12" y="27" width="5" height="12" />
                  <rect x="20" y="27" width="5" height="12" />
                </clipPath>
              </defs>
              <g clipPath={`url(#${flameClipId})`}>
                <g className="qd-lantern-flame" shapeRendering="crispEdges">
                  <rect x="11" y="25" width="15" height="15" fill="#a74d14" opacity=".28" />
                  <path
                    fill="#ffc34b"
                    d="M13 38V33H14V30H15V28H16V31H18V29H19V26H20V30H22V32H24V35H25V38Z"
                  />
                  <path
                    fill="#fff3b1"
                    d="M14 38V35H15V32H16V34H17V37H21V35H22V33H23V36H24V38Z"
                  />
                </g>
              </g>
            </svg>
          )}
        </Fragment>
      ))}
    </svg>
  );
}
