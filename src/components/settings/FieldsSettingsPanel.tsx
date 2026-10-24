import React, { useState } from 'react';
import { Check, Edit2, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ThemedDropdown } from '../ThemedDropdown';
import type { VenueField } from '../../types/baseball';

interface FieldsSettingsPanelProps {
  isActive: boolean;
  onStatusMessage: (message: { text: string; isError: boolean }) => void;
}

const createFieldId = () => `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const FieldsSettingsPanel: React.FC<FieldsSettingsPanelProps> = ({ isActive, onStatusMessage }) => {
  const { settings, updateSettings } = useGame();
  const venues = settings.venues || [];
  const fields = settings.fields || [];
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldVenue, setNewFieldVenue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingVenue, setEditingVenue] = useState('');

  if (!isActive) return null;

  const duplicateExists = (name: string, venue: string, exceptId?: string) =>
    fields.some((field) => field.id !== exceptId &&
      field.venue.trim().toLocaleLowerCase() === venue.trim().toLocaleLowerCase() &&
      field.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());

  const addField = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newFieldName.trim();
    if (!name || !newFieldVenue || !venues.includes(newFieldVenue)) {
      onStatusMessage({ text: 'Enter a field name and select a saved venue.', isError: true });
      return;
    }
    if (duplicateExists(name, newFieldVenue)) {
      onStatusMessage({ text: 'That field already exists for this venue.', isError: true });
      return;
    }
    const field: VenueField = { id: createFieldId(), name, venue: newFieldVenue };
    updateSettings({ fields: [...fields, field] });
    setNewFieldName('');
    onStatusMessage({ text: `Field "${name}" added to ${newFieldVenue}.`, isError: false });
  };

  const saveEdit = (field: VenueField) => {
    const name = editingName.trim();
    if (!name || !venues.includes(editingVenue)) {
      onStatusMessage({ text: 'Enter a field name and select a saved venue.', isError: true });
      return;
    }
    if (duplicateExists(name, editingVenue, field.id)) {
      onStatusMessage({ text: 'That field already exists for this venue.', isError: true });
      return;
    }
    updateSettings({ fields: fields.map((item) => item.id === field.id ? { ...item, name, venue: editingVenue } : item) });
    setEditingId(null);
    setEditingName('');
    setEditingVenue('');
    onStatusMessage({ text: `Field "${name}" updated.`, isError: false });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF]">
          <MapPin className="h-4 w-4 text-[#007A6A] dark:text-[#00D7BC]" />
          Fields
        </h3>
        <p className="mb-4 text-xs text-slate-500 dark:text-[#9CA3AF]">
          Add the individual playing fields at each saved venue. Only fields linked to the selected venue are offered when scheduling a game.
        </p>
        {venues.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-600 dark:border-[#354050] dark:text-[#D1D5DB]">
            Add a venue in Setup &amp; Settings → Venues before adding fields.
          </div>
        ) : (
          <form onSubmit={addField} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#354050] dark:bg-[#1A2028]/70">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">
              Field name
              <input
                value={newFieldName}
                onChange={(event) => setNewFieldName(event.target.value)}
                placeholder="e.g. Field 1"
                aria-label="New field name"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA]"
              />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">
              Link to venue
              <ThemedDropdown<string>
                value={newFieldVenue || undefined}
                onChange={(value) => setNewFieldVenue(value || '')}
                options={venues.map((venue) => ({ value: venue, label: venue }))}
                placeholder="Select venue"
                ariaLabel="Venue for new field"
                allowClear={false}
                className="mt-1 w-full"
              />
            </label>
            <button type="submit" disabled={!newFieldName.trim() || !newFieldVenue} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#00BFA5] px-3.5 py-2.5 text-xs font-semibold text-[#18212D] shadow-xs hover:bg-[#00AD96] disabled:opacity-50 dark:bg-[#00D7BC] dark:text-[#101419]">
              <Plus className="h-3.5 w-3.5" /> Add Field
            </button>
          </form>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF]">Saved Fields ({fields.length})</div>
        {fields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500 dark:border-[#354050] dark:text-[#9CA3AF]">
            No fields saved yet. Add a field and link it to a venue above.
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((field) => {
              const isEditing = editingId === field.id;
              return (
                <div key={field.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-[#354050] dark:bg-[#252D38]/40">
                  {isEditing ? (
                    <>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">
                        Field name
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onKeyDown={(event) => { if (event.key === 'Escape') { setEditingId(null); setEditingName(''); setEditingVenue(''); } }}
                          aria-label={`Edit field name ${field.name}`}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-semibold text-slate-900 dark:border-[#354050] dark:bg-[#1A2028] dark:text-[#FAFAFA]"
                        />
                      </label>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#D1D5DB]">
                        Venue
                        <ThemedDropdown<string>
                          value={editingVenue || undefined}
                          onChange={(value) => setEditingVenue(value || '')}
                          options={venues.map((venue) => ({ value: venue, label: venue }))}
                          placeholder="Select venue"
                          ariaLabel={`Venue for field ${field.name}`}
                          allowClear={false}
                          className="mt-1 w-full"
                        />
                      </label>
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => saveEdit(field)} aria-label={`Save field ${field.name}`} title="Save field" className="rounded-lg p-2 text-teal-600 hover:bg-teal-50 dark:text-[#00D7BC] dark:hover:bg-teal-950/40"><Check className="h-4 w-4" /></button>
                        <button type="button" onClick={() => { setEditingId(null); setEditingName(''); setEditingVenue(''); }} aria-label="Cancel field edit" title="Cancel" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#354050]"><X className="h-4 w-4" /></button>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-w-0 items-center gap-3">
                      <MapPin className="h-4 w-4 shrink-0 text-[#007A6A] dark:text-[#00D7BC]" />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-slate-900 dark:text-[#FAFAFA]">{field.name}</p>
                        <p className="mt-0.5 break-words text-[11px] text-slate-500 dark:text-[#9CA3AF]">{field.venue}</p>
                      </div>
                      <button type="button" onClick={() => { setEditingId(field.id); setEditingName(field.name); setEditingVenue(field.venue); }} aria-label={`Edit field ${field.name}`} title="Edit field" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-[#007A6A] dark:text-[#9CA3AF] dark:hover:bg-[#354050] dark:hover:text-[#00D7BC]"><Edit2 className="h-4 w-4" /></button>
                      <button type="button" onClick={() => { updateSettings({ fields: fields.filter((item) => item.id !== field.id) }); if (editingId === field.id) { setEditingId(null); setEditingName(''); setEditingVenue(''); } onStatusMessage({ text: `Field "${field.name}" removed from field settings.`, isError: false }); }} aria-label={`Remove field ${field.name}`} title="Remove field" className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-[#FF5252]/15"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
