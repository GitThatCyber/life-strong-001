import { useEffect, useState } from 'react';
import { AppState, Text } from 'react-native';
import { offline, useOffline } from './store';
import { reconcileNotifications } from '../notifications/local';
export function BackgroundWork() {
  const state = useOffline();
  const [warning,setWarning] = useState('');
  const timers = JSON.stringify(Object.entries(state.workouts).map(([id,w]) => [id,w.timer,w.server.status,w.queue.filter(q => q.kind === 'status').map(q => q.status)]));
  const notify = () => { void reconcileNotifications().then(() => setWarning('')).catch(e => setWarning(`Notification scheduling failed: ${e.message}`)); };
  useEffect(notify,[timers]);
  useEffect(() => {
    const sync = () => { void offline.syncAll().catch(e => setWarning(`Local storage error: ${e.message}`)); };
    sync(); notify();
    const interval = setInterval(sync,15000);
    const subscription = AppState.addEventListener('change',s => { if (s === 'active') { sync(); notify(); } });
    return () => { clearInterval(interval); subscription.remove(); };
  },[]);
  return warning ? <Text accessibilityRole="alert" style={{ backgroundColor: '#10232a',color: '#ffb4ab',padding: 10 }}>{warning}</Text> : null;
}
