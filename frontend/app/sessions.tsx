import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect } from 'expo-router';
import { apiGet } from '../services/api';
import type { SessionSummary } from '../features/workouts/model';
import { offline, useOffline } from '../features/offline/store';
import { projected } from '../features/offline/engine';
import { workoutStyles as s } from '../features/workouts/styles';
export default function SessionsScreen() {
  const state = useOffline();
  const [remote,setRemote] = useState<SessionSummary[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRemote(await apiGet<SessionSummary[]>('/sessions')); }
    catch { setError('Unable to reach the server. Locally cached workouts remain available.'); }
    finally { setLoading(false); }
  },[]);
  useFocusEffect(useCallback(() => { void load(); },[load]));
  const merged = new Map(remote.map(s => [s.id,s]));
  for (const w of Object.values(state.workouts)) merged.set(w.server.id,projected(w));
  const sessions = [...merged.values()].sort((a,b) => Number(a.status === 'completed')-Number(b.status === 'completed') || Date.parse(b.started_at)-Date.parse(a.started_at));
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <Stack.Screen options={{ title: 'Saved workouts' }} /><Text accessibilityRole="header" style={s.title}>Pick up where you left off</Text>
    <Text style={s.body}>Open a saved workout, recover a form, or synchronize queued changes.</Text>
    <Pressable accessibilityRole="button" disabled={loading} style={s.button} onPress={() => { void load(); void offline.syncAll().catch(e => setError(e.message)); }}><Text style={s.buttonText}>Refresh / sync workouts</Text></Pressable>
    {loading && <ActivityIndicator color="#65dcc0" />}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {Object.keys(state.starts).map(templateId => <Link key={templateId} href={{ pathname: './workout',params: { templateId } }} asChild><Pressable style={s.card}><Text style={s.accent}>Recover an unconfirmed workout start</Text><Text style={s.body}>Reconnect and retry with the original operation ID.</Text></Pressable></Link>)}
    {!loading && !sessions.length && <Text style={s.body}>No cached workouts yet. Start one from a template while connected.</Text>}
    {sessions.map(session => <Link key={session.id} href={{ pathname: './workout',params: { sessionId: session.id } }} asChild><Pressable accessibilityRole="button" style={s.card}>
      <Text style={s.heading}>{session.template_name}</Text><Text style={s.accent}>{session.status} · {state.workouts[session.id]?.queue.length ?? 0} pending changes</Text>
      <Text style={s.body}>{new Date(session.started_at).toLocaleString()}</Text>
    </Pressable></Link>)}
  </ScrollView>;
}
