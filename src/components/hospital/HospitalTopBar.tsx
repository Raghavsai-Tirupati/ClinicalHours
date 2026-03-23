import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Settings, Shield, ChevronDown, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import HospitalLogo from '@/components/HospitalLogo';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';

export default function HospitalTopBar() {
  const { hospitalPage, basePath, allPages, isSuperAdmin } = useHospitalPageContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const name = hospitalPage?.opportunity.name || 'Loading...';
  const logoUrl = hospitalPage?.opportunity.logo_url || null;
  const showClinicSwitcher = isSuperAdmin && allPages.length > 1;

  const switchClinic = (pageId: string) => {
    if (basePath === '/hospital-dashboard') {
      setSearchParams({ page: pageId });
    } else {
      const rest = location.pathname.replace(/^\/hospital\/[^/]*/, '');
      navigate(`/hospital/${pageId}${rest || ''}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-3 flex-1 min-w-0">
        <HospitalLogo logoUrl={logoUrl} hospitalName={name} size="sm" />
        {showClinicSwitcher ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto py-1 px-2 -ml-2 gap-1 text-sm font-semibold">
                <span className="truncate max-w-[180px]">{name}</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-[min(60vh,400px)] overflow-y-auto">
              {allPages.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => switchClinic(p.id)}
                  className={hospitalPage?.id === p.id ? 'bg-muted' : ''}
                >
                  <Building2 className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{p.opportunity.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <h1 className="text-sm font-semibold truncate">{name}</h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs gap-1">
          <Shield className="h-3 w-3" />
          {isSuperAdmin ? 'Super Admin' : 'Admin'}
        </Badge>
        <Button variant="ghost" size="icon" asChild>
          <Link to={`${basePath}/settings`}>
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
