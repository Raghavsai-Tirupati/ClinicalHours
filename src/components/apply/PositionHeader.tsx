import { Building2, Clock, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { POSITION_TYPE_LABELS } from '@/types/positions';
import type { HospitalPosition } from '@/types/positions';

interface Props {
  position: HospitalPosition;
  hospitalName: string;
  isProfileComplete: boolean;
  profileLoading: boolean;
  missingFields: string[];
  submitError: string | null;
}

export default function PositionHeader({
  position,
  hospitalName,
  isProfileComplete,
  profileLoading,
  missingFields,
  submitError,
}: Props) {
  const navigate = useNavigate();

  return (
    <>
      <div className="pa-pos-header">
        <div>
          <div className="pa-pos-clinic">
            <Building2 className="h-3.5 w-3.5" />
            {hospitalName || 'Hospital'}
          </div>
          <h1 className="pa-pos-title">{position.title}</h1>
          <div className="pa-pos-tags">
            <span className="pa-tag pa-tag-accent">{POSITION_TYPE_LABELS[position.position_type]}</span>
            {position.hours_per_week != null && (
              <span className="pa-tag flex items-center gap-1">
                <Clock className="h-3 w-3 opacity-70" />
                {position.hours_per_week}h / week
              </span>
            )}
            {position.location && (
              <span className="pa-tag flex items-center gap-1">
                <MapPin className="h-3 w-3 opacity-70" />
                {position.location}
              </span>
            )}
            {position.duration && <span className="pa-tag">{position.duration}</span>}
          </div>
        </div>
      </div>

      {!profileLoading && !isProfileComplete && (
        <div className="pa-warn-banner">
          <p>Complete your profile before applying</p>
          <p className="pa-sub">Required fields: {missingFields.join(', ')}</p>
          <button type="button" className="pa-btn mt-3" onClick={() => navigate('/settings')}>
            Go to settings
          </button>
        </div>
      )}

      {submitError && <div className="pa-error-banner">{submitError}</div>}
    </>
  );
}
