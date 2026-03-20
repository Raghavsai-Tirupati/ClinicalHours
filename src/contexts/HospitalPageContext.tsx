import { createContext, useContext } from 'react';
import type { HospitalPageWithOpportunity } from '@/types/positions';

interface HospitalPageContextValue {
  hospitalPage: HospitalPageWithOpportunity | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  /** Base URL path for all dashboard links (e.g. "/hospital-dashboard" or "/hospital/abc-123") */
  basePath: string;
}

const HospitalPageContext = createContext<HospitalPageContextValue | null>(null);

export function useHospitalPageContext() {
  const ctx = useContext(HospitalPageContext);
  if (!ctx) {
    throw new Error('useHospitalPageContext must be used within HospitalPageProvider');
  }
  return ctx;
}

export default HospitalPageContext;
