import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  Mail,
  Settings,
  LogOut,
  Plus,
  Shield,
  ClipboardList,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { usePositions } from '@/hooks/usePositions';
import { supabase } from '@/integrations/supabase/client';

export default function HospitalSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hospitalPage, basePath, isSuperAdmin } = useHospitalPageContext();
  const { positions } = usePositions(hospitalPage?.id);

  const isActive = (route: string) => {
    if (route === basePath) {
      return location.pathname === basePath || location.pathname === `${basePath}/`;
    }
    return location.pathname.startsWith(route);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const activeCount = positions.filter(p => p.status === 'active').length;

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard, route: basePath },
    { label: 'Positions', icon: Briefcase, route: `${basePath}/positions`, badge: activeCount || positions.length },
    { label: 'Applicants', icon: Users, route: `${basePath}/applications` },
    { label: 'Interviews', icon: Calendar, route: `${basePath}/interviews` },
    { label: 'Email', icon: Mail, route: `${basePath}/email` },
    { label: 'Team', icon: Users, route: `${basePath}/team` },
    { label: 'Waitlists', icon: ClipboardList, route: `${basePath}/waitlist` },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 px-2 group-data-[collapsible=icon]:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            {hospitalPage?.opportunity.name?.charAt(0) || 'H'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-sm font-semibold">{hospitalPage?.opportunity.name}</p>
            <p className="text-xs text-muted-foreground">Admin Dashboard</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton asChild isActive={isActive(item.route)} tooltip={item.label}>
                    <Link to={item.route}>
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-medium"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="New Position">
                  <Link to={`${basePath}/positions/new`} className="text-primary">
                    <Plus className="h-4 w-4" />
                    <span>New Position</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {isSuperAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Site admin">
                <Link to="/admin">
                  <Shield className="h-4 w-4" />
                  <span>Site admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive(`${basePath}/settings`)}
              tooltip="Settings"
            >
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
