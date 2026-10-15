import Dexie from 'dexie';
import type { Table } from 'dexie';
import type {
    Exercise,
    Workout,
    WorkoutExercise,
    SetEntry,
    Settings,
    ConflictLog,
    WorkoutTemplate
} from '../types';
import { normalizeSet, normalizeWorkout } from '../data/normalize';
import { seedDefaults } from '../data/seed';
import { summarizeSets } from '../domain/workout';

/**
 * Dexie schema owner.
 *
 * Schema versions are append-only: never edit a released `version(n)` block, add `version(n+1)`.
 * Derived/denormalized fields are maintained by the data layer (see src/data) and repaired by
 * `normalize*` helpers so DB upgrades and sync merges share one code path.
 */
export class AppDatabase extends Dexie {
    settings!: Table<Settings>;
    exercises!: Table<Exercise>;
    workouts!: Table<Workout>;
    workoutExercises!: Table<WorkoutExercise>;
    sets!: Table<SetEntry>;
    conflictLog!: Table<ConflictLog>;
    workoutTemplates!: Table<WorkoutTemplate>;

    constructor() {
        super('StrengthJournalDB');

        // Schema definition
        // Note: We use 'uuid' for relationships to facilitate sync,
        // but keep auto-increment 'id' for local indexing speed if needed,
        // though Dexie works fine with uuid as primary too.
        // Prompt asked for "indices Dexie by updatedAt, workout startedAt, exerciseId"
        this.version(1).stores({
            settings: '++id',
            exercises: '++id, &uuid, name, muscleGroup, updatedAt, deletedAt',
            workouts: '++id, &uuid, startedAt, endedAt, updatedAt, deletedAt',
            workoutExercises: '++id, &uuid, workoutId, exerciseId, updatedAt, deletedAt',
            sets: '++id, &uuid, workoutExerciseId, updatedAt, deletedAt',
            conflictLog: '++id, &uuid, entityType, entityId',
            workoutTemplates: '++id, &uuid, name, updatedAt, deletedAt'
        });

        this.version(2).stores({
            settings: '++id',
            exercises: '++id, &uuid, name, muscleGroup, updatedAt, deletedAt',
            workouts: '++id, &uuid, startedAt, endedAt, updatedAt, deletedAt',
            workoutExercises: '++id, &uuid, workoutId, exerciseId, updatedAt, deletedAt',
            sets: '++id, &uuid, workoutExerciseId, updatedAt, deletedAt',
            conflictLog: '++id, &uuid, entityType, entityId',
            workoutTemplates: '++id, &uuid, name, isCustom, updatedAt, deletedAt'
        }).upgrade(async (tx) => {
            await tx.table('workoutTemplates').toCollection().modify((t: WorkoutTemplate) => {
                if (typeof t.isCustom !== 'boolean') {
                    t.isCustom = false;
                }
            });
        });

        this.version(3).stores({
            settings: '++id',
            exercises: '++id, &uuid, name, muscleGroup, updatedAt, deletedAt',
            workouts: '++id, &uuid, startedAt, endedAt, workoutDay, updatedAt, deletedAt',
            workoutExercises: '++id, &uuid, workoutId, exerciseId, updatedAt, deletedAt',
            sets: '++id, &uuid, workoutExerciseId, updatedAt, deletedAt',
            conflictLog: '++id, &uuid, entityType, entityId',
            workoutTemplates: '++id, &uuid, name, isCustom, updatedAt, deletedAt'
        }).upgrade(async (tx) => {
            await tx.table('workouts').toCollection().modify((w: Workout) => {
                if (!w.workoutDay) {
                    const ts = typeof w.startedAt === 'number' ? w.startedAt : Date.now();
                    const d = new Date(ts);
                    w.workoutDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }
            });
        });

        this.version(4).stores({
            settings: '++id',
            exercises: '++id, &uuid, name, muscleGroup, updatedAt, deletedAt',
            workouts: '++id, &uuid, startedAt, endedAt, workoutDay, updatedAt, deletedAt',
            workoutExercises: '++id, &uuid, workoutId, exerciseId, updatedAt, deletedAt',
            sets: '++id, &uuid, workoutExerciseId, updatedAt, deletedAt',
            conflictLog: '++id, &uuid, entityType, entityId',
            workoutTemplates: '++id, &uuid, name, isCustom, updatedAt, deletedAt'
        }).upgrade(async (tx) => {
            await tx.table('exercises').toCollection().modify((e: Exercise) => {
                if (!Array.isArray(e.variations)) {
                    e.variations = [];
                }
            });

            await tx.table('sets').toCollection().modify((s: SetEntry) => {
                if (typeof s.variation === 'undefined') {
                    s.variation = undefined;
                }
            });
        });

        // v5 — indexability + derived caches.
        // IndexedDB cannot index undefined/null, so "the active workout" used to be a full
        // table scan. `status` makes that an index lookup; [status+startedAt] and
        // [status+workoutDay] give range + ordering without post-filtering; set-level
        // denormalized keys make "last performance of an exercise" an index range.
        this.version(5).stores({
            settings: '++id',
            exercises: '++id, &uuid, name, muscleGroup, updatedAt, deletedAt',
            workouts: '++id, &uuid, status, startedAt, endedAt, workoutDay, [status+startedAt], [status+workoutDay], updatedAt, deletedAt',
            workoutExercises: '++id, &uuid, workoutId, exerciseId, [workoutId+order], updatedAt, deletedAt',
            sets: '++id, &uuid, workoutExerciseId, exerciseId, workoutId, [exerciseId+performedAt], updatedAt, deletedAt',
            conflictLog: '++id, &uuid, entityType, entityId',
            workoutTemplates: '++id, &uuid, name, isCustom, updatedAt, deletedAt'
        }).upgrade(async (tx) => {
            const workoutTable = tx.table<Workout, number>('workouts');
            const workoutExerciseTable = tx.table<WorkoutExercise, number>('workoutExercises');
            const setTable = tx.table<SetEntry, number>('sets');

            const workouts = await workoutTable.toArray();
            const workoutByUuid = new Map(workouts.map(workout => [workout.uuid, workout]));
            const workoutExercises = await workoutExerciseTable.toArray();
            const workoutExerciseByUuid = new Map(workoutExercises.map(row => [row.uuid, row]));

            await workoutTable.toCollection().modify((workout) => {
                const normalized = normalizeWorkout(workout);
                workout.startedAt = normalized.startedAt;
                workout.workoutDay = normalized.workoutDay;
                workout.status = normalized.status;
            });

            await setTable.toCollection().modify((set) => {
                const workoutExercise = workoutExerciseByUuid.get(set.workoutExerciseId);
                const normalized = normalizeSet(set, {
                    workoutExercise,
                    workoutStartedAt: workoutExercise
                        ? workoutByUuid.get(workoutExercise.workoutId)?.startedAt
                        : undefined,
                });
                set.exerciseId = normalized.exerciseId;
                set.workoutId = normalized.workoutId;
                set.performedAt = normalized.performedAt;
            });

            const setsByWorkout = new Map<string, SetEntry[]>();
            for (const set of await setTable.toArray()) {
                if (set.deletedAt != null || !set.workoutId) continue;
                const list = setsByWorkout.get(set.workoutId);
                if (list) list.push(set);
                else setsByWorkout.set(set.workoutId, [set]);
            }

            const exerciseCountByWorkout = new Map<string, number>();
            for (const workoutExercise of workoutExercises) {
                if (workoutExercise.deletedAt != null) continue;
                exerciseCountByWorkout.set(
                    workoutExercise.workoutId,
                    (exerciseCountByWorkout.get(workoutExercise.workoutId) ?? 0) + 1,
                );
            }

            await workoutTable.toCollection().modify((workout) => {
                const { setsCount, totalTonnage } = summarizeSets(setsByWorkout.get(workout.uuid) ?? []);
                workout.setsCount = setsCount;
                workout.totalTonnage = totalTonnage;
                workout.exerciseCount = exerciseCountByWorkout.get(workout.uuid) ?? 0;
            });
        });

        this.on('populate', () => seedDefaults(this));
    }
}

export const db = new AppDatabase();
