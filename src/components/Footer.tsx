import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-white border-t border-border safe-area-inset-bottom">
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 md:gap-12">
          {/* Brand - Full width on mobile */}
          <div className="col-span-2 md:col-span-1 space-y-4 sm:space-y-6">
            <div className="text-xl text-foreground">
              <span>Clinical</span>
              <span className="font-semibold">Hours</span>
            </div>
            <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-xs">
              Empowering pre-med students to find and secure clinical opportunities.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-muted-foreground mb-4 sm:mb-6">Quick Links</h3>
            <ul className="space-y-3 sm:space-y-4 text-sm">
              <li>
                <Link to="/opportunities" className="text-foreground/70 hover:text-foreground transition-colors font-light inline-block min-h-[44px] sm:min-h-0 flex items-center">
                  Find Opportunities
                </Link>
              </li>
              <li>
                <Link to="/map" className="text-foreground/70 hover:text-foreground transition-colors font-light inline-block min-h-[44px] sm:min-h-0 flex items-center">
                  Map View
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-muted-foreground mb-4 sm:mb-6">Resources</h3>
            <ul className="space-y-3 sm:space-y-4 text-sm">
              <li>
                <Link to="/contact" className="text-foreground/70 hover:text-foreground transition-colors font-light inline-block min-h-[44px] sm:min-h-0 flex items-center">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-foreground/70 hover:text-foreground transition-colors font-light inline-block min-h-[44px] sm:min-h-0 flex items-center">
                  Terms
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-foreground/70 hover:text-foreground transition-colors font-light inline-block min-h-[44px] sm:min-h-0 flex items-center">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-muted-foreground mb-4 sm:mb-6">Connect</h3>
            <ul className="space-y-3 sm:space-y-4 text-sm">
              <li>
                <a
                  href="mailto:support@clinicalhours.org"
                  className="text-foreground/70 hover:text-foreground transition-colors font-light inline-block min-h-[44px] sm:min-h-0 flex items-center break-all sm:break-normal"
                >
                  <span className="hidden sm:inline">support@clinicalhours.org</span>
                  <span className="sm:hidden">Email Us</span>
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com/company/clinicalhours"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground/70 hover:text-foreground transition-colors font-light inline-block min-h-[44px] sm:min-h-0 flex items-center"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 md:mt-20 pt-6 sm:pt-8 border-t border-border text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-[0.15em] sm:tracking-[0.2em]">
            &copy; {new Date().getFullYear()} <span>Clinical</span><span className="font-semibold">Hours</span>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
