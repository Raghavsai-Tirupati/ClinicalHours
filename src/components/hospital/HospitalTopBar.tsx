import { Link } from 'react-router-dom';
import { Settings, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import HospitalLogo from '@/components/HospitalLogo';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';

export default function HospitalTopBar() {
  const { hospitalPage } = useHospitalPageContext();
  const name = hospitalPage?.opportunity.name || 'Loading...';
  const logoUrl = hospitalPage?.opportunity.logo_url || null;
  const pageId = hospitalPage?.id || '';

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-6" />

      <div className="flex items-center gap-3 flex-1 min-w-0">
        <HospitalLogo logoUrl={logoUrl} hospitalName={name} size="sm" />
        <h1 className="text-sm font-semibold truncate">{name}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs gap-1">
          <Shield className="h-3 w-3" />
          Admin
        </Badge>
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/hospital/${pageId}/settings`}>
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
