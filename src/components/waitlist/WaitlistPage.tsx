import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Building2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { WaitlistSettings } from './types';
import WaitlistForm from './WaitlistForm';

import '@/pages/position-apply.css';
import './waitlist-form.css';

export default function WaitlistPage() {
  const { slug } = useParams<{ slug: string }>();
  const [settings, setSettings] = useState<WaitlistSettings | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [clinicLocation, setClinicLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    (async () => {
      // Fetch waitlist settings by slug
      const { data: ws, error } = await supabase
        .from('waitlist_settings')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error || !ws) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setSettings(ws as WaitlistSettings);

      // Fetch clinic name from hospital_pages → opportunities
      const { data: hp } = await supabase
        .from('hospital_pages')
        .select('hospital_id, opportunities:hospital_id (name, location)')
        .eq('id', ws.clinic_id)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opp = (hp as any)?.opportunities;
      if (opp?.name) setClinicName(opp.name);
      if (opp?.location) setClinicLocation(opp.location);

      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#0f0f0f';
    return () => { document.body.style.backgroundColor = prev; };
  }, []);

  if (loading) {
    return (
      <div className="wl-root pa-root">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--pa-accent)' }} />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="wl-root pa-root">
        <Helmet><title>Waitlist Not Found | ClinicalHours</title></Helmet>
        <nav className="pa-topnav">
          <Link to="/" className="pa-nav-logo">Clinical<span>Hours</span></Link>
        </nav>
        <div className="pa-page">
          <div className="wl-closed-wrap">
            <div className="wl-closed-icon">
              <Clock size={24} style={{ color: 'var(--pa-text-3)' }} />
            </div>
            <h1 className="wl-closed-title">Waitlist not found</h1>
            <p className="wl-closed-body">This waitlist link is invalid or has been removed.</p>
          </div>
        </div>
      </div>
    );
  }

  const isClosed = settings && !settings.is_open;

  return (
    <div className="wl-root pa-root">
      <Helmet>
        <title>{clinicName ? `${clinicName} Waitlist` : 'Waitlist'} | ClinicalHours</title>
      </Helmet>

      {/* Top nav */}
      <nav className="pa-topnav">
        <Link to="/" className="pa-nav-logo">Clinical<span>Hours</span></Link>
        <div className="pa-nav-links">
          <Link to="/opportunities">Browse Opportunities</Link>
          <Link to="/auth">Sign In</Link>
        </div>
      </nav>

      <div className="pa-page">
        {/* Clinic header */}
        <div className="pa-pos-header">
          <div>
            <div className="pa-pos-clinic">
              <Building2 size={14} />
              {clinicName || 'Clinic'}
              {clinicLocation && <><span style={{ margin: '0 4px' }}>·</span>{clinicLocation}</>}
            </div>
            <h1 className="pa-pos-title">Interest Form / Waitlist</h1>
            <div className="pa-pos-tags">
              <span className="pa-tag pa-tag-accent">Waitlist</span>
            </div>
          </div>
        </div>

        {isClosed ? (
          <div className="wl-closed-wrap">
            <div className="wl-closed-icon">
              <Clock size={24} style={{ color: 'var(--pa-text-3)' }} />
            </div>
            <h1 className="wl-closed-title">Waitlist is currently closed</h1>
            <p className="wl-closed-body">
              This clinic's waitlist is not accepting new submissions at this time. Please check back later.
            </p>
          </div>
        ) : (
          <WaitlistForm clinicId={settings!.clinic_id} clinicName={clinicName} />
        )}
      </div>
    </div>
  );
}
