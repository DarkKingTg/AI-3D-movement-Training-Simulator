import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSimStore } from "@/store/simStore";

/**
 * VisionCamera — Aira's first-person eye view.
 *
 * Renders the scene from her eyeAnchor (head-mounted) into an off-screen
 * RenderTarget with human-like FOV (~100° vertical, near-clipping eye-close
 * enough to allow looking down at hands). Throttled to ~6 Hz to keep
 * performance high while still providing usable AI vision input.
 *
 * Pixel data is read into a Uint8ClampedArray and pushed to
 * `store.senses.visionData`. The SensorPanel reads this and paints it onto
 * a small DOM canvas.
 */
const W = 96;
const H = 72;
const FOV_DEG = 100;

const _euler = new THREE.Euler();
const _vec = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _accelPrev = new THREE.Vector3();
const _accelCurr = new THREE.Vector3();

export default function VisionCamera({ airaRef }) {
  const { gl, scene } = useThree();
  const eyeCam = useMemo(() => {
    const c = new THREE.PerspectiveCamera(FOV_DEG, W / H, 0.05, 80);
    c.layers.enableAll();
    return c;
  }, []);
  const renderTarget = useMemo(
    () => new THREE.WebGLRenderTarget(W, H, { depthBuffer: true }),
    []
  );
  const pixelBuf = useMemo(() => new Uint8Array(W * H * 4), []);

  const updateVision = useSimStore((s) => s.updateVision);
  const updateImu = useSimStore((s) => s.updateImu);
  const updateVisibleObjects = useSimStore((s) => s.updateVisibleObjects);
  const objects = useSimStore((s) => s.objects);

  const lastReadRef = useRef(0);
  const lastImuRef = useRef(0);

  useEffect(() => () => renderTarget.dispose(), [renderTarget]);

  useFrame((_, delta) => {
    if (!airaRef.current) return;
    const eye = airaRef.current.eyeAnchor?.current;
    const headBone = airaRef.current.bones?.head?.current;
    if (!eye || !headBone) return;

    // Position eyeCam at the eye world transform
    eye.getWorldPosition(_vec);
    eye.getWorldQuaternion(_quat);
    eyeCam.position.copy(_vec);
    eyeCam.quaternion.copy(_quat);
    // Three.js cameras look down -Z; our head's "forward" is +Z (since we
    // placed the eye anchor at z=0.18). Rotate camera 180° around Y so that
    // the head's forward axis (where eyes point) is the camera's viewing direction.
    eyeCam.rotateY(Math.PI);

    // Render and read pixels at ~6Hz
    const now = performance.now();
    if (now - lastReadRef.current > 160) {
      lastReadRef.current = now;
      gl.setRenderTarget(renderTarget);
      gl.render(scene, eyeCam);
      gl.readRenderTargetPixels(renderTarget, 0, 0, W, H, pixelBuf);
      gl.setRenderTarget(null);
      // Pixels come out flipped vertically — convert to top-down RGBA Uint8ClampedArray
      const flipped = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) {
        const srcRow = (H - 1 - y) * W * 4;
        const dstRow = y * W * 4;
        flipped.set(pixelBuf.subarray(srcRow, srcRow + W * 4), dstRow);
      }
      updateVision(flipped, W, H, FOV_DEG);
    }

    // IMU/proprioception throttled to ~10Hz
    if (now - lastImuRef.current > 100) {
      lastImuRef.current = now;
      headBone.getWorldQuaternion(_quat);
      _euler.setFromQuaternion(_quat, "YXZ");
      const headYaw = THREE.MathUtils.radToDeg(_euler.y);
      const headPitch = THREE.MathUtils.radToDeg(_euler.x);
      const headRoll = THREE.MathUtils.radToDeg(_euler.z);

      const pelvisRb = airaRef.current.pelvis?.current;
      let pelvisYaw = 0, pelvisPitch = 0, pelvisRoll = 0;
      if (pelvisRb) {
        const r = pelvisRb.rotation();
        _quat.set(r.x, r.y, r.z, r.w);
        _euler.setFromQuaternion(_quat, "YXZ");
        pelvisYaw = THREE.MathUtils.radToDeg(_euler.y);
        pelvisPitch = THREE.MathUtils.radToDeg(_euler.x);
        pelvisRoll = THREE.MathUtils.radToDeg(_euler.z);
      }

      // Head acceleration (rough)
      _accelCurr.copy(_vec);
      const dt = Math.max(0.001, delta);
      const accel = _accelCurr.clone().sub(_accelPrev).divideScalar(dt);
      _accelPrev.copy(_accelCurr);

      updateImu({
        headOrientationDeg: { yaw: +headYaw.toFixed(1), pitch: +headPitch.toFixed(1), roll: +headRoll.toFixed(1) },
        pelvisOrientationDeg: { yaw: +pelvisYaw.toFixed(1), pitch: +pelvisPitch.toFixed(1), roll: +pelvisRoll.toFixed(1) },
        headAccel: [+accel.x.toFixed(2), +accel.y.toFixed(2), +accel.z.toFixed(2)],
      });

      // Visible-object analysis: dot product between head forward and direction to object
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(eyeCam.quaternion).normalize();
      const eyePos = eyeCam.position;
      const visible = [];
      let closestDist = 0;
      for (const o of objects) {
        const dir = new THREE.Vector3(o.position[0], o.position[1], o.position[2]).sub(eyePos);
        const dist = dir.length();
        dir.normalize();
        const dot = dir.dot(forward);
        const angleDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(dot, -1, 1)));
        if (angleDeg < FOV_DEG / 2 && dist < 30) {
          visible.push({ id: o.id, type: o.type, distance: +dist.toFixed(2), angleDeg: +angleDeg.toFixed(1) });
        }
        if (o.type === "target") closestDist = +dist.toFixed(2);
      }
      updateVisibleObjects(visible.sort((a, b) => a.distance - b.distance).slice(0, 6), closestDist);
    }
  });

  return null;
}
