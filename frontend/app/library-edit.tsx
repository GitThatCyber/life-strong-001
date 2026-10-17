import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { randomUUID } from 'expo-crypto';
import { apiGet, apiRequest, ApiError } from '../services/api';
import { entryDraft, entryPayload, measurementNames, moveEntry, numberInput, schedulePayload, targetKeys, targetNames, type EntryDraft, type Exercise, type Program, type SlotDraft, type Template } from '../features/library/model';
import type { Measurement } from '../features/workouts/model';
const paths = { exercise: '/exercises',template: '/workout-templates',program: '/programs' };
type Kind = keyof typeof paths;
type Saved = Exercise | Template | Program;
const EditorLocked = createContext(false);
function Button({ title,onPress,disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button,disabled && s.disabled]}><Text style={s.buttonText}>{title}</Text></Pressable>;
}
function Field({ label,value,onChange,numeric = false,multiline = false,maxLength = 2000 }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; multiline?: boolean; maxLength?: number }) {
  const locked = useContext(EditorLocked);
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!locked} style={[s.input,multiline && { minHeight: 80 }]} value={value} onChangeText={onChange} keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} maxLength={maxLength} /></View>;
}
export default function LibraryEditor() {
  const params = useLocalSearchParams<{ kind?: string; id?: string }>(),navigation = useNavigation();
  const kind: Kind = params.kind === 'exercise' || params.kind === 'program' ? params.kind : 'template';
  const initialId = typeof params.id === 'string' ? params.id : undefined;
  const [saved,setSaved] = useState<Saved>();
  const [name,setName] = useState(''),[description,setDescription] = useState(''),[equipment,setEquipment] = useState(''),[focus,setFocus] = useState('');
  const [type,setType] = useState<Measurement>('reps'),[weeks,setWeeks] = useState('1');
  const [entries,setEntries] = useState<EntryDraft[]>([]),[slots,setSlots] = useState<SlotDraft[]>([]);
  const [exercises,setExercises] = useState<Exercise[]>([]),[templates,setTemplates] = useState<Template[]>([]);
  const [dirty,setDirty] = useState(false),[busy,setBusy] = useState(false),[ready,setReady] = useState(false),[error,setError] = useState(''),[message,setMessage] = useState('');
  const [chooser,setChooser] = useState(false),[search,setSearch] = useState('');
  const [pending,setPending] = useState<{ path: string; method: string; body: unknown }>();
  const guard = useRef(false);
  const id = saved?.id ?? initialId;
  usePreventRemove(dirty || busy || !!pending,({ data }) => {
    if (guard.current) { Alert.alert('Request in progress','Wait for the request to finish.');return; }
    Alert.alert('Leave this editor?',pending ? 'The last save has an unknown result. Retry it before leaving to confirm what was saved. Unsaved editor values are not retained after leaving.' : 'Your unsaved changes will be lost.',[
      { text: 'Keep editing',style: 'cancel' },{ text: 'Leave',style: 'destructive',onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  function changed(work: () => void) { work();setDirty(true);setMessage(''); }
  function populate(item: Saved) {
    setSaved(item);setName(item.name);
    if ('measurement_type' in item) { setType(item.measurement_type);setEquipment(item.equipment);setFocus(item.muscle_focus); }
    if ('description' in item) setDescription(item.description);
    if ('exercises' in item) setEntries(item.exercises.map(e => entryDraft(e,randomUUID())));
    if ('schedule' in item) { setWeeks(String(item.weeks));setSlots(item.schedule.map(slot => ({ ...slot,key: randomUUID(),week: String(slot.week),day: String(slot.day) }))); }
    setDirty(false);setPending(undefined);
  }
  const load = useCallback(async (resourceId?: string) => {
    if (guard.current) return;guard.current = true;setBusy(true);setError('');
    try {
      const [es,ts,item] = await Promise.all([
        kind === 'template' ? apiGet<Exercise[]>('/exercises') : Promise.resolve([]),
        kind === 'program' ? apiGet<Template[]>('/workout-templates') : Promise.resolve([]),
        resourceId ? apiGet<Saved>(`${paths[kind]}/${resourceId}`) : Promise.resolve(undefined),
      ]);
      setExercises(es);setTemplates(ts);
      if (item) populate(item);
      else { setSaved(undefined);setName('');setDescription('');setEquipment('');setFocus('');setType('reps');setWeeks('1');setEntries([]);setSlots([]);setDirty(false); }
      setReady(true);
    } catch (e) { setError((e as Error).message); } finally { guard.current = false;setBusy(false); }
  },[kind]);
  useEffect(() => { void load(initialId); },[load,initialId]);
  async function send(request: { path: string; method: string; body: unknown }) {
    if (guard.current) return;guard.current = true;setBusy(true);setError('');
    try {
      const result = await apiRequest<Saved>(request.path,request.method,request.body);
      populate(result);setMessage('Saved. Existing workout history is unchanged.');
    } catch (e) {
      // Known rejection did not commit; transport errors retain the exact request for replay.
      if (e instanceof ApiError && e.status>=400 && e.status<500 && e.status!==408 && e.status!==429) setPending(undefined);
      setError((e as Error).message);
    } finally { guard.current = false;setBusy(false); }
  }
  function save() {
    if (guard.current || pending || saved?.archived) return;
    try {
      if (!name.trim()) throw new Error('Enter a name.');
      let body: Record<string,unknown> = { name: name.trim(),operation_id: randomUUID(),...(saved ? { expected_revision: saved.revision } : {}) };
      if (kind === 'exercise') body = { ...body,equipment: equipment.trim(),muscle_focus: focus.trim(),measurement_type: type };
      if (kind === 'template') {
        if (!entries.length) throw new Error('Add at least one exercise.');
        body = { ...body,description: description.trim(),exercises: entries.map(entryPayload) };
      }
      if (kind === 'program') { const count = numberInput(weeks,'Program weeks',1,104,true);body = { ...body,description: description.trim(),weeks: count,schedule: schedulePayload(slots,count) }; }
      const request = { path: `${paths[kind]}${id ? `/${id}` : ''}`,method: id ? 'PUT' : 'POST',body };
      setPending(request);void send(request);
    } catch (e) { setError((e as Error).message); }
  }
  function reload() {
    const action = () => { setMessage('');void load(id); };
    if (dirty || pending) Alert.alert('Discard editor changes?', 'Reloading replaces this form with the latest server values. Retry an uncertain save first.',[{ text: 'Keep editing',style: 'cancel' },{ text: 'Reload',style: 'destructive',onPress: action }]);else action();
  }
  function archive() {
    Alert.alert(`Archive ${name}?`,'This hides it from the library. Saved workouts remain. Items used by library workouts or programs must be removed from those plans first. Archiving a program deactivates it.',[
      { text: 'Cancel',style: 'cancel' },{ text: 'Archive',style: 'destructive',onPress: () => {
        if (guard.current || !saved) return;guard.current = true;setBusy(true);setError('');
        void apiRequest(`${paths[kind]}/${saved.id}`,'DELETE',{ expected_revision: saved.revision })
          .then(() => { setSaved({ ...saved,archived: true });setMessage('Archived. Return to the library.'); })
          .catch(e => setError(e.message)).finally(() => { guard.current = false;setBusy(false); });
      } },
    ]);
  }
  const locked = busy || !!pending || !!saved?.archived;
  function updateEntry(key: string,change: Partial<EntryDraft>) { changed(() => setEntries(items => items.map(e => e.key===key ? { ...e,...change } : e))); }
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
    <Stack.Screen options={{ title: `${id ? 'Edit' : 'Create'} ${kind === 'template' ? 'workout' : kind}`,gestureEnabled: false }} />
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.title}>{kind === 'template' ? 'Workout builder' : kind === 'exercise' ? 'Exercise editor' : 'Program builder'}</Text>
      <Text style={s.body}>Editing needs a connection. Unsaved forms stay here during failed requests, but are lost if you leave or close the app.</Text>
      {busy && <ActivityIndicator color="#65dcc0" />}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={s.accent}>{message}</Text>}
      {!!pending && !busy && <><Text style={s.body}>Save not confirmed. Retry the same request before making further edits.</Text><Button title="Retry save" onPress={() => { void send(pending); }} /></>}
      <Button title={ready ? 'Reload from server' : 'Retry loading'} onPress={reload} disabled={busy || !!pending} />
      {ready && <>
        <EditorLocked.Provider value={locked}><View pointerEvents={locked ? 'none' : 'auto'} accessibilityElementsHidden={locked} style={locked && s.disabled}>
          <Field label="Name" value={name} maxLength={160} onChange={v => changed(() => setName(v))} />
          {kind==='exercise' ? <>
            <Field label="Equipment" value={equipment} onChange={v => changed(() => setEquipment(v))} />
            <Field label="Muscle focus" value={focus} onChange={v => changed(() => setFocus(v))} />
            <Text style={s.label}>Measurement type</Text>
            {(Object.keys(measurementNames) as Measurement[]).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: type===value }} style={[s.choice,type===value && s.selected]} onPress={() => changed(() => setType(value))}><Text style={s.label}>{type===value ? '● ' : '○ '}{measurementNames[value]}</Text></Pressable>)}
            <Text style={s.body}>A type change affects future workouts. Remove incompatible targets from linked workouts first. Existing sessions keep their original type.</Text>
          </> : <Field label="Description" value={description} multiline onChange={v => changed(() => setDescription(v))} />}
          {kind==='template' && <>
            <Text style={s.body}>Targets are optional and apply per set. Blank targets mean unspecified. Recording a workout still requires entering actual results.</Text>
            {entries.map((entry,index) => <View key={entry.key} style={s.card}>
              <Text accessibilityRole="header" style={s.heading}>{index+1}. {entry.name}</Text><Text style={s.body}>{measurementNames[entry.measurement_type]}</Text>
              <View style={s.row}><Button title={`Move ${index+1} up`} disabled={index===0} onPress={() => changed(() => setEntries(v => moveEntry(v,index,-1)))} /><Button title={`Move ${index+1} down`} disabled={index===entries.length-1} onPress={() => changed(() => setEntries(v => moveEntry(v,index,1)))} /></View>
              {targetKeys(entry.measurement_type).map(key => <Field key={key} label={targetNames[key]} value={entry[key]} numeric onChange={v => updateEntry(entry.key,{ [key]: v })} />)}
              <Field label="Rest between sets (seconds)" value={entry.rest_seconds} numeric onChange={v => updateEntry(entry.key,{ rest_seconds: v })} />
              <Field label="Instructions" value={entry.prescription} multiline onChange={v => updateEntry(entry.key,{ prescription: v })} />
              <Button title={`Remove exercise ${index+1}`} onPress={() => changed(() => setEntries(v => v.filter(e => e.key!==entry.key)))} />
            </View>)}
            <Button title="Add exercise" disabled={entries.length>=100} onPress={() => { setChooser(v => !v);setSearch(''); }} />
            {!exercises.length && <Text style={s.body}>Create an exercise in the library first.</Text>}
          </>}
          {kind==='program' && <>
            <Field label="Program length (weeks)" value={weeks} numeric onChange={v => changed(() => setWeeks(v))} />
            <Text style={s.body}>Day 1 is the program start date, day 2 the following day, through day 7. Each week/day supports one workout. Changes also update the active program schedule and adherence; saved sessions remain unchanged.</Text>
            {slots.map((slot,index) => <View key={slot.key} style={s.card}>
              <Text style={s.heading}>{slot.template_name}</Text>
              <Field label={`Slot ${index+1} week`} value={slot.week} numeric onChange={v => changed(() => setSlots(items => items.map(x => x.key===slot.key ? { ...x,week: v } : x)))} />
              <Field label={`Slot ${index+1} day`} value={slot.day} numeric onChange={v => changed(() => setSlots(items => items.map(x => x.key===slot.key ? { ...x,day: v } : x)))} />
              <Button title={`Remove slot ${index+1}`} onPress={() => changed(() => setSlots(v => v.filter(x => x.key!==slot.key)))} />
            </View>)}
            <Button title="Assign workout" disabled={slots.length>=728} onPress={() => { setChooser(v => !v);setSearch(''); }} />
            {!templates.length && <Text style={s.body}>Create a workout in the library first.</Text>}
          </>}
          {chooser && kind!=='exercise' && <View style={s.card}>
            <Field label={kind==='template' ? 'Search exercises' : 'Search workouts'} value={search} onChange={setSearch} />
            {(kind==='template' ? exercises : templates).filter(item => item.name.toLowerCase().includes(search.toLowerCase())).map(item => <Button key={item.id} title={`Add ${item.name}`} onPress={() => {
              changed(() => {
                if (kind==='template') { const e = item as Exercise;setEntries(v => [...v,entryDraft({ exercise_id: e.id,name: e.name,measurement_type: e.measurement_type,prescription: '',rest_seconds: 60 },randomUUID())]); }
                else setSlots(v => [...v,{ key: randomUUID(),template_id: item.id,template_name: item.name,week: '1',day: '1' }]);
              });setChooser(false);
            }} />)}
            <Button title="Close choices" onPress={() => setChooser(false)} />
          </View>}
        </View></EditorLocked.Provider>
        <Button title={busy ? 'Saving…' : 'Save changes'} onPress={save} disabled={locked || !dirty} />
        {!!saved && <Button title="Archive" onPress={archive} disabled={locked || dirty} />}
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  screen: { flex: 1,backgroundColor: '#10232a' },content: { padding: 20,gap: 16,paddingBottom: 60 },title: { color: '#fff',fontSize: 28,fontWeight: '700' },heading: { color: '#fff',fontSize: 20,fontWeight: '600' },body: { color: '#b2c4c9',fontSize: 16,lineHeight: 24 },label: { color: '#fff',fontSize: 16 },accent: { color: '#65dcc0',fontSize: 16 },error: { color: '#ffb4ab',fontSize: 16 },field: { gap: 8,marginVertical: 8 },input: { color: '#fff',borderColor: '#71949e',borderWidth: 1,borderRadius: 8,padding: 12,minHeight: 48,fontSize: 17 },card: { backgroundColor: '#19353e',padding: 16,borderRadius: 12,gap: 10,marginVertical: 10 },row: { flexDirection: 'row',flexWrap: 'wrap',gap: 8 },button: { minHeight: 48,backgroundColor: '#65dcc0',borderRadius: 8,padding: 12,justifyContent: 'center',marginVertical: 4 },buttonText: { color: '#10232a',fontSize: 16,fontWeight: '600' },disabled: { opacity: 0.5 },choice: { padding: 14,minHeight: 48,borderWidth: 1,borderColor: '#71949e',borderRadius: 8,marginVertical: 4 },selected: { backgroundColor: '#284850',borderColor: '#65dcc0' },
});
