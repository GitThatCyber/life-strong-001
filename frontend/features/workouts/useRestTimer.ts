import { useEffect, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import { restRemaining } from './model';
import { offline, useOffline } from '../offline/store';
import { emptyTimer } from '../offline/engine';
export function useRestTimer(id?: string) {
  const state = useOffline();
  const timer = (id && state.workouts[id]?.timer) || emptyTimer();
  const [now,setNow] = useState(Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = setInterval(update,250);
    const subscription = AppState.addEventListener('change',s => { if (s === 'active') update(); });
    return () => { clearInterval(interval); subscription.remove(); };
  },[]);
  useEffect(() => {
    if (id && timer.deadline !== null && restRemaining(timer.deadline,now) === 0) {
      offline.update(id,w => ({ ...w,timer: { deadline: null,paused: null,finished: true } }));
      if (AppState.currentState === 'active') Vibration.vibrate();
    }
  },[id,timer.deadline,now]);
  const change = (next: typeof timer) => { if (id) offline.update(id,w => ({ ...w,timer: next })); };
  const start = (seconds: number) => { setNow(Date.now()); change({ deadline: seconds > 0 ? Date.now()+seconds*1000 : null,paused: null,finished: false }); };
  return {
    remaining: timer.paused ?? restRemaining(timer.deadline,now),running: timer.deadline !== null,paused: timer.paused !== null,finished: timer.finished,
    start,stop: () => change(emptyTimer()),
    pause: () => { if (timer.deadline !== null) change({ deadline: null,paused: restRemaining(timer.deadline,Date.now()),finished: false }); },
    resume: () => { if (timer.paused !== null) start(timer.paused); },
    add: () => change(timer.paused !== null ? { ...timer,paused: timer.paused+30 } : { deadline: Math.max(timer.deadline ?? Date.now(),Date.now())+30000,paused: null,finished: false }),
  };
}
