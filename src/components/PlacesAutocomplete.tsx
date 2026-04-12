'use client';

import { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Location } from '@/lib/types';

interface PlacesAutocompleteProps {
  onPlaceSelect: (location: Location) => void;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
  id?: string;
}

export default function PlacesAutocomplete({
  onPlaceSelect,
  placeholder = 'Search address...',
  defaultValue = '',
  className = '',
  id,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const places = useMapsLibrary('places');
  const [value, setValue] = useState(defaultValue);
  const callbackRef = useRef(onPlaceSelect);
  callbackRef.current = onPlaceSelect;

  useEffect(() => {
    if (!places || !inputRef.current) return;

    // Avoid re-initializing
    if (autocompleteRef.current) return;

    const autocomplete = new places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'place_id', 'name'],
      types: ['address'],
      componentRestrictions: { country: 'au' },
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        const location: Location = {
          address: place.formatted_address || place.name || '',
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          placeId: place.place_id,
        };
        setValue(location.address);
        callbackRef.current(location);
      }
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [places]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className={`input-field ${className}`}
      autoComplete="off"
    />
  );
}
