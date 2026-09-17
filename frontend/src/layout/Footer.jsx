import React from 'react';

/**
 * cPanel Official Jupiter Theme Footer
 * Left: cPanel version (orange cPanel + version string)
 * Right: Home | Trademarks | Privacy Policy | Documentation | Give Feedback
 */
export default function Footer({
  version = '136.0.40',
  onNavigate,
  className = ''
}) {
  return (
    <footer 
      aria-label="cPanel Footer"
      className={`bg-transparent py-6 px-6 text-[12px] border-t border-[#e3e5e8] mt-8 ${className}`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
        {/* Left: cPanel Logo + Version */}
        <div className="flex items-center space-x-1.5 select-none">
          <span className="font-extrabold text-[15px] tracking-tight text-[#ff6c2c]">
            cPanel
          </span>
          <span className="text-[#8c959f] font-mono text-[11px]">
            {version}
          </span>
        </div>

        {/* Right: Legal & Resource Links */}
        <nav aria-label="Footer links" className="flex flex-wrap items-center justify-center gap-4 text-[#0b69a3] text-[12px]">
          <button 
            type="button"
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="hover:underline cursor-pointer"
          >
            Home
          </button>
          <a href="#trademarks" onClick={(e) => { e.preventDefault(); alert('cPanel® and Jupiter™ are trademarks of cPanel, L.L.C.'); }} className="hover:underline">
            Trademarks
          </a>
          <a href="#privacy" onClick={(e) => { e.preventDefault(); alert('Privacy Policy: All hosting data is processed locally with strict multi-tenant isolation.'); }} className="hover:underline">
            Privacy Policy
          </a>
          <a href="#docs" onClick={(e) => { e.preventDefault(); alert('cPanel Documentation: Visit docs.cpanel.net for complete guides and API specifications.'); }} className="hover:underline">
            Documentation
          </a>
          <a href="#feedback" onClick={(e) => { e.preventDefault(); alert('Give Feedback: Feedback portal is open for hosting administrators.'); }} className="hover:underline">
            Give Feedback
          </a>
        </nav>
      </div>
    </footer>
  );
}
