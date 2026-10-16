import { applySet, type Draft, type Session, type SetValues, type WorkoutSet } from '../workouts/model';
export type TimerState = { deadline: number | null; paused: number | null; finished: boolean };
export const emptyTimer = (): TimerState => ({ deadline: null,paused: null,finished: false });
export type FormState = { index: number; draft: Draft; editOperation?: string; dirty: boolean };
export type Write = { id: string; kind: 'set' | 'correction' | 'status'; exerciseId?: string; operationId?: string; values?: SetValues; status?: Session['status']; request?: { path: string; method: string; body: unknown } };
export type LocalWorkout = { server: Session; form: FormState; timer: TimerState; queue: Write[]; error?: string; blocked?: boolean };
export type OfflineState = { version: 1; workouts: Record<string,LocalWorkout>; starts: Record<string,string> };
export type Transport = <T>(path: string,method?: string,body?: unknown) => Promise<T>;
export function projected(workout: LocalWorkout): Session {
  return workout.queue.reduce((session,write) => {
    if (write.kind === 'status') return { ...session,status: write.status!,completed_at: write.status === 'completed' ? session.completed_at : null };
    const e = session.exercises.find(e => e.id === write.exerciseId);
    if (!e) throw new Error('Queued exercise is missing from its workout');
    const original = e.sets.find(s => s.operation_id === write.operationId);
    const set: WorkoutSet = { ...(original ?? { id: write.operationId!,operation_id: write.operationId!,updated_at: '' }),...write.values! };
    return applySet(session,e.id,set);
  },workout.server);
}
export class OfflineEngine {
  private state: OfflineState;
  private listeners = new Set<() => void>();
  private flights = new Map<string,Promise<void>>();
  constructor(private storage: { read: () => string | null; write: (value: string) => void },private send: Transport) {
    const raw = storage.read();
    this.state = raw ? JSON.parse(raw) : { version: 1,workouts: {},starts: {} };
    if (this.state.version !== 1 || !this.state.workouts || !this.state.starts) throw new Error('Unsupported local workout data; do not clear storage without recovering your drafts.');
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private commit(next: OfflineState) {
    this.storage.write(JSON.stringify(next)); // Commit before displaying success or sending network writes.
    this.state = next;
    this.listeners.forEach(listener => listener());
  }
  update(id: string,change: (workout: LocalWorkout) => LocalWorkout) {
    const existing = this.state.workouts[id];
    if (!existing) throw new Error('Workout is not cached yet');
    this.commit({ ...this.state,workouts: { ...this.state.workouts,[id]: change(existing) } });
  }
  cache(session: Session,form: FormState) {
    const current = this.state.workouts[session.id];
    if (current?.queue.length) return; // Never discard pending writes during a refresh.
    this.commit({ ...this.state,workouts: { ...this.state.workouts,[session.id]: current ? { ...current,server: session } : { server: session,form,timer: emptyTimer(),queue: [] } } });
  }
  startOperation(templateId: string,makeId: () => string) {
    const existing = this.state.starts[templateId];
    if (existing) return existing;
    const id = makeId();
    this.commit({ ...this.state,starts: { ...this.state.starts,[templateId]: id } }); return id;
  }
  finishStart(templateId: string) {
    const starts = { ...this.state.starts }; delete starts[templateId]; this.commit({ ...this.state,starts });
  }
  enqueue(id: string,write: Write,form?: FormState,timer?: TimerState) {
    this.update(id,w => ({ ...w,queue: [...w.queue,write],...(form ? { form } : {}),...(timer ? { timer } : {}) }));
  }
  sync(id: string): Promise<void> {
    const existing = this.flights.get(id); if (existing) return existing;
    if (!this.state.workouts[id]?.queue.length || this.state.workouts[id]?.blocked) return Promise.resolve();
    const flight = this.flush(id).finally(() => this.flights.delete(id));
    this.flights.set(id,flight); return flight;
  }
  async syncAll() { await Promise.all(Object.keys(this.state.workouts).map(id => this.sync(id))); }
  private async flush(id: string) {
    if (this.state.workouts[id]?.blocked) return;
    while (this.state.workouts[id]?.queue.length) {
      try {
        let w = this.state.workouts[id]!, head = w.queue[0]!;
        if (!head.request) {
          let request: Write['request'];
          if (head.kind === 'set') request = { path: `/sessions/${id}/exercises/${head.exerciseId}/sets`,method: 'POST',body: { ...head.values,operation_id: head.operationId } };
          else if (head.kind === 'status') request = { path: `/sessions/${id}`,method: 'PATCH',body: { status: head.status } };
          else {
            const set = w.server.exercises.find(e => e.id === head.exerciseId)?.sets.find(s => s.operation_id === head.operationId);
            if (!set) throw new Error('The original set must synchronize before its correction');
            request = { path: `/sessions/${id}/sets/${set.id}`,method: 'PUT',body: { ...head.values,operation_id: head.id,expected_updated_at: set.updated_at,...(set.revision === undefined ? {} : { expected_revision: set.revision }) } };
          }
          // Store the exact request before transmission, including correction version preconditions.
          this.update(id,latest => ({ ...latest,queue: latest.queue.map(q => q.id === head.id ? { ...q,request } : q) }));
          w = this.state.workouts[id]!; head = w.queue[0]!;
        }
        const request = head.request!;
        const result = await this.send<Session | WorkoutSet>(request.path,request.method,request.body);
        this.update(id,latest => ({ ...latest,
          server: head.kind === 'status' ? result as Session : applySet(latest.server,head.exerciseId!,result as WorkoutSet),
          queue: latest.queue.filter(q => q.id !== head.id),error: undefined,blocked: false,
        }));
      } catch (error) {
        const status = (error as { status?: number }).status;
        this.update(id,w => ({ ...w,error: error instanceof Error ? error.message : 'Synchronization failed',blocked: !!status && status !== 401 && status !== 429 && status >= 400 && status < 500 }));
        return;
      }
    }
  }
  retry(id: string) { this.update(id,w => ({ ...w,blocked: false,error: undefined })); return this.sync(id); }
  clearSynced() {
    if (this.flights.size || Object.keys(this.state.starts).length || Object.values(this.state.workouts).some(w => w.queue.length)) throw new Error('Synchronize all pending changes and recover unconfirmed starts before clearing local data.');
    this.commit({ version: 1,workouts: {},starts: {} });
  }
  async reviewServer(id: string) { return this.send<Session>(`/sessions/${id}`); }
  async discardQueue(id: string) {
    if (this.flights.has(id)) throw new Error('Wait for synchronization to finish before replacing local data');
    const server = await this.reviewServer(id);
    if (this.flights.has(id)) throw new Error('Synchronization started; try again when it finishes');
    this.update(id,w => ({ ...w,server,queue: [],error: undefined,blocked: false,timer: emptyTimer() }));
  }
}
