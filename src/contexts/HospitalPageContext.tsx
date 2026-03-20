import { createContext, useContext } from 'react';
import type { HospitalPageWithOpportunity } from '@/types/positions';

interface HospitalPageContextValue {
  hospitalPage: HospitalPageWithOpportunity | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
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
