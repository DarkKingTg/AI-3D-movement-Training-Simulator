/**
 * Curriculum levels — progressively harder.
 * Each level defines target distance and obstacles to spawn.
 */
export const CURRICULUM = [
  {
    id: 1, name: "Steady Steps",
    description: "Walk to a near target. No obstacles.",
    targetDist: 2.5,
    obstacles: [],
    parTime: 8,
  },
  {
    id: 2, name: "Stretching Out",
    description: "Reach a farther target. Clean path.",
    targetDist: 4.5,
    obstacles: [],
    parTime: 12,
  },
  {
    id: 3, name: "First Obstacle",
    description: "One box stands between Aira and the goal.",
    targetDist: 5.5,
    obstacles: [{ type: "box", at: 0.5 }],
    parTime: 16,
  },
  {
    id: 4, name: "Slalom",
    description: "Two obstacles to weave around.",
    targetDist: 7,
    obstacles: [
      { type: "box", at: 0.35, offset: 0.6 },
      { type: "box", at: 0.7, offset: -0.6 },
    ],
    parTime: 22,
  },
  {
    id: 5, name: "Ramp & Ball",
    description: "Long walk, ramp at midpoint, ball to follow.",
    targetDist: 9,
    obstacles: [
      { type: "ramp", at: 0.5 },
      { type: "ball", at: 0.7, offset: 1.0 },
    ],
    parTime: 30,
  },
  {
    id: 6, name: "Marathon Mind",
    description: "Far target, full obstacle gauntlet.",
    targetDist: 12,
    obstacles: [
      { type: "box", at: 0.25, offset: 0.5 },
      { type: "box", at: 0.4, offset: -0.5 },
      { type: "ramp", at: 0.6 },
      { type: "box", at: 0.8, offset: 0.4 },
    ],
    parTime: 45,
  },
];

/**
 * Build a layout for a given level: random direction, target + obstacles
 * placed along the line between origin and target.
 */
export function buildLevelLayout(levelIdx) {
  const level = CURRICULUM[Math.min(levelIdx, CURRICULUM.length - 1)];
  const angle = Math.random() * Math.PI * 2;
  const dirX = Math.cos(angle);
  const dirZ = Math.sin(angle);
  const perpX = -dirZ;
  const perpZ = dirX;

  const targetPos = [dirX * level.targetDist, 0, dirZ * level.targetDist];

  const objects = [{ type: "target", position: targetPos }];

  for (const ob of level.obstacles) {
    const along = ob.at * level.targetDist;
    const offset = ob.offset || 0;
    const px = dirX * along + perpX * offset;
    const pz = dirZ * along + perpZ * offset;
    const y = ob.type === "ramp" ? 0.1 : ob.type === "ball" ? 0.4 : 0.5;
    objects.push({ type: ob.type, position: [px, y, pz] });
  }

  return { level, objects };
}
