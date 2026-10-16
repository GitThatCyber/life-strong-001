import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect } from 'expo-router';
import { apiGet } from '../services/api';
import { adherenceText, metricText, type Progress } from '../features/progress/model';
import { offline, useOffline } from '../features/offline/store';
import { workoutStyles as s } from '../features/workouts/styles';
export default function ProgressScreen() {
  const [days,setDays] = useState(30);
  const [data,setData] = useState<Progress>();
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [selected,setSelected] = useState('');
  const state = useOffline();
  const requests = useRef(0);
  const pending = Object.values(state.workouts).reduce((sum,w) => sum+w.queue.length,0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const load = useCallback(async () => {
    const request = ++requests.current;
    setLoading(true);setError('');
    try {
      const result = await apiGet<Progress>(`/progress?days=${days}&timezone=${encodeURIComponent(timezone)}`);
      if (request === requests.current) setData(result);
    } catch (e) { if (request === requests.current) setError((e as Error).message); }
    finally { if (request === requests.current) setLoading(false); }
  },[days,timezone]);
  useFocusEffect(useCallback(() => { void load();return () => { requests.current++; }; },[load]));
  const record = data?.records.find(r => `${r.exercise_id}:${r.measurement_type}` === selected);
  const trends = record ? data?.trends.filter(t => t.exercise_id === record.exercise_id && t.measurement_type === record.measurement_type) : [];
  const max = Math.max(1,...(data?.weekly_frequency.map(w => w.sessions) ?? []));
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <Stack.Screen options={{ title: 'Progress' }} />
    <Text accessibilityRole="header" style={s.title}>Your training over time</Text>
    <Text style={s.body}>Completed, synchronized workouts · {timezone}</Text>
    <View style={s.row}>{[30,90,365].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`Show last ${n} days`} accessibilityState={{ selected: days === n }} style={[s.secondary,days === n && { backgroundColor: '#284850' }]} onPress={() => setDays(n)}><Text style={s.accent}>{n} days</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" disabled={loading} accessibilityState={{ disabled: loading }} style={[s.button,loading && s.disabled]} onPress={() => { void load(); }}><Text style={s.buttonText}>Refresh progress</Text></Pressable>
    {loading && <ActivityIndicator color="#65dcc0" accessibilityLabel="Loading progress" />}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}. Progress needs a connection; any previously shown snapshot remains dated below.</Text>}
    {!!pending && <View style={s.card}><Text style={s.body}>{pending} local changes are waiting to sync. They are not included in this report.</Text><Pressable accessibilityRole="button" style={s.secondary} onPress={() => { void offline.syncAll().then(load).catch(e => setError(e.message)); }}><Text style={s.accent}>Sync and refresh</Text></Pressable></View>}
    {data && <>
      <Text style={s.body}>Snapshot: {new Date(data.generated_at).toLocaleString()} · {data.from_date} through {data.today} ({data.days} days)</Text>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>Training summary</Text>
        <Text style={s.accent}>{data.summary.completed_sessions} completed workouts</Text>
        <Text style={s.body}>{data.summary.training_days} training days · {data.summary.recorded_sets} recorded sets</Text>
        {!data.summary.completed_sessions && <Text style={s.body}>Complete and synchronize a workout to build your progress history.</Text>}
      </View>
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.heading}>Current program</Text>
        <Text style={s.body}>{data.active_program?.name ?? 'No active program. Activate one from its library details.'}</Text>
        <Text style={s.body}>{adherenceText(data.adherence)}</Text>
        <Text style={s.body}>Adherence uses the current schedule and matching workout start date. Future days are excluded; late workouts still count in your training totals.</Text>
        {data.next_workout && <Link href={{ pathname: './workout',params: { templateId: data.next_workout.template_id } }} asChild><Pressable accessibilityRole="button" style={s.secondary}><Text style={s.accent}>Next: {data.next_workout.name}</Text><Text style={s.body}>{data.next_workout.scheduled_date}</Text></Pressable></Link>}
      </View>
      <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Weekly frequency</Text>
        {data.weekly_frequency.map(w => <View key={w.week_start} accessible accessibilityLabel={`Week of ${w.week_start}: ${w.sessions} completed workouts${w.partial_week ? ', partial week' : ''}`} style={{ gap: 6 }}>
          <Text style={s.body}>{w.week_start} · {w.sessions} workouts{w.partial_week ? ' · partial week' : ''}</Text>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 12,backgroundColor: '#0b1b21',borderRadius: 6 }}><View style={{ width: `${w.sessions/max*100}%`,height: 12,backgroundColor: '#65dcc0',borderRadius: 6 }} /></View>
        </View>)}
      </View>
      <Text accessibilityRole="header" style={s.heading}>All-time recorded bests</Text>
      <Text style={s.body}>Each value is an independent maximum from completed sessions, not necessarily one combined set. Longer duration or distance is a recorded maximum, not a performance score.</Text>
      {!data.records.length && <Text style={s.body}>No completed exercise records yet.</Text>}
      {data.records.map(r => { const key = `${r.exercise_id}:${r.measurement_type}`;return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: key === selected }} accessibilityLabel={`${r.name}: ${metricText(r)}. Show daily trend.`} style={s.card} onPress={() => setSelected(key)}>
        <Text style={s.accent}>{r.name}</Text><Text style={s.body}>{metricText(r)}</Text><Text style={s.body}>{r.measurement_type.replaceAll('_',' ')} · {r.recorded_sets} sets · Tap for trend</Text>
      </Pressable>; })}
      {record && <View style={s.card}><Text accessibilityRole="header" style={s.heading}>{record.name} · daily maxima</Text>
        {!trends?.length && <Text style={s.body}>No completed observations in this date window.</Text>}
        {trends?.map(t => <Text key={t.day} style={s.body}>{t.day}: {metricText(t)} · {t.recorded_sets} sets</Text>)}
      </View>}
      <Text accessibilityRole="header" style={s.heading}>Recent completed workouts</Text>
      {data.recent_sessions.map(w => <Link key={w.id} href={{ pathname: './workout',params: { sessionId: w.id } }} asChild><Pressable accessibilityRole="button" style={s.card}><Text style={s.accent}>{w.template_name}</Text><Text style={s.body}>{new Date(w.started_at).toLocaleString()} · Review sets</Text></Pressable></Link>)}
      <Link href="./sessions" style={[s.accent,{ paddingVertical: 14 }]}>Open saved workout history →</Link>
    </>}
  </ScrollView>;
}
