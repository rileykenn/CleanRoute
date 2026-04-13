'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlacesAutocomplete from './PlacesAutocomplete';
import { formatTimeDisplay, JOB_DURATIONS } from '@/lib/timeUtils';
import { Client, Location, ScheduleAction, TeamSchedule } from '@/lib/types';

interface ClientCardProps {
  client: Client;
  index: number;
  totalClients: number;
  team: TeamSchedule;
  dispatch: React.Dispatch<ScheduleAction>;
}

export default function ClientCard({ client, index, totalClients, team, dispatch }: ClientCardProps) {
  const [addressText, setAddressText] = useState('');
  const [hasEdited, setHasEdited] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [addressVersion, setAddressVersion] = useState(0);

  // Resolve address via Places AutocompleteService (same as AddClientButton)
  const resolveAddress = useCallback(async (text: string): Promise<Location | null> => {
    if (!window.google?.maps) return null;

    const autocompleteService = new google.maps.places.AutocompleteService();

    return new Promise((resolve) => {
      autocompleteService.getPlacePredictions(
        {
          input: text,
          componentRestrictions: { country: 'au' },
          types: ['address'],
        },
        (predictions, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !predictions ||
            predictions.length === 0
          ) {
            resolve(null);
            return;
          }

          const topPrediction = predictions[0];
          const tempDiv = document.createElement('div');
          const placesService = new google.maps.places.PlacesService(tempDiv);

          placesService.getDetails(
            {
              placeId: topPrediction.place_id,
              fields: ['formatted_address', 'geometry', 'place_id', 'name'],
            },
            (place, detailsStatus) => {
              if (
                detailsStatus === google.maps.places.PlacesServiceStatus.OK &&
                place?.geometry?.location
              ) {
                resolve({
                  address: place.formatted_address || place.name || topPrediction.description,
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                  placeId: place.place_id,
                });
              } else {
                resolve(null);
              }
            }
          );
        }
      );
    });
  }, []);

  const handleConfirmAddress = async () => {
    const text = addressText.trim();
    if (!text) return;

    setIsResolving(true);
    const resolved = await resolveAddress(text);
    setIsResolving(false);

    if (resolved) {
      dispatch({
        type: 'UPDATE_CLIENT',
        teamId: team.id,
        clientId: client.id,
        updates: { location: resolved },
      });
      setHasEdited(false);
      setAddressText('');
      setAddressVersion((v) => v + 1);
    }
  };

  const handleCancelEdit = () => {
    setHasEdited(false);
    setAddressText('');
    setAddressVersion((v) => v + 1);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="card p-4 group"
      style={{ borderLeft: `3px solid ${team.color.primary}` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Stop number badge */}
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: team.color.primary }}
          >
            {index + 1}
          </div>

          {/* Client name - editable */}
          <input
            type="text"
            value={client.name}
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_CLIENT',
                teamId: team.id,
                clientId: client.id,
                updates: { name: e.target.value },
              })
            }
            className="font-semibold text-sm bg-transparent border-none outline-none flex-1 min-w-0 text-text-primary 
                       hover:bg-surface-elevated focus:bg-surface-elevated px-2 py-1 -ml-2 rounded-md transition-colors"
            placeholder="Client name"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Move up */}
          {index > 0 && (
            <button
              onClick={() =>
                dispatch({
                  type: 'REORDER_CLIENTS',
                  teamId: team.id,
                  fromIndex: index,
                  toIndex: index - 1,
                })
              }
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-tertiary hover:text-text-primary transition-colors"
              title="Move up"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          )}
          {/* Move down */}
          {index < totalClients - 1 && (
            <button
              onClick={() =>
                dispatch({
                  type: 'REORDER_CLIENTS',
                  teamId: team.id,
                  fromIndex: index,
                  toIndex: index + 1,
                })
              }
              className="p-1.5 rounded-lg hover:bg-surface-elevated text-text-tertiary hover:text-text-primary transition-colors"
              title="Move down"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
          {/* Remove */}
          <button
            onClick={() =>
              dispatch({
                type: 'REMOVE_CLIENT',
                teamId: team.id,
                clientId: client.id,
              })
            }
            className="p-1.5 rounded-lg hover:bg-danger-light text-text-tertiary hover:text-danger transition-colors"
            title="Remove client"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Address — editable inline (swap client by changing address) */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <PlacesAutocomplete
              key={`addr-${client.id}-${addressVersion}`}
              onPlaceSelect={(location) => {
                dispatch({
                  type: 'UPDATE_CLIENT',
                  teamId: team.id,
                  clientId: client.id,
                  updates: { location },
                });
                setHasEdited(false);
                setAddressText('');
              }}
              onTextChange={(text) => {
                setAddressText(text);
                // Show confirm/cancel buttons when text differs from current address
                if (text !== client.location.address) {
                  setHasEdited(true);
                } else {
                  setHasEdited(false);
                }
              }}
              defaultValue={client.location.address}
              placeholder="Enter client address..."
              className="text-sm"
            />
          </div>

          {/* Confirm / Cancel buttons — appear when address text has been edited */}
          <AnimatePresence>
            {hasEdited && addressText.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                exit={{ opacity: 0, scale: 0.8, width: 0 }}
                className="flex items-center gap-1 shrink-0 overflow-hidden"
              >
                {/* Confirm (tick) */}
                <button
                  onClick={handleConfirmAddress}
                  disabled={isResolving}
                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  title="Confirm address change"
                >
                  {isResolving ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                {/* Cancel (x) */}
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                  title="Cancel address change"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Duration selector + Time display */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <select
            value={client.jobDurationMinutes}
            onChange={(e) =>
              dispatch({
                type: 'UPDATE_CLIENT',
                teamId: team.id,
                clientId: client.id,
                updates: { jobDurationMinutes: Number(e.target.value) },
              })
            }
            className="text-sm bg-surface-elevated border border-border-light rounded-lg px-3 py-1.5 outline-none 
                       focus:border-primary focus:ring-2 focus:ring-primary/10 cursor-pointer"
          >
            {JOB_DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Calculated times */}
        {client.startTime && client.endTime && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 text-sm"
          >
            <span className="font-medium" style={{ color: team.color.primary }}>
              {formatTimeDisplay(client.startTime)}
            </span>
            <span className="text-text-tertiary">–</span>
            <span className="font-medium" style={{ color: team.color.primary }}>
              {formatTimeDisplay(client.endTime)}
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
