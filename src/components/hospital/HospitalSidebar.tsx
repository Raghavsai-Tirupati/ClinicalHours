import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Plus, Settings, Briefcase, ChevronRight, LogOut } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { usePositions } from '@/hooks/usePositions';
import { supabase } from '@/integrations/supabase/client';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/15 text-green-600',
  draft: 'bg-muted text-muted-foreground',
  paused: 'bg-yellow-500/15 text-yellow-600',
  closed: 'bg-red-500/15 text-red-600',
};

export default function HospitalSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hospitalPage, basePath } = useHospitalPageContext();
  const { positions } = usePositions(hospitalPage?.id);

  const isOverview = location.pathname === basePath || location.pathname === `${basePath}/`;
  const isSettings = location.pathname === `${basePath}/settings`;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isOverview} tooltip="Overview">
              <Link to={`${basePath}`}>
                <LayoutDashboard className="h-4 w-4" />
                <span>Overview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="cursor-pointer hover:bg-muted/50 rounded-md transition-colors">
                <Briefcase className="h-4 w-4 mr-2" />
                Positions
                <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {positions.map((pos) => {
                    const isActive = location.pathname.includes(`/positions/${pos.id}`);
                    return (
                      <SidebarMenuItem key={pos.id}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={pos.title}>
                          <Link to={`${basePath}/positions/${pos.id}`}>
                            <span className="truncate">{pos.title}</span>
                            <Badge
                              variant="secondary"
                              className={`ml-auto text-[10px] px-1.5 py-0 ${STATUS_COLORS[pos.status] || ''}`}
                            >
                              {pos.status}
                            </Badge>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="New Position">
                      <Link
                        to={`${basePath}/positions/new`}
                        className="text-primary"
                      >
                        <Plus className="h-4 w-4" />
                        <span>New Position</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isSettings} tooltip="Settings">
              <Link to={`${basePath}/settings`}>
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Log Out" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
