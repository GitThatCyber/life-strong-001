import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { describeTargets, type Targets } from '../features/library/model';
import { apiGet, apiRequest } from '../services/api';
import { describeSet, draftFromSet, emptyDraft, labels, metricFields, nextPosition, parseSet, restRemaining, type Session, type WorkoutSet } from '../features/workouts/model';
import { useRestTimer } from '../features/workouts/useRestTimer';
import { workoutStyles as s } from '../features/workouts/styles';
import { offline, useOffline } from '../features/offline/store';
import { emptyTimer, projected, type FormState } from '../features/offline/engine';
type Template = { id: string; name: string; description: string; exercises: ({ id: string; name: string; prescription: string } & Targets)[] };
const initialForm = (): FormState => ({ index: 0,draft: emptyDraft(),dirty: false });
export default function WorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ templateId?: string; sessionId?: string }>();
  const templateId = typeof params.templateId === 'string' ? params.templateId : undefined;
  const requestedId = typeof params.sessionId === 'string' ? params.sessionId : undefined;
  const [id,setId] = useState(requestedId);
  const state = useOffline();
  const local = id ? state.workouts[id] : undefined;
  const session = local ? projected(local) : undefined;
  const form = local?.form ?? initialForm();
  const exercise = session?.exercises[form.index];
  const edit = exercise?.sets.find(set => set.operation_id === form.editOperation);
  const [template,setTemplate] = useState<Template>();
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const guard = useRef(false);
  const rest = useRestTimer(id);
  const totalSets = session?.exercises.reduce((sum,e) => sum+e.sets.length,0) ?? 0;
  async function action(work: () => Promise<void>) {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save. Your existing local data is retained.'); }
    finally { guard.current = false; setBusy(false); }
  }
  const load = useCallback(async () => {
    if (requestedId) {
      setId(requestedId);
      const cached = offline.getSnapshot().workouts[requestedId];
      if (cached?.queue.length) { setMessage('Recovered local workout and pending changes.'); return; }
      try { offline.cache(await apiGet<Session>(`/sessions/${requestedId}`),initialForm()); }
      catch (e) { if (cached) setMessage('Using your saved local workout. Changes will sync when connected.'); else throw e; }
    } else if (templateId) setTemplate(await apiGet<Template>(`/workout-templates/${templateId}`));
    else throw new Error('Choose a template or a saved workout first.');
  },[requestedId,templateId]);
  useEffect(() => { void action(load); },[load]);
  function patchForm(change: Partial<FormState>) {
    if (id) offline.update(id,w => ({ ...w,form: { ...w.form,...change } }));
  }
  function clearForm() { patchForm({ draft: emptyDraft(),editOperation: undefined,dirty: false }); setMessage(''); Keyboard.dismiss(); }
  function sync() { if (id) void offline.sync(id).catch(e => setError(e.message)); }
  async function start() {
    if (!template) return;
    await action(async () => {
      const operation = offline.startOperation(template.id,randomUUID);
      const saved = await apiRequest<Session>('/sessions','POST',{ template_id: template.id,operation_id: operation });
      offline.cache(saved,initialForm()); setId(saved.id); offline.finishStart(template.id);
      setMessage('Workout started. Drafts now save on this iPhone.');
    });
  }
  async function save() {
    if (!id || !session || !exercise) return;
    await action(async () => {
      const values = parseSet(exercise.measurement_type,form.draft,edit?.position ?? nextPosition(exercise.sets));
      offline.enqueue(id,{ id: randomUUID(),kind: edit ? 'correction' : 'set',exerciseId: exercise.id,
        operationId: edit?.operation_id ?? randomUUID(),values },{ ...form,editOperation: undefined,dirty: false },
        edit ? undefined : { deadline: exercise.rest_seconds > 0 ? Date.now()+exercise.rest_seconds*1000 : null,paused: null,finished: false });
      Keyboard.dismiss(); setMessage('Set recorded on this iPhone.');
      sync();
    });
  }
  function select(index: number) {
    if (!session || index < 0 || index >= session.exercises.length || index === form.index) return;
    const move = () => { clearForm(); patchForm({ index }); };
    if (form.dirty || edit) Alert.alert('Change exercise?','The current unsaved form will be cleared. Recorded and queued sets are kept.',[
      { text: 'Stay',style: 'cancel' },{ text: 'Change exercise',onPress: move },
    ]); else move();
  }
  async function status(next: Session['status']) {
    if (!id || !local) return;
    await action(async () => {
      const timer = next === 'completed' ? emptyTimer() : next === 'paused' && local.timer.deadline !== null
        ? { deadline: null,paused: restRemaining(local.timer.deadline,Date.now()),finished: false }
        : next === 'active' && local.timer.paused !== null ? { deadline: Date.now()+local.timer.paused*1000,paused: null,finished: false } : local.timer;
      offline.enqueue(id,{ id: randomUUID(),kind: 'status',status: next },next === 'completed' ? { ...form,draft: emptyDraft(),editOperation: undefined,dirty: false } : undefined,timer);
      if (next === 'completed') { Keyboard.dismiss(); setMessage('Workout complete locally. Check synchronization below.'); }
      sync();
    });
  }
  function complete() {
    const untouched = session?.exercises.filter(e => !e.sets.length).length ?? 0;
    Alert.alert('Complete workout?',`${totalSets} sets recorded.${untouched ? ` ${untouched} exercises have no sets.` : ''}${form.dirty || edit ? ' Unsaved form changes will be cleared.' : ''} Pending changes stay queued until synchronized.`,[
      { text: 'Keep training',style: 'cancel' },{ text: 'Complete workout',onPress: () => { void status('completed'); } },
    ]);
  }
  function openEdit(set: WorkoutSet) {
    const open = () => { patchForm({ draft: draftFromSet(set),editOperation: set.operation_id,dirty: false }); setMessage(''); };
    if (form.dirty || edit) Alert.alert('Replace form?','Current form values will be cleared.',[{ text: 'Cancel',style: 'cancel' },{ text: 'Edit saved set',onPress: open }]); else open();
  }
  async function refresh() {
    if (!id) { await action(load); return; }
    await action(async () => {
      if (local?.queue.length) { await offline.retry(id); setMessage('Synchronization attempted. Any remaining changes are retained below.'); }
      else { offline.cache(await apiGet<Session>(`/sessions/${id}`),initialForm()); setMessage('Server records refreshed. Local form retained.'); }
    });
  }
  async function review() {
    if (!id) return;
    await action(async () => {
      const server = await offline.reviewServer(id);
      const count = server.exercises.reduce((sum,e) => sum+e.sets.length,0);
      const preview = server.exercises.map(e => `${e.name}: ${e.sets.map(s => `Set ${s.position}: ${describeSet(s)}`).join('; ') || 'No sets'}`).join('\n');
      Alert.alert('Server workout',`${server.status} · ${count} sets.\n${preview}\nLocal queued changes remain untouched.`,[
        { text: 'Keep local queue',style: 'cancel' },{ text: 'Discard local queue…',style: 'destructive',onPress: () => Alert.alert('Discard all queued changes?',
          'Only the server records will remain. Unsynchronized sets and corrections will be lost. This cannot be undone.',[
            { text: 'Cancel',style: 'cancel' },{ text: 'Discard queued changes',style: 'destructive',onPress: () => { void action(async () => { await offline.discardQueue(id); clearForm(); }); } },
          ]) },
      ]);
    });
  }
  const button = (label: string,onPress: () => void,disabled = false,secondary = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy }} disabled={disabled || busy}
    onPress={onPress} style={[secondary ? s.secondary : s.button,(disabled || busy) && s.disabled]}><Text style={secondary ? s.accent : s.buttonText}>{label}</Text></Pressable>;
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
    <Stack.Screen options={{ title: session?.status === 'completed' ? 'Workout summary' : 'Workout',gestureEnabled: false,
      headerLeft: () => <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.back()} style={{ padding: 12 }}><Text style={s.accent}>‹ Back</Text></Pressable> }} />
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text accessibilityRole="header" style={s.title}>{session?.template_name ?? template?.name ?? 'Your workout'}</Text>
      {busy && <ActivityIndicator color="#65dcc0" />}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={s.accent}>{message}</Text>}
      {!session && template && <><Text style={s.body}>{template.description}</Text>
        {template.exercises.map((e,i) => <View key={e.id} style={s.card}><Text style={s.heading}>{i+1}. {e.name}</Text><Text style={s.body}>Plan: {describeTargets(e)}</Text><Text style={s.body}>{e.prescription}</Text></View>)}
        {button(state.starts[template.id] ? 'Retry starting workout' : 'Start workout',() => { void start(); })}
        <Text style={s.body}>A connection is needed to start. Once started, sets and forms can be recorded offline.</Text>
      </>}
      {!session && !template && !busy && button('Retry loading',() => { void action(load); })}
      {session && local && <>
        <Text style={s.accent}>{session.status} · {totalSets} sets recorded</Text>
        <Text style={s.body}>Started {new Date(session.started_at).toLocaleString()}{session.completed_at ? `\nCompleted ${new Date(session.completed_at).toLocaleString()}` : ''}</Text>
        <View style={s.card}>
          <Text style={s.heading}>{local.queue.length ? `${local.queue.length} changes waiting to sync` : 'All recorded changes synchronized'}</Text>
          {!!local.error && <Text accessibilityRole="alert" style={s.error}>{local.error}{local.blocked ? '\nReview server records before retrying or discarding local changes.' : '\nRecorded changes are retained on this iPhone.'}</Text>}
          {button('Sync / refresh now',() => { void refresh(); },false,true)}
          {local.blocked && button('Review server records',() => { void review(); },false,true)}
        </View>
        <View style={s.row}>{session.exercises.map((e,i) => <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`Exercise ${i+1}: ${e.name}`} accessibilityState={{ selected: i === form.index }} disabled={busy} style={[s.secondary,i === form.index && { backgroundColor: '#284850' }]} onPress={() => select(i)}><Text style={s.accent}>{i+1} · {e.sets.length} sets</Text></Pressable>)}</View>
        {exercise && <View style={s.card}>
          <Text style={s.body}>Exercise {form.index+1} of {session.exercises.length}</Text><Text style={s.heading}>{exercise.name}</Text>
          <Text style={s.accent}>Plan: {describeTargets(exercise)}</Text><Text style={s.body}>Targets guide this workout. Log your actual results below.</Text><Text style={s.body}>{exercise.prescription}</Text><Text style={s.body}>Rest default: {exercise.rest_seconds} seconds</Text>
          {exercise.sets.map(set => <View key={set.operation_id} style={s.row}><Text style={[s.body,{ flex: 1 }]}>Set {set.position}: {describeSet(set)}</Text>{button(`Edit set ${set.position}`,() => openEdit(set),session.status === 'paused',true)}</View>)}
          {!exercise.sets.length && <Text style={s.body}>No sets recorded yet.</Text>}
          {(session.status === 'active' || edit) && <>
            <Text style={s.heading}>{edit ? `Correct set ${edit.position}` : `Log set ${nextPosition(exercise.sets)}`}</Text>
            {metricFields[exercise.measurement_type].map(field => <View key={field} style={{ gap: 8 }}><Text style={s.body}>{labels[field]}</Text>
              <TextInput accessibilityLabel={labels[field]} style={s.input} value={form.draft[field]} keyboardType={field === 'reps' ? 'number-pad' : 'decimal-pad'}
                editable={!busy && session.status !== 'paused'} maxLength={14} selectTextOnFocus onChangeText={value => {
                  try { patchForm({ draft: { ...form.draft,[field]: value },dirty: true }); } catch (e) { setError(`Unable to persist input: ${(e as Error).message}`); }
                }} />
            </View>)}
            {button(edit ? 'Record correction' : 'Record set',() => { void save(); },session.status === 'paused')}
            {edit && button('Cancel correction',clearForm,false,true)}
          </>}
          {session.status === 'paused' && <Text style={s.body}>Resume to record or edit sets.</Text>}
          <View style={s.row}>{button('Previous',() => select(form.index-1),form.index === 0,true)}{button('Next exercise',() => select(form.index+1),form.index === session.exercises.length-1,true)}</View>
        </View>}
        {session.status !== 'completed' && <View style={s.card}>
          <Text style={s.heading}>Rest timer</Text><Text style={s.timer}>{Math.floor(rest.remaining/60)}:{String(rest.remaining%60).padStart(2,'0')}</Text>
          <Text accessibilityLiveRegion="polite" style={s.body}>{rest.finished ? 'Rest complete' : rest.paused ? 'Timer paused' : rest.running ? 'Resting' : 'Starts after a recorded set'}</Text>
          <View style={s.row}>{button('Start rest',() => rest.start(exercise?.rest_seconds ?? 60),session.status !== 'active',true)}{button('+30 sec',rest.add,session.status !== 'active',true)}{button('Skip rest',rest.stop,false,true)}</View>
        </View>}
        {session.status !== 'completed' && <>{button(session.status === 'paused' ? 'Resume workout' : 'Pause workout',() => { void status(session.status === 'paused' ? 'active' : 'paused'); },false,true)}{button('Complete workout',complete,totalSets === 0)}</>}
        {session.status === 'completed' && <Text style={s.body}>{local.queue.length ? 'Completed on this iPhone; keep the app open while connected to finish synchronization.' : 'Workout completed and synchronized.'} Select an exercise to review or correct a set.</Text>}
        <Text style={s.body}>Forms and queued changes are stored on this iPhone. Open the app while connected to synchronize. Enable rest alerts in Reminders settings.</Text>
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
