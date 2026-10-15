import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '../common/Button';
import { Calendar, CheckCircle, Minus, Play, Plus, Trash2 } from 'lucide-react';
import { ActiveWorkoutView } from './ActiveWorkoutView';
import { WorkoutDayPickerModal } from './WorkoutDayPickerModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { toDayString, workoutDayToDate } from '../../utils/dateUtils';
import { useSettings } from '../../hooks/useSettings';
import { displayToKg, kgToDisplay, massUnitLabel } from '../../utils/mass';
import { WorkoutRepository } from '../../data/repositories/WorkoutRepository';
import type { Workout } from '../../types';

/**
 * Post-workout screen. Mounted per workout (`key`) so the notes field initialises from the
 * stored value instead of being synchronised during render.
 */
const WorkoutFinishedPanel: React.FC<{ workout: Workout; onDone: () => void }> = ({ workout, onDone }) => {
    const [notes, setNotes] = useState(workout.notes || '');
    const [isDiscardOpen, setIsDiscardOpen] = useState(false);

    const handleSaveFinished = async () => {
        await WorkoutRepository.updateMetadata(workout.uuid, { notes: notes.trim() || undefined });
        onDone();
    };

    const handleDiscardFinished = async () => {
        await WorkoutRepository.softDelete(workout.uuid);
        setIsDiscardOpen(false);
        onDone();
    };

    return (
        <div className="flex flex-col items-center flex-1 h-full p-6 space-y-6 overflow-y-auto pb-24">
            <div className="bg-bg-tertiary p-6 rounded-full mt-4">
                <CheckCircle size={48} className="text-success" />
            </div>
            <div className="text-center">
                <h1 className="text-2xl font-bold mb-1 text-text-primary">Workout Finished!</h1>
                <p className="text-text-secondary text-sm">Great job! Add any final details.</p>
            </div>

            <div className="w-full max-w-xs flex flex-col gap-4 text-left mt-2">
                <div>
                    <label className="block text-xs font-bold text-text-tertiary mb-1.5 uppercase tracking-wide">Workout Notes</label>
                    <textarea
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl bg-bg-secondary border border-border/60 focus:border-accent outline-none text-text-primary resize-none"
                        placeholder="How did you feel today?"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs pt-4">
                <Button size="lg" onClick={handleSaveFinished} fullWidth className="shadow-lg font-bold">
                    Save to History
                </Button>
                <Button size="md" variant="danger" onClick={() => setIsDiscardOpen(true)} fullWidth className="gap-2 mt-4 bg-transparent text-danger hover:bg-danger/10 shadow-none border border-danger/20">
                    <Trash2 size={18} /> Discard Workout
                </Button>
            </div>

            <ConfirmDialog
                isOpen={isDiscardOpen}
                title="Discard this workout?"
                description="It will be removed on this device and after the next sync."
                confirmLabel="Discard"
                variant="danger"
                onConfirm={handleDiscardFinished}
                onClose={() => setIsDiscardOpen(false)}
            />
        </div>
    );
};

export const WorkoutPage: React.FC = () => {
    const settings = useSettings();
    const [finishedWorkoutUuid, setFinishedWorkoutUuid] = useState<string | null>(null);
    const [selectedWorkoutDay, setSelectedWorkoutDay] = useState<string>(() => toDayString(new Date()));
    const [isDayPickerOpen, setIsDayPickerOpen] = useState(false);
    const [draftWorkoutDay, setDraftWorkoutDay] = useState<string>(selectedWorkoutDay);
    /**
     * Body-weight field: `null` means "follow the prefill".
     * The previous implementation pushed the prefill into state during render with a
     * last-value guard; deriving the value keeps user edits while still re-converting on a
     * unit change.
     */
    const [bodyWeightOverride, setBodyWeightOverride] = useState<string | null>(null);

    // Last body weight stored in kg — index range scan, newest workouts first.
    const lastBodyWeightKg = useLiveQuery(() => WorkoutRepository.lastBodyWeightKg(), []);

    // Active workout: index lookup on `status` (undefined = still loading, null = none).
    const activeWorkout = useLiveQuery(async () => (await WorkoutRepository.getActive()) ?? null, []);

    const finishedWorkout = useLiveQuery(
        async () => (finishedWorkoutUuid ? (await WorkoutRepository.getByUuid(finishedWorkoutUuid)) ?? null : null),
        [finishedWorkoutUuid],
    );

    const workoutsForSelectedDay = useLiveQuery(
        () => WorkoutRepository.listFinishedByDay(selectedWorkoutDay),
        [selectedWorkoutDay],
    );

    const prefill = lastBodyWeightKg != null ? String(kgToDisplay(lastBodyWeightKg, settings.massUnit)) : '';
    const startBodyWeight = bodyWeightOverride ?? prefill;

    const handleStartWorkout = async () => {
        try {
            setFinishedWorkoutUuid(null);
            const now = Date.now();
            await WorkoutRepository.start({
                workoutDay: selectedWorkoutDay || toDayString(new Date(now)),
                // Stored in kg
                bodyWeightKg: startBodyWeight
                    ? displayToKg(parseFloat(startBodyWeight), settings.massUnit)
                    : undefined,
            });
            setBodyWeightOverride(null);
        } catch (e) {
            console.error("Failed to start workout", e);
        }
    };

    if (activeWorkout === undefined) {
        return <div className="p-4 text-center mt-10">Loading...</div>;
    }

    if (activeWorkout) {
        return (
            <ActiveWorkoutView
                workout={activeWorkout}
                onFinished={(uuid) => {
                    setSelectedWorkoutDay(activeWorkout.workoutDay);
                    setFinishedWorkoutUuid(uuid);
                }}
                onDiscarded={() => setFinishedWorkoutUuid(null)}
            />
        );
    }

    if (finishedWorkoutUuid) {
        return finishedWorkout
            ? <WorkoutFinishedPanel key={finishedWorkout.uuid} workout={finishedWorkout} onDone={() => setFinishedWorkoutUuid(null)} />
            : <div className="p-4 text-center mt-10">Loading...</div>;
    }

    const stepBodyWeight = (delta: number) => {
        const current = parseFloat(startBodyWeight);
        if (Number.isNaN(current)) return;
        setBodyWeightOverride(String(Math.max(0, +(current + delta).toFixed(1))));
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
            <div className="bg-bg-tertiary p-8 rounded-full">
                <Play size={48} className="text-accent ml-2" />
            </div>
            <div>
                {workoutsForSelectedDay && workoutsForSelectedDay.length > 0 && (
                    <div className="w-full max-w-md pt-2">
                        <p className="text-text-secondary">You have already logged workouts for this day.</p>
                    </div>
                )}
                <p className="text-text-secondary">Start a new workout to log your sets.</p>
            </div>

            <button
                onClick={() => {
                    setDraftWorkoutDay(selectedWorkoutDay);
                    setIsDayPickerOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-secondary border border-border hover:bg-bg-tertiary transition-colors"
            >
                <Calendar size={18} className="text-text-secondary" />
                <span className="font-medium">{workoutDayToDate(selectedWorkoutDay).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </button>

            {/* Body weight input before starting */}
            <div className="w-full max-w-xs">
                <label className="block text-xs font-bold text-text-tertiary mb-1.5 uppercase tracking-wide text-left">Body Weight ({massUnitLabel(settings.massUnit).toLowerCase()})</label>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => stepBodyWeight(-0.5)}
                        disabled={!startBodyWeight}
                        className="h-12 w-12 shrink-0 rounded-xl bg-bg-secondary border border-border/60 flex items-center justify-center text-text-primary hover:bg-bg-tertiary active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Minus size={20} />
                    </button>
                    <input
                        type="number"
                        step="0.1"
                        min="0"
                        className="flex-1 px-4 py-3 rounded-xl bg-bg-secondary border border-border/60 focus:border-accent outline-none text-text-primary font-medium text-center text-lg"
                        placeholder="e.g. 75.5"
                        value={startBodyWeight}
                        onChange={e => setBodyWeightOverride(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => stepBodyWeight(0.5)}
                        disabled={!startBodyWeight}
                        className="h-12 w-12 shrink-0 rounded-xl bg-bg-secondary border border-border/60 flex items-center justify-center text-text-primary hover:bg-bg-tertiary active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            <Button size="lg" onClick={handleStartWorkout} fullWidth className="max-w-xs shadow-lg shadow-accent/20">
                Start
            </Button>
            <WorkoutDayPickerModal
                isOpen={isDayPickerOpen}
                value={draftWorkoutDay}
                onClose={() => setIsDayPickerOpen(false)}
                onChange={setDraftWorkoutDay}
                onToday={() => setDraftWorkoutDay(toDayString(new Date()))}
                onApply={() => {
                    setSelectedWorkoutDay(draftWorkoutDay);
                    setIsDayPickerOpen(false);
                }}
            />
        </div>
    );
};
