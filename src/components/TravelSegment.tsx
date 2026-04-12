'use client';

import { motion } from 'framer-motion';
import { formatDuration, formatDistance } from '@/lib/timeUtils';
import { TravelSegment as TravelSegmentType } from '@/lib/types';

interface TravelSegmentProps {
  segment: TravelSegmentType | undefined;
  teamColor: string;
}

export default function TravelSegment({ segment, teamColor }: TravelSegmentProps) {
  const isCalculating = segment?.isCalculating ?? false;
  const duration = segment?.durationMinutes ?? 0;
  const distance = segment?.distanceKm ?? 0;

  // Color coding: green < 15min, amber 15-30, red > 30
  const getStatusColor = (min: number) => {
    if (min <= 15) return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
    if (min <= 30) return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
    return { bg: '#FEF2F2', text: '#EF4444', border: '#FECACA' };
  };

  const statusColor = getStatusColor(duration);

  return (
    <div className="relative flex items-center py-1.5 pl-5 ml-4">
      {/* Vertical connector line */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full"
        style={{ backgroundColor: teamColor, opacity: 0.25 }}
      />
      {/* Dot on line */}
      <div
        className="absolute left-[-3px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
        style={{ backgroundColor: teamColor, opacity: 0.4 }}
      />

      {/* Travel info badge */}
      {isCalculating ? (
        <div className="shimmer h-6 w-32 rounded-full" />
      ) : segment && duration > 0 ? (
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full"
          style={{
            backgroundColor: statusColor.bg,
            color: statusColor.text,
            border: `1px solid ${statusColor.border}`,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1" />
            <polygon points="12 15 17 21 7 21 12 15" />
          </svg>
          <span>{formatDuration(duration)}</span>
          <span className="opacity-50">·</span>
          <span>{formatDistance(distance)}</span>
        </motion.div>
      ) : null}
    </div>
  );
}
