import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Building2, Clock, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { WaitlistSettings } from './types';
import WaitlistForm from './WaitlistForm';

import logo from '@/assets/logo.png';
import '@/pages/position-apply.css';
import './waitlist-form.css';

interface WaitlistRow {
  id: string;
  clinic_id: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
}

export default function WaitlistPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const directWaitlistId = searchParams.get('wl');

  const [settings, setSettings] = useState<WaitlistSettings | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [clinicLocation, setClinicLocation] = useState('');
  const [waitlists, setWaitlists] = useState<WaitlistRow[]>([]);
  const [selectedWaitlist, setSelectedWaitlist] = useState<WaitlistRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    (async () => {
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

      const { data: hp } = await supabase
        .from('hospital_pages')
        .select('hospital_id, opportunities:hospital_id (name, location)')
        .eq('id', ws.clinic_id)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opp = (hp as any)?.opportunities;
      if (opp?.name) setClinicName(opp.name);
      if (opp?.location) setClinicLocation(opp.location);

      // Fetch waitlists for this clinic (public SELECT allowed by RLS)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: wls } = await (supabase as any)
        .from('waitlists')
        .select('*')
        .eq('clinic_id', ws.clinic_id)
        .order('created_at', { ascending: false });

      const list = (wls ?? []) as WaitlistRow[];
      setWaitlists(list);

      // Auto-select if a direct waitlist id is passed in the URL
      if (directWaitlistId) {
        const match = list.find((w) => w.id === directWaitlistId);
        if (match) setSelectedWaitlist(match);
      }

      setLoading(false);
    })();
  }, [slug, directWaitlistId]);

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
          <Link to="/" className="pa-nav-logo"><img src={logo} alt="" /><span className="logo-wordmark"><span className="logo-light">Clinical</span><span className="logo-bold">Hours</span></span></Link>
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

  const clinicClosed = settings && !settings.is_open;
  const openWaitlists = waitlists.filter((w) => w.status === 'open');

  // If the admin pointed at a specific closed waitlist, block submission
  const selectedClosed = selectedWaitlist && selectedWaitlist.status !== 'open';

  return (
    <div className="wl-root pa-root">
      <Helmet>
        <title>{clinicName ? `${clinicName} Waitlist` : 'Waitlist'} | ClinicalHours</title>
      </Helmet>

      <nav className="pa-topnav">
        <Link to="/" className="pa-nav-logo"><img src={logo} alt="" /><span className="logo-wordmark"><span className="logo-light">Clinical</span><span className="logo-bold">Hours</span></span></Link>
        <div className="pa-nav-links">
          <Link to="/opportunities">Browse Opportunities</Link>
          <Link to="/auth">Sign In</Link>
        </div>
      </nav>

      <div className="pa-page">
        <div className="pa-pos-header">
          <div>
            <div className="pa-pos-clinic">
              <Building2 size={14} />
              {clinicName || 'Clinic'}
              {clinicLocation && <><span style={{ margin: '0 4px' }}>·</span>{clinicLocation}</>}
            </div>
            <h1 className="pa-pos-title">
              {selectedWaitlist ? selectedWaitlist.title : 'Join a Waitlist'}
            </h1>
            <div className="pa-pos-tags">
              <span className="pa-tag pa-tag-accent">Waitlist</span>
            </div>
          </div>
        </div>

        {clinicClosed ? (
          <div className="wl-closed-wrap">
            <div className="wl-closed-icon">
              <Clock size={24} style={{ color: 'var(--pa-text-3)' }} />
            </div>
            <h1 className="wl-closed-title">Waitlist is currently closed</h1>
            <p className="wl-closed-body">
              This clinic's waitlist is not accepting new submissions at this time. Please check back later.
            </p>
          </div>
        ) : selectedClosed ? (
          <div className="wl-closed-wrap">
            <div className="wl-closed-icon">
              <Clock size={24} style={{ color: 'var(--pa-text-3)' }} />
            </div>
            <h1 className="wl-closed-title">This waitlist is closed</h1>
            <p className="wl-closed-body">{selectedWaitlist?.description}</p>
            <button className="pa-btn" style={{ marginTop: 12 }} onClick={() => setSelectedWaitlist(null)}>
              Back to all waitlists
            </button>
          </div>
        ) : selectedWaitlist ? (
          <>
            <div className="pa-section-card">
              <div className="pa-section-body">
                <p style={{ color: 'var(--pa-text-2)', marginBottom: 8 }}>{selectedWaitlist.description}</p>
                {waitlists.length > 1 && (
                  <button
                    className="pa-btn-link"
                    style={{ background: 'none', border: 'none', color: 'var(--pa-accent)', cursor: 'pointer', padding: 0, fontSize: 13 }}
                    onClick={() => setSelectedWaitlist(null)}
                  >
                    ← Choose a different waitlist
                  </button>
                )}
              </div>
            </div>
            <WaitlistForm
              clinicId={selectedWaitlist.clinic_id}
              clinicName={clinicName}
              waitlistId={selectedWaitlist.id}
            />
          </>
        ) : openWaitlists.length === 0 ? (
          <div className="wl-closed-wrap">
            <div className="wl-closed-icon">
              <Clock size={24} style={{ color: 'var(--pa-text-3)' }} />
            </div>
            <h1 className="wl-closed-title">No open waitlists</h1>
            <p className="wl-closed-body">There are no waitlists accepting signups right now. Please check back later.</p>
          </div>
        ) : (
          <div className="pa-section-card">
            <div className="pa-section-head">
              <h2>Choose a waitlist</h2>
              <p>Pick the waitlist you'd like to join.</p>
            </div>
            <div className="pa-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {openWaitlists.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWaitlist(w)}
                  className="pa-option-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    padding: 14,
                    cursor: 'pointer',
                    border: '1px solid var(--pa-border)',
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'inherit',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{w.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--pa-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {w.description}
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--pa-text-3)', flexShrink: 0, marginLeft: 12 }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
