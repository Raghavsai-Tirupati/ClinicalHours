import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Home, MapPin, Mail, LogIn, Sparkles, ChevronDown, User, Lock, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalMember } from "@/hooks/useHospitalMember";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo.png";

// Icons for dropdown menu
const dropdownIcons: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  "/": Home,
  "/map": MapPin,
  "/contact": Mail,
  "/auth": LogIn,
};

const freeToolsLinks = [
  { name: "Clinical Hours Journal", path: "/hours" },
  { name: "Application Cost Calculator", path: "/costs" },
];

const premiumToolsLinks = [
  { name: "PathFinder — AI Matcher", path: "/quiz" },
  { name: "AMCAS Activity Writer", path: "/amcas" },
  { name: "AAMC Competency Tracker", path: "/competencies" },
  { name: "Letter of Rec Manager", path: "/lor" },
  { name: "Application Timeline", path: "/timeline" },
  { name: "Secondary Essay Coach", path: "/secondaries" },
  { name: "School List Builder", path: "/school-list" },
  
];

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownTimeoutRef = useRef<number | null>(null);
  const location = useLocation();
  const { user, isGuest } = useAuth();
  const { member: hospitalMember } = useHospitalMember();
  const { isPremium } = usePremiumStatus();

  // Check if we're on pages that should have transparent nav
  const isHomePage = location.pathname === "/";
  const isDashboardPage = location.pathname === "/dashboard";
  const hasTransparentNav = isHomePage || isDashboardPage;

  // Show hover dropdown only on homepage when not logged in (guests count as not logged in for nav)
  const showHoverDropdown = isHomePage && !user && !isGuest;

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
    setIsDropdownOpen(false);
  }, [location.pathname]);

  // Handle dropdown hover with delay for smooth UX
  const handleDropdownEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setIsDropdownOpen(true);
  };

  const handleDropdownLeave = () => {
    dropdownTimeoutRef.current = window.setTimeout(() => {
      setIsDropdownOpen(false);
    }, 150);
  };

  // Show different links based on auth state
  const publicLinks = [
    { name: "Home", path: "/" },
    { name: "Map", path: "/map" },
    { name: "Contact", path: "/contact" },
  ];

  const authenticatedLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Opportunities", path: "/opportunities" },
    { name: "Map", path: "/map" },
    ...(hospitalMember
      ? [{ name: "Hospital Admin", path: "/hospital/admin" }]
      : []),
  ];

  // Hospital members see only one tab: Admin portal. No opportunities, map, or my-applications.
  const isHospitalContext = !!hospitalMember;
  const hospitalLinks = [{ name: "Admin", path: "/hospital-dashboard" }];

  // Hospital context: no student features. Otherwise authenticated or public.
  const links =
    user || isGuest
      ? isHospitalContext
        ? hospitalLinks
        : authenticatedLinks
      : publicLinks;

  // Hide Tools dropdown in hospital context
  const showToolsDropdown = (user || isGuest) && !isHospitalContext;

  const isActive = (path: string) => location.pathname === path;

  // Bottom tab bar is for student context only, not on public auth/home pages or hospital context
  const isAuthOrHome = location.pathname === "/" || location.pathname.startsWith("/auth");
  const isStudentContext = (user || isGuest) && !isHospitalContext;
  const showBottomTabs = isStudentContext && !isAuthOrHome;

  const bottomTabs = [
    { name: "Dashboard", path: "/dashboard", icon: Home },
    { name: "Opportunities", path: "/opportunities", icon: MapPin },
    { name: "Tracker", path: "/my-applications", icon: Sparkles },
    { name: "Settings", path: "/settings", icon: SettingsIcon },
  ];

  // Determine nav styles based on scroll and page
  const navBackground = hasTransparentNav
    ? (isScrolled ? "bg-black" : "bg-transparent")
    : "bg-background";

  const textColor = hasTransparentNav
    ? "text-white"
    : "text-foreground";

  const logoColor = hasTransparentNav
    ? "text-white"
    : "text-foreground";

  const borderStyle = hasTransparentNav && !isScrolled
    ? "border-transparent"
    : (hasTransparentNav ? "border-white/10" : "border-border");

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBackground} ${borderStyle} border-b backdrop-blur-sm bg-opacity-95`}>
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className={`flex items-center gap-2 text-xl tracking-tight font-heading ${logoColor}`}>
              <img src={logo} alt="ClinicalHours" className="h-8 w-8 object-contain" />
              <span>
                <span className="font-normal">Clinical</span>
                <span className="font-bold">Hours</span>
              </span>
            </Link>

            {/* Desktop Navigation - Standard links for logged in users or non-homepage */}
            {!showHoverDropdown && (
              <div className="hidden md:flex items-center gap-6">
                {links.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-70 font-heading ${
                      isActive(link.path) ? "opacity-100" : "opacity-80"
                    } ${textColor}`}
                  >
                    {link.name}
                  </Link>
                ))}
                {/* Tools dropdown for authenticated users (hidden in hospital context) */}
                {showToolsDropdown && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor} outline-none`}>
                      Tools <ChevronDown className="h-3 w-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {/* Free tools */}
                      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Free Tools
                      </div>
                      {freeToolsLinks.map((link) => (
                        <DropdownMenuItem key={link.path} asChild>
                          <Link to={link.path} className="cursor-pointer">
                            {link.name}
                          </Link>
                        </DropdownMenuItem>
                      ))}

                      {/* Premium tools section always labeled as Premium; locks only for non-premium users */}
                      {premiumToolsLinks.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                            Premium
                          </div>
                          {premiumToolsLinks.map((link) => (
                            <DropdownMenuItem key={link.path} asChild>
                              <Link
                                to={link.path}
                                className="cursor-pointer flex items-center justify-between gap-2"
                              >
                                <span>{link.name}</span>
                                {!isPremium && (
                                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                                )}
                              </Link>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}

                      {!isPremium && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link to="/premium" className="cursor-pointer flex items-center gap-1.5 text-amber-400">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Upgrade to Premium</span>
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {user && !isGuest ? (
                  <Link
                    to="/settings"
                    className={`text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                  >
                    Settings
                  </Link>
                ) : (
                  <Link
                    to="/auth"
                    className={`text-xs font-semibold uppercase tracking-widest transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                  >
                    {isGuest ? "Sign Up" : "Login / Sign Up"}
                  </Link>
                )}
                <ThemeToggle />
              </div>
            )}

            {/* Desktop Navigation - Hover dropdown for homepage when not logged in */}
            {showHoverDropdown && (
              <div
                className="hidden md:flex items-center"
                onMouseEnter={handleDropdownEnter}
                onMouseLeave={handleDropdownLeave}
              >
                <button
                  className={`p-3 transition-all duration-300 ${textColor} hover:opacity-70`}
                  aria-label="Menu"
                  aria-expanded={isDropdownOpen}
                >
                  {/* Two bar hamburger icon */}
                  <div className="flex flex-col gap-1.5">
                    <div className={`w-6 h-0.5 bg-current transition-all duration-300 ${isDropdownOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
                    <div className={`w-6 h-0.5 bg-current transition-all duration-300 ${isDropdownOpen ? '-rotate-45' : ''}`}></div>
                  </div>
                </button>
              </div>
            )}

            {/* Mobile Menu Button and Theme Toggle */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2 transition-colors ${textColor}`}
                aria-label={isOpen ? "Close menu" : "Open menu"}
                aria-expanded={isOpen}
              >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isOpen && (
            <div className={`md:hidden py-6 space-y-4 border-t ${hasTransparentNav ? "border-white/10" : "border-border"}`}>
              {links.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`block text-xs font-semibold uppercase tracking-widest py-2 transition-opacity hover:opacity-70 font-heading ${
                    isActive(link.path) ? "opacity-100" : "opacity-80"
                  } ${textColor}`}
                >
                  {link.name}
                </Link>
              ))}
              {/* Mobile tools section (hidden in hospital context) */}
              {showToolsDropdown && (
                <div className={`pt-2 border-t ${hasTransparentNav ? "border-white/10" : "border-border"}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${textColor} opacity-50`}>Tools</p>
                  <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${textColor} opacity-60`}>Free Tools</p>
                  {freeToolsLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsOpen(false)}
                      className={`block text-xs font-semibold uppercase tracking-widest py-2 transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                    >
                      {link.name}
                    </Link>
                  ))}
                  {premiumToolsLinks.length > 0 && (
                    <>
                      <p className={`mt-3 text-[10px] font-semibold uppercase tracking-widest mb-1 text-amber-400`}>Premium</p>
                      {premiumToolsLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center justify-between text-xs font-semibold uppercase tracking-widest py-2 transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                        >
                          <span>{link.name}</span>
                          {!isPremium && <Lock className="h-3.5 w-3.5 text-amber-400" />}
                        </Link>
                      ))}
                    </>
                  )}
                  {!isPremium && (
                    <Link
                      to="/premium"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest py-2 transition-opacity hover:opacity-70 text-amber-400 font-heading"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Upgrade to Premium
                    </Link>
                  )}
                </div>
              )}
              {user && !isGuest ? (
                <Link
                  to="/settings"
                  onClick={() => setIsOpen(false)}
                  className={`block text-xs font-semibold uppercase tracking-widest py-2 transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                >
                  Settings
                </Link>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setIsOpen(false)}
                  className={`block text-xs font-semibold uppercase tracking-widest py-2 transition-opacity hover:opacity-70 opacity-80 font-heading ${textColor}`}
                >
                  {isGuest ? "Sign Up" : "Login / Sign Up"}
                </Link>
              )}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold uppercase tracking-widest font-heading ${textColor} opacity-80`}>Theme</span>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Desktop Dropdown Panel - Covers right third of screen */}
      {showHoverDropdown && (
        <div
          className={`fixed top-0 right-0 h-screen w-1/3 bg-black z-40 transition-all duration-500 ease-out ${
            isDropdownOpen
              ? 'translate-x-0 opacity-100'
              : 'translate-x-full opacity-0'
          }`}
          onMouseEnter={handleDropdownEnter}
          onMouseLeave={handleDropdownLeave}
          style={{ pointerEvents: isDropdownOpen ? 'auto' : 'none' }}
        >
          {/* Content container */}
          <div className={`flex flex-col justify-center h-full px-8 transition-all duration-500 delay-100 ${
            isDropdownOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
          }`}>
            <nav className="flex flex-col">
              {publicLinks.map((link, index) => {
                const IconComponent = dropdownIcons[link.path];
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`group flex items-center gap-4 py-6 px-4 -mx-4 text-2xl font-light text-white uppercase tracking-widest transition-all duration-300 hover:bg-white/5 ${
                      isActive(link.path) ? "opacity-100" : "opacity-80"
                    } ${index > 0 ? "border-t border-white/10" : ""}`}
                    style={{
                      transitionDelay: isDropdownOpen ? `${150 + index * 50}ms` : '0ms',
                    }}
                  >
                    {IconComponent && (
                      <IconComponent className="h-5 w-5 text-white/50 group-hover:text-white/80 transition-colors duration-300" strokeWidth={1.5} />
                    )}
                    <span className="font-heading group-hover:translate-x-1 transition-transform duration-300">{link.name}</span>
                  </Link>
                );
              })}
              {/* Login / Sign Up link */}
              {(() => {
                const IconComponent = dropdownIcons["/auth"];
                return (
                  <Link
                    to="/auth"
                    className="group flex items-center gap-4 py-6 px-4 -mx-4 text-2xl font-light text-white uppercase tracking-widest transition-all duration-300 hover:bg-white/5 opacity-80 border-t border-white/10"
                    style={{
                      transitionDelay: isDropdownOpen ? `${150 + publicLinks.length * 50}ms` : '0ms',
                    }}
                  >
                    {IconComponent && (
                      <IconComponent className="h-5 w-5 text-white/50 group-hover:text-white/80 transition-colors duration-300" strokeWidth={1.5} />
                    )}
                    <span className="font-heading group-hover:translate-x-1 transition-transform duration-300">Login / Sign Up</span>
                  </Link>
                );
              })()}
            </nav>
          </div>

          {/* Subtle left border gradient */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
        </div>
      )}

      {showBottomTabs && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 border-t border-border/80 backdrop-blur-sm">
          <div className="flex items-center justify-around px-2 py-1.5">
            {bottomTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isActive(tab.path);
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className="flex flex-col items-center justify-center flex-1 px-2"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className={`mt-0.5 text-[10px] font-medium ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {tab.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
};

export default Navigation;
