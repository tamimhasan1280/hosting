import React, { useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, Rocket, Bot, Globe, ShoppingCart, 
  MessageSquare, FileText, CreditCard, Building, Server, Terminal,
  BookOpen, Image, Users, Calendar, Gamepad2, Mail, BarChart2
} from 'lucide-react';

/**
 * Reusable Softaculous Apps Installer Section component
 * Displays Scripts carousel and Categories carousel with horizontal scrolling and arrows.
 */
export default function SoftaculousSection({ onSelectApp, onSelectCategory, className = '' }) {
  const scriptsScrollRef = useRef(null);
  const catsScrollRef = useRef(null);

  const scripts = [
    { id: 'ai', name: 'Code with AI', icon: Bot, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { id: 'wordpress', name: 'WordPress', icon: Globe, color: 'text-blue-700', bg: 'bg-blue-50' },
    { id: 'joomla', name: 'Joomla', icon: Globe, color: 'text-orange-600', bg: 'bg-orange-50' },
    { id: 'abantecart', name: 'AbanteCart', icon: ShoppingCart, color: 'text-sky-600', bg: 'bg-sky-50' },
    { id: 'phpbb', name: 'phpBB', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'smf', name: 'SMF', icon: MessageSquare, color: 'text-slate-700', bg: 'bg-slate-100' },
    { id: 'whmcs', name: 'WHMCS', icon: CreditCard, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { id: 'realestate', name: 'Open Real Estate', icon: Building, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'mybb', name: 'MyBB', icon: MessageSquare, color: 'text-red-600', bg: 'bg-red-50' },
    { id: 'laravel', name: 'Laravel', icon: Terminal, color: 'text-rose-600', bg: 'bg-rose-50' }
  ];

  const categories = [
    { id: 'blogs', name: 'Blogs', icon: FileText },
    { id: 'portals', name: 'Portals/CMS', icon: Globe },
    { id: 'forums', name: 'Forums', icon: MessageSquare },
    { id: 'galleries', name: 'Image Galleries', icon: Image },
    { id: 'wikis', name: 'Wikis', icon: BookOpen },
    { id: 'social', name: 'Social Networking', icon: Users },
    { id: 'ads', name: 'Ad Management', icon: BarChart2 },
    { id: 'calendars', name: 'Calendars', icon: Calendar },
    { id: 'gaming', name: 'Gaming', icon: Gamepad2 },
    { id: 'mails', name: 'Mails', icon: Mail },
    { id: 'polls', name: 'Polls/Analytics', icon: BarChart2 }
  ];

  const scroll = (ref, dir) => {
    if (ref.current) {
      const scrollAmount = dir === 'left' ? -220 : 220;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section 
      aria-labelledby="softaculous-section-title"
      className={`bg-white border border-[#e3e5e8] rounded-[4px] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden text-left ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-2.5 bg-white border-b border-[#edf0f2] flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <Rocket className="w-4 h-4 text-[#ff6c2c] stroke-[2]" aria-hidden="true" />
          <h2 id="softaculous-section-title" className="text-[14px] font-semibold text-[#1f2533]">
            Softaculous Apps Installer
          </h2>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Scripts Carousel */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-[#1f2533]">Scripts:</span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => scroll(scriptsScrollRef, 'left')}
                aria-label="Previous scripts"
                className="p-1 border border-[#e3e5e8] hover:bg-slate-100 rounded text-slate-600 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scroll(scriptsScrollRef, 'right')}
                aria-label="Next scripts"
                className="p-1 border border-[#e3e5e8] hover:bg-slate-100 rounded text-slate-600 transition cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div 
            ref={scriptsScrollRef}
            className="flex items-center space-x-4 overflow-x-auto pb-2 scrollbar-none no-scrollbar select-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {scripts.map((app) => {
              const IconComp = app.icon;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => onSelectApp && onSelectApp(app.id)}
                  className="flex flex-col items-center shrink-0 w-20 group cursor-pointer text-center outline-none focus:ring-1 focus:ring-[#0b69a3] rounded p-1"
                >
                  <div className={`w-12 h-12 rounded-[6px] ${app.bg} border border-[#e3e5e8] group-hover:border-[#0b69a3] group-hover:shadow-sm flex items-center justify-center mb-1.5 transition`}>
                    <IconComp className={`w-6 h-6 ${app.color} group-hover:scale-105 transition-transform`} />
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 group-hover:text-[#0b69a3] truncate max-w-full leading-tight">
                    {app.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Categories Carousel */}
        <div className="pt-2 border-t border-[#edf0f2]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-[#1f2533]">Categories:</span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => scroll(catsScrollRef, 'left')}
                aria-label="Previous categories"
                className="p-1 border border-[#e3e5e8] hover:bg-slate-100 rounded text-slate-600 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scroll(catsScrollRef, 'right')}
                aria-label="Next categories"
                className="p-1 border border-[#e3e5e8] hover:bg-slate-100 rounded text-slate-600 transition cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div 
            ref={catsScrollRef}
            className="flex items-center space-x-4 overflow-x-auto pb-2 scrollbar-none no-scrollbar select-none"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {categories.map((cat) => {
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory && onSelectCategory(cat.id)}
                  className="flex flex-col items-center shrink-0 w-20 group cursor-pointer text-center outline-none focus:ring-1 focus:ring-[#0b69a3] rounded p-1"
                >
                  <div className="w-10 h-10 rounded-[6px] bg-slate-50 border border-[#e3e5e8] group-hover:border-[#0b69a3] group-hover:bg-white flex items-center justify-center mb-1.5 transition">
                    <IconComp className="w-5 h-5 text-indigo-900 group-hover:text-[#0b69a3] transition-colors" />
                  </div>
                  <span className="text-[10px] text-slate-600 group-hover:text-[#0b69a3] truncate max-w-full leading-tight">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
