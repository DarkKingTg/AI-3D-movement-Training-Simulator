import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useSimStore } from "@/store/simStore";
import {
  buildObservation,
  computeReward,
  detectEpisodeEnd,
  validateMotorAction,
} from "@/sim/aiTrainingSchema";
import {
  detectBodyStressBreak,
  detectGLoadBreak,
  detectHyperextension,
  detectJointCommandBreak,
  detectTorqueBreak,
} from "@/sim/breakSystem";
import { pulse } from "@/sim/pipelineState";

const BRIDGE_HZ = 20;
const MAX_EPISODE_MS = 60000;
const RECONNECT_MS = 2500;

export default function AiTrainingBridge({ airaRef }) {
  const enabled = useSimStore((s) => s.trainingBridge.enabled);
  const wsUrl = useSimStore((s) => s.trainingBridge.wsUrl);
  const updateTrainingBridge = useSimStore((s) => s.updateTrainingBridge);
  const applyMotorAction = useSimStore((s) => s.applyMotorAction);
  const recordBreak = useSimStore((s) => s.recordBreak);
  const advanceTrainingEpisode = useSimStore((s) => s.advanceTrainingEpisode);
  const recordMovementLesson = useSimStore((s) => s.recordMovementLesson);
  const pushThought = useSimStore((s) => s.pushThought);

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const accumRef = useRef(0);
  const tickRef = useRef(0);
  const lastObsRef = useRef(null);
  const lastActionRef = useRef(null);
  const lastActionAtRef = useRef(Date.now());
  const episodeStartedAtRef = useRef(Date.now());
  const episodeHandledRef = useRef(false);

  const applyExternalAction = (rawAction) => {
    const state = useSimStore.getState();
    const action = rawAction?.action || rawAction || {};
    const dt = Math.max(0.001, (Date.now() - lastActionAtRef.current) / 1000);
    const hyper = action.joints || action.jointTargets ? detectHyperextension(action.joints || action.jointTargets) : null;
    if (hyper) {
      recordBreak(hyper);
      return { accepted: false, reason: hyper.reason, break: hyper };
    }

    const validatedPreview = validateMotorAction(action, state.joints, state.motorGains);
    const unsafeMotion = detectJointCommandBreak(state.joints, validatedPreview.joints, dt);
    const unsafeTorque = detectTorqueBreak(validatedPreview.gains);
    if (unsafeMotion || unsafeTorque) {
      const event = unsafeMotion || unsafeTorque;
      recordBreak(event);
      return { accepted: false, reason: event.reason, break: event };
    }

    const validated = applyMotorAction(action);
    lastActionRef.current = validated;
    lastActionAtRef.current = Date.now();
    applyRootIntent(validated, airaRef);
    pulse("motor");
    return { accepted: true, action: validated };
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.airaAiOutput = applyExternalAction;
    window.airaTrainingBridge = {
      version: "aira-movement-v1",
      applyAction: applyExternalAction,
      getObservation: () => lastObsRef.current,
      setEnabled: (value) => useSimStore.getState().setTrainingBridgeEnabled(!!value),
      setMode: (mode) => useSimStore.getState().setTrainingBridgeMode(mode),
      setSkill: (skill) => useSimStore.getState().setTrainingBridgeSkill(skill),
      resetEpisode: (reason = "manual_reset") => {
        advanceTrainingEpisode({ reason, success: false, t: Date.now() });
        episodeStartedAtRef.current = Date.now();
        episodeHandledRef.current = false;
      },
    };
    return () => {
      if (window.airaAiOutput === applyExternalAction) delete window.airaAiOutput;
      if (window.airaTrainingBridge?.applyAction === applyExternalAction) delete window.airaTrainingBridge;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airaRef, advanceTrainingEpisode]);

  useEffect(() => {
    if (!enabled || !wsUrl || typeof WebSocket === "undefined") {
      closeSocket(wsRef);
      updateTrainingBridge({ connected: false });
      return undefined;
    }

    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      closeSocket(wsRef);
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => updateTrainingBridge({ connected: true, lastError: null });
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            const action = payload.type === "action" ? payload.action : payload;
            applyExternalAction(action);
          } catch (err) {
            updateTrainingBridge({ lastError: `bad action: ${err.message}` });
          }
        };
        ws.onerror = () => updateTrainingBridge({ connected: false, lastError: "WebSocket error" });
        ws.onclose = () => {
          updateTrainingBridge({ connected: false });
          if (!cancelled) reconnectRef.current = setTimeout(connect, RECONNECT_MS);
        };
      } catch (err) {
        updateTrainingBridge({ connected: false, lastError: err.message });
        reconnectRef.current = setTimeout(connect, RECONNECT_MS);
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      closeSocket(wsRef);
      updateTrainingBridge({ connected: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, wsUrl]);

  useFrame((_, delta) => {
    if (!enabled) return;
    accumRef.current += delta;
    const interval = 1 / BRIDGE_HZ;
    if (accumRef.current < interval) return;
    const dt = accumRef.current;
    accumRef.current = 0;

    const state = useSimStore.getState();
    const observation = buildObservation(state, airaRef, { tick: tickRef.current, dt });
    const stressBreak = detectBodyStressBreak(observation.body) || detectGLoadBreak(observation.senses?.imu?.headAccel);
    if (stressBreak) recordBreak(stressBreak);

    const reward = computeReward(observation, lastObsRef.current, lastActionRef.current);
    const episodeEnd = detectEpisodeEnd(observation, episodeStartedAtRef.current, MAX_EPISODE_MS);

    if (typeof window !== "undefined") {
      window.airaAiInput = observation;
      if (window.airaTrainingBridge) window.airaTrainingBridge.lastReward = reward;
    }

    const bridgePatch = {
      tick: tickRef.current,
      lastReward: reward.total,
      rewardBreakdown: reward.breakdown,
      lastObservationAt: Date.now(),
    };

    if (episodeEnd && !episodeHandledRef.current) {
      episodeHandledRef.current = true;
      bridgePatch.lastEpisodeEnd = { ...episodeEnd, t: Date.now() };

      // --- Analytics Hook ---
      const storeState = useSimStore.getState();
      const isSuccess = episodeEnd.success;
      const rewardTotal = reward.total;
      const skill = observation.goal;
      const durationMs = Date.now() - episodeStartedAtRef.current;
      
      storeState.recordEpisodeAnalytics({
        success: isSuccess,
        reward: rewardTotal,
        duration: durationMs,
        skill,
        t: Date.now()
      });

      const history = storeState.analytics.historicalEpisodes;
      if (isSuccess && (!history.length || !history.find(e => e.success && e.skill === skill))) {
         storeState.recordBreakthrough(`First successful episode for skill: ${skill.toUpperCase()}!`);
      } else if (isSuccess && rewardTotal > 50 && (!history.find(e => e.reward > 50 && e.skill === skill))) {
         storeState.recordBreakthrough(`High reward breakthrough on ${skill.toUpperCase()} (${rewardTotal.toFixed(1)} pts)!`);
      }
      // ----------------------

      if (episodeEnd.reason === "fall" && !observation.injuryState?.broken) {
        recordMovementLesson({
          kind: "movement_failure",
          skill: observation.goal,
          reason: "fall",
          text: "I fell because I lost balance before finishing the movement. Next time I should slow down, keep my center of mass above my feet, and recover balance first.",
        });
      }
      sendToPolicy({
        type: "episode_end",
        observation,
        reward,
        episodeEnd,
        lesson: useSimStore.getState().movementLessons?.[0] || null,
      }, wsRef.current);
      setTimeout(() => {
        advanceTrainingEpisode({ ...episodeEnd, t: Date.now() });
        episodeStartedAtRef.current = Date.now();
        episodeHandledRef.current = false;
        pushThought("learn", `episode reset · ${episodeEnd.reason}`);
      }, 250);
    } else {
      sendToPolicy({ type: "observation", observation, reward }, wsRef.current);
    }

    updateTrainingBridge(bridgePatch);
    lastObsRef.current = observation;
    tickRef.current += 1;
    pulse("senses");
    pulse("brain");
  });

  return null;
}

function applyRootIntent(action, airaRef) {
  const pelvis = airaRef?.current?.pelvis?.current;
  if (!pelvis) return;
  try {
    const intent = action.rootIntent || {};
    const velocity = intent.velocity || [0, 0];
    if (Math.abs(velocity[0]) > 0.001 || Math.abs(velocity[1]) > 0.001) {
      const lv = pelvis.linvel();
      pelvis.setLinvel({ x: velocity[0], y: lv.y, z: velocity[1] }, true);
    }
    if (intent.jump) {
      const impulse = Math.min(2.5, Math.max(0.4, (action.gains?.forceLimit || 20) * 0.035));
      pelvis.applyImpulse({ x: 0, y: impulse, z: 0 }, true);
    }
    if (action.manipulation) {
      window.dispatchEvent(new CustomEvent(`aira:${action.manipulation.type}`, { detail: action.manipulation }));
    }
  } catch {}
}

function sendToPolicy(payload, ws) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {}
}

function closeSocket(wsRef) {
  if (!wsRef.current) return;
  try {
    wsRef.current.close();
  } catch {}
  wsRef.current = null;
}
