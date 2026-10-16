import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { apiGet, apiRequest } from '../services/api';
import { localDate } from '../features/progress/model';

type Exercise = { id: string; name: string; equipment: string; measurement_type: string };
type Template = { id: string; name: string; description: string };
type Program = { id: string; name: string; description: string; weeks: number };
type ProgramDetail = Program & { schedule: { id: string; week: number; day: number; template_name: string }[] };
type TemplateDetail = Template & { exercises: { id: string; name: string; prescription: string; rest_seconds: number }[] };
export default function BrowseScreen() {
  const [data,setData] = useState<{ exercises: Exercise[]; templates: Template[]; programs: Program[] }>();
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [selection,setSelection] = useState<{ kind: 'program' | 'template'; id: string }>();
  const [detail,setDetail] = useState<ProgramDetail | TemplateDetail>();
  const [detailError,setDetailError] = useState('');
  const [activating,setActivating] = useState(false);
  const [activationMessage,setActivationMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [exercises,templates,programs] = await Promise.all([
        apiGet<Exercise[]>('/exercises'),apiGet<Template[]>('/workout-templates'),apiGet<Program[]>('/programs'),
      ]);
      setData({ exercises,templates,programs });
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load library'); }
    finally { setLoading(false); }
  },[]);
  useEffect(() => { void load(); },[load]);
  useEffect(() => {
    let current = true;
    setDetail(undefined); setDetailError(''); setActivationMessage('');
    if (selection) void apiGet<ProgramDetail | TemplateDetail>(`/${selection.kind === 'program' ? 'programs' : 'workout-templates'}/${selection.id}`)
      .then(value => { if (current) setDetail(value); })
      .catch(e => { if (current) setDetailError(e instanceof Error ? e.message : 'Unable to load details'); });
    return () => { current = false; };
  },[selection]);
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Stack.Screen options={{ title: 'Training library' }} />
    <Text accessibilityRole="header" style={styles.title}>Build your next session</Text>
    <Text style={styles.body}>Programs, reusable workouts, and exercises from your library.</Text>
    <Pressable accessibilityRole="button" disabled={loading} style={styles.button} onPress={() => { setSelection(undefined); void load(); }}>
      <Text style={styles.buttonText}>{loading ? 'Loading…' : 'Refresh library'}</Text>
    </Pressable>
    {loading && <ActivityIndicator color="#65dcc0" />}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}. Check that the API is running, then refresh.</Text>}
    {selection && <View style={styles.card}>
      <Pressable accessibilityRole="button" onPress={() => setSelection(undefined)}><Text style={styles.accent}>Close details</Text></Pressable>
      {!detail && !detailError && <ActivityIndicator color="#65dcc0" />}
      {!!detailError && <Text accessibilityRole="alert" style={styles.error}>{detailError}</Text>}
      {detail && <>
        <Text style={styles.heading}>{detail.name}</Text><Text style={styles.body}>{detail.description}</Text>
        {'schedule' in detail && <>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: activating }} disabled={activating} style={styles.button} onPress={() => {
            const programId = detail.id;
            Alert.alert('Activate program today?','This replaces your current active program. Day 1 starts today; saved workout history is unchanged.',[
              { text: 'Cancel',style: 'cancel' },{ text: 'Activate',onPress: () => {
                setActivating(true);setActivationMessage('');
                void apiRequest(`/programs/${programId}/activate`,'POST',{ start_date: localDate(new Date()) })
                  .then(() => setActivationMessage('Program activated. Open Progress to see your schedule and adherence.'))
                  .catch(e => setActivationMessage(e.message)).finally(() => setActivating(false));
              } },
            ]);
          }}><Text style={styles.buttonText}>{activating ? 'Activating…' : 'Activate program today'}</Text></Pressable>
          {!!activationMessage && <Text accessibilityLiveRegion="polite" style={styles.accent}>{activationMessage}</Text>}
        </>}
        {'schedule' in detail ? detail.schedule.map(s => <Text key={s.id} style={styles.body}>Week {s.week} · Day {s.day}: {s.template_name}</Text>)
          : detail.exercises.map(e => <View key={e.id}><Text style={styles.accent}>{e.name}</Text><Text style={styles.body}>{e.prescription} · Rest {e.rest_seconds}s</Text></View>)}
        {!('schedule' in detail) && <Link href={{ pathname: './workout',params: { templateId: detail.id } }} asChild>
          <Pressable style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>Open workout</Text></Pressable>
        </Link>}
      </>}
    </View>}
    {data && <>
      <Text style={styles.heading}>Programs</Text>
      {!data.programs.length && <Text style={styles.body}>No programs yet. Run the starter seed or create one through the API.</Text>}
      {data.programs.map(p => <Pressable key={p.id} accessibilityRole="button" style={styles.card} onPress={() => setSelection({ kind: 'program',id: p.id })}>
        <Text style={styles.accent}>{p.name}</Text><Text style={styles.body}>{p.weeks} weeks · Tap for schedule</Text>
      </Pressable>)}
      <Text style={styles.heading}>Workout templates</Text>
      {!data.templates.length && <Text style={styles.body}>No workout templates yet.</Text>}
      {data.templates.map(t => <Pressable key={t.id} accessibilityRole="button" style={styles.card} onPress={() => setSelection({ kind: 'template',id: t.id })}>
        <Text style={styles.accent}>{t.name}</Text><Text style={styles.body}>Tap for exercises and prescriptions</Text>
      </Pressable>)}
      <Text style={styles.heading}>Exercises</Text>
      {!data.exercises.length && <Text style={styles.body}>No exercises yet.</Text>}
      {data.exercises.map(e => <View key={e.id} style={styles.card}><Text style={styles.accent}>{e.name}</Text><Text style={styles.body}>{e.equipment || 'No equipment'} · {e.measurement_type.replaceAll('_',' ')}</Text></View>)}
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1,backgroundColor: '#10232a' },content: { padding: 24,gap: 16,paddingBottom: 60 },
  title: { color: '#fff',fontSize: 30,fontWeight: '700' },heading: { color: '#fff',fontSize: 22,fontWeight: '600',marginTop: 8 },
  body: { color: '#b2c4c9',fontSize: 16,lineHeight: 24 },accent: { color: '#65dcc0',fontSize: 18,fontWeight: '600' },
  card: { backgroundColor: '#19353e',padding: 18,borderRadius: 12,gap: 8 },
  button: { backgroundColor: '#65dcc0',padding: 16,borderRadius: 10,alignItems: 'center' },
  buttonText: { color: '#10232a',fontWeight: '700',fontSize: 16 },error: { color: '#ffb4ab',fontSize: 16 },
});
