import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  BarChart3,
  Users,
  Activity,
  Filter,
  FileBarChart,
  ArrowLeft,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useAnalyticsRealtime } from '@/hooks/useAnalyticsRealtime';

const NAV = [
  { to: '/analytics', label: 'Overview', icon: BarChart3, end: true },
  { to: '/analytics/students', label: 'Students', icon: Users },
  { to: '/analytics/events', label: 'Live Events', icon: Activity },
  { to: '/analytics/cohorts', label: 'Cohort Scripts', icon: Filter },
  { to: '/analytics/reports', label: 'Reports', icon: FileBarChart },
];

export default function StudentAnalyticsLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useAnalyticsRealtime(true);

  return (
    <>
      <Helmet>
        <title>Student Analytics | ClinicalHours</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border/60 bg-card/30">
          <div className="p-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Student Analytics</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Growth & promotion data</p>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-border/60 space-y-2">
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-3.5 w-3.5 mr-2" />
              Admin OS
            </Button>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
            <div className="md:hidden flex gap-1 overflow-x-auto">
              {NAV.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'shrink-0 rounded-full px-3 py-1 text-xs border',
                      isActive ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground'
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
            <div className="hidden md:flex items-center gap-2 ml-auto">
              <Badge variant="outline" className="text-[10px] gap-1">
                <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
                Live
              </Badge>
              <Badge variant="outline" className="text-xs truncate max-w-[200px]">
                {user?.email}
              </Badge>
            </div>
          </header>

          <main className="p-4 sm:p-6 max-w-7xl mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
