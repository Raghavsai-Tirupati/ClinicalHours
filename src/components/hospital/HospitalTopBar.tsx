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
    <header className="sticky top-0 z-40 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background px-3 py-2 sm:h-14 sm:flex-nowrap sm:px-4 sm:py-0">
      <div className="flex min-w-0 flex-1 basis-[min(100%,20rem)] items-center gap-2 sm:basis-auto sm:flex-1">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <HospitalLogo logoUrl={logoUrl} hospitalName={name} size="sm" className="shrink-0" />
        {showClinicSwitcher ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto min-w-0 max-w-full shrink py-1 px-2 -ml-2 gap-1 text-sm font-semibold">
                <span className="break-words text-left sm:line-clamp-2 sm:max-w-[min(12rem,40vw)]">{name}</span>
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
                  <span className="break-words text-left leading-snug">{p.opportunity.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <h1 className="min-w-0 flex-1 text-sm font-semibold break-words sm:line-clamp-2">{name}</h1>
        )}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
        <Badge variant="outline" className="max-w-full gap-1 whitespace-normal text-xs leading-snug">
          <Shield className="h-3 w-3 shrink-0" />
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
