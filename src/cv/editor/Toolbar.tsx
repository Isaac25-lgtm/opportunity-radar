import { ChevronDown, Download, FileDown, History, LayoutGrid, Loader2, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui';

/** Bottom bar of the preview pane: templates, tailoring, history and downloads. */
export function Toolbar({
  onTemplates,
  onHistory,
  onTailor,
  onExport,
  exporting,
  menu,
  setMenu,
}: {
  onTemplates: () => void;
  onHistory: () => void;
  onTailor: () => void;
  onExport: (f: 'pdf' | 'docx') => void;
  exporting: null | 'pdf' | 'docx';
  menu: boolean;
  setMenu: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-ink-600 px-6 py-3">
      <div className="flex items-center gap-1">
        <button
          onClick={onTemplates}
          className="flex items-center gap-2 rounded px-3 py-2 text-[15px] font-semibold text-white hover:bg-white/10"
        >
          <LayoutGrid className="h-5 w-5" /> Select template
        </button>
        <button
          onClick={onTailor}
          className="hidden items-center gap-2 rounded px-3 py-2 text-[15px] font-semibold text-white hover:bg-white/10 sm:flex"
        >
          <Sparkles className="h-5 w-5" /> Tailor
        </button>
        <button
          onClick={onHistory}
          className="flex items-center gap-2 rounded px-3 py-2 text-[15px] font-semibold text-white hover:bg-white/10"
          aria-label="Version history"
        >
          <History className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex">
        <Button loading={exporting === 'pdf'} onClick={() => onExport('pdf')} className="rounded-r-none">
          Download PDF
        </Button>
        <Button
          onClick={() => setMenu(!menu)}
          className="rounded-l-none border-l border-brand-600 px-3"
          aria-label="More download options"
          aria-expanded={menu}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        {menu && (
          <div className="absolute bottom-full right-0 mb-2 w-56 overflow-hidden rounded-lg bg-white py-1 shadow-paper">
            <button
              onClick={() => onExport('docx')}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-ink-50"
            >
              {exporting === 'docx' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}{' '}
              Download Word (.docx)
            </button>
            <button
              onClick={() => onExport('pdf')}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-ink-50"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
