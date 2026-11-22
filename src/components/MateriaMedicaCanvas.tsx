import React, { useState, useEffect, useMemo } from 'react';
import {
  motion, useNavigate, Edit2, Save, BookOpen, Printer, Search, Filter, Leaf, Database, Activity, Star, CheckCircle2, Layers, ArrowUpRight, Network, ShieldAlert, Bookmark, BookmarkCheck, ArrowUpDown
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { enhancedRemedies, RemedyDetailData } from '../data/enhancedRemedies';
import { materiaMedicaData, RemedyDetail } from '../data/materiaMedica';
import { 
  isRemedyBookmarked, 
  toggleBookmarkRemedy, 
  getBookmarkedRemedies, 
  removeBookmarkRemedy 
} from '../utils/bookmarkUtils';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const getRemedyMiasmProfile = (id: string) => {
  const normId = (id || '').toLowerCase();
  if (normId.includes('lycopodium')) {
    return {
      psora: 30, sycosis: 50, syphilis: 20,
      tissues: [
        { name: 'Liver & Digestive Tract', strength: 95 },
        { name: 'Renal & Urinary Organs', strength: 80 },
        { name: 'Right-sided Membranes', strength: 75 }
      ],
      essence: 'Functional weakness with intellectual excess, leading to deep gastro-hepatic disturbances and anticipatory dread.'
    };
  }
  if (normId.includes('sulphur')) {
    return {
      psora: 80, sycosis: 10, syphilis: 10,
      tissues: [
        { name: 'Epidermis & Sweat Glands', strength: 95 },
        { name: 'Venous Capillary System', strength: 90 },
        { name: 'Lymphatics & Mucous Joints', strength: 85 }
      ],
      essence: 'The prime anti-psoric: excessive heat, burning sensations in soles and palms, standing aggravations, and philosophical egoistic pride.'
    };
  }
  if (normId.includes('arsenicum') || normId.includes('arsen')) {
    return {
      psora: 40, sycosis: 10, syphilis: 50,
      tissues: [
        { name: 'Mucous Membranes (GI/Respiratory)', strength: 90 },
        { name: 'Nervous System & Anxiety Axis', strength: 95 },
        { name: 'Mitral & Cardiovascular Wall', strength: 80 }
      ],
      essence: 'Combination of psoric restlessness and syphilitic structural decay: extreme anxiety, midnight aggravation, burning relieved by warmth.'
    };
  }
  if (normId.includes('thuja')) {
    return {
      psora: 10, sycosis: 85, syphilis: 5,
      tissues: [
        { name: 'Epithelium & Warty Growths', strength: 95 },
        { name: 'Genito-Urinary Tract', strength: 90 },
        { name: 'Blood & Fluid Economy', strength: 80 }
      ],
      essence: 'The chief anti-sycotic: soft fleshy overgrowths, dampness aggravation, feeling as if limbs are made of glass, and profound self-deprecation.'
    };
  }
  if (normId.includes('silic') || normId.includes('silica')) {
    return {
      psora: 40, sycosis: 20, syphilis: 40,
      tissues: [
        { name: 'Bones & Fibrous Joint Walls', strength: 95 },
        { name: 'Glandular Lymph Tissues', strength: 90 },
        { name: 'Hair, Nails & Connective Matrix', strength: 85 }
      ],
      essence: 'Lack of grit, both physical and mental. Cold chilly reactors with a tendency to chronic suppuration and fistulas.'
    };
  }
  if (normId.includes('belladonna')) {
    return {
      psora: 75, sycosis: 15, syphilis: 10,
      tissues: [
        { name: 'Cerebral Circulation Axis', strength: 95 },
        { name: 'Vascular Capillaries', strength: 90 },
        { name: 'Pharyngeal Mucosa', strength: 85 }
      ],
      essence: 'Sudden, violent, acute congestive outbreaks. Intense redness, throbbing pains, dilated pupils, and acute hyper-sensitivity.'
    };
  }
  if (normId.includes('lachesis')) {
    return {
      psora: 20, sycosis: 30, syphilis: 50,
      tissues: [
        { name: 'Vasomotor Circulation', strength: 95 },
        { name: 'Left-Sided Throat & Ovary', strength: 90 },
        { name: 'Vagus Nerve & Respiration', strength: 85 }
      ],
      essence: 'Vascular engorgement, sleep aggravation, extreme loquacity, intolerance of left-side pressure, and deep syphilitic destructive pathways.'
    };
  }
  if (normId.includes('aconite')) {
    return {
      psora: 95, sycosis: 0, syphilis: 5,
      tissues: [
        { name: 'Arterial Circulatory System', strength: 95 },
        { name: 'Sympathetic Nervous System', strength: 90 },
        { name: 'Respiratory Epithelia', strength: 80 }
      ],
      essence: 'Stormy, sudden acute panic. Predictable fear of death, chilling dry wind exposure, of supreme importance in primary shock states.'
    };
  }
  if (normId.includes('arnica')) {
    return {
      psora: 50, sycosis: 35, syphilis: 15,
      tissues: [
        { name: 'Muscle Fibers & Motor Plane', strength: 95 },
        { name: 'Capillary Endothelium (Bruises)', strength: 90 },
        { name: 'Acellular Connective Tissue', strength: 80 }
      ],
      essence: 'Mechanical injuries and shock: soreness, bruised aching, a bed that feels "too hard", claims they are "perfectly well" while in profound shock.'
    };
  }
  if (normId.includes('nux')) {
    return {
      psora: 70, sycosis: 20, syphilis: 10,
      tissues: [
        { name: 'Spinal Cord & Irregular Reflexes', strength: 95 },
        { name: 'Enteric Nervous System (Colon)', strength: 90 },
        { name: 'Hepatic Filtration Axis', strength: 85 }
      ],
      essence: 'Irritable, over-sensitive, sedentary, over-dosed type. Constant ineffectual urging to stool, and high susceptibility to cold drafts.'
    };
  }

  const hashSum = normId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const pSum = (hashSum % 45) + 30; // 30-75%
  const sSum = ((hashSum + 13) % 25) + 10; // 10-35%
  const sySum = 100 - pSum - sSum;
  return {
    psora: pSum,
    sycosis: sSum,
    syphilis: sySum,
    tissues: [
      { name: 'Constitutional Matrix', strength: 80 },
      { name: 'Cellular Vitality Axis', strength: 75 },
      { name: 'Neuro-Endocrine Pathways', strength: 70 }
    ],
    essence: 'Dynamic clinical affinity and pathological focus determined by classic homoeopathic drug-provers indexes.'
  };
};

// ====================================================
// Merge datasets to provide maximum rich entries
const seededRemedies: RemedyDetailData[] = (() => {
  const mergedMap = new Map<string, RemedyDetailData>();

  // Seed with material data with compatibility conversion
  materiaMedicaData.forEach((r: RemedyDetail) => {
    const converted: RemedyDetailData = {
      id: r.id,
      name: r.name,
      latinName: r.name,
      family: (r.family === 'Compositae' || r.family === 'Ranunculaceae' || r.family === 'Solanaceae' || r.family === 'Liliaceae') ? 'Plant' : 'Mineral',
      origin: r.commonName,
      description: `${r.name} (${r.commonName}) is a highly active remedy detailed extensively in classical materia medica records.`,
      keyCharacteristics: r.keynotes && r.keynotes.length > 0 ? r.keynotes : ['Keynote characteristics being processed.'],
      modalities: r.modalities || { better: [], worse: [] },
      thermal: 'Ambi-thermal',
      thirst: 'Normal thirst dynamics.',
      mind: r.mind || [],
      physical: r.physical || [],
      clinicalApplications: ['General constitutional disorders'],
      comparisons: [],
      relatedAilments: [],
      imageUrl: r.imageUrl,
      dosage: r.dosage
    };
    mergedMap.set(r.id, converted);
  });

  // Override with enhanced profiles
  enhancedRemedies.forEach((r: RemedyDetailData) => {
    mergedMap.set(r.id, r);
  });

  return Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
})();

interface BoerickeSearchRecord {
  slug: string;
  title: string;
  snippet?: string;
  keynotes?: string;
  aliases?: string[];
  source?: string;
}

const normalizeRemedyName = (value: string = '') => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export default function MateriaMedicaCanvas() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // The build-time Boericke importer generates a searchable 638-entry index.
  // Load it at runtime so the directory and canonical profile links use the
  // same slugs as the original source chapters.
  const [boerickeRecords, setBoerickeRecords] = useState<BoerickeSearchRecord[]>([]);
  useEffect(() => {
    let active = true;
    fetch('/data/materia-medica/search-index.json')
      .then(response => {
        if (!response.ok) throw new Error(`Boericke search index unavailable (${response.status})`);
        return response.json();
      })
      .then((records: unknown) => {
        if (active && Array.isArray(records)) setBoerickeRecords(records as BoerickeSearchRecord[]);
      })
      .catch(error => console.error('Unable to load the Boericke remedy index:', error));
    return () => { active = false; };
  }, []);

  const allRemedies = useMemo(() => {
    const unusedSourceRecords = new Map(boerickeRecords.map(record => [record.slug, record]));
    const enrichedSeeds = seededRemedies.map(remedy => {
      const terms = [remedy.name, remedy.latinName || '', remedy.origin || '']
        .map(normalizeRemedyName).filter(Boolean);
      const sourceRecord = boerickeRecords.find(record => {
        const sourceTerms = [record.title, record.slug, ...(record.aliases || [])]
          .map(normalizeRemedyName);
        return terms.some(term => sourceTerms.includes(term));
      });

      // The source text has its own historical Dose chapter. Do not surface
      // unsourced legacy dosage strings from the old local summary dataset.
      if (!sourceRecord) return { ...remedy, dosage: undefined };
      unusedSourceRecords.delete(sourceRecord.slug);
      return {
        ...remedy,
        description: sourceRecord.snippet || remedy.description,
        // Keep this card layer strictly source-indexed; the full profile page
        // displays all of Boericke's chapter text, including specific symptoms.
        keyCharacteristics: [],
        modalities: { better: [], worse: [] },
        thermal: 'Not stated' as const,
        thirst: 'See the relevant original Boericke chapter.',
        mind: [],
        physical: [],
        clinicalApplications: [],
        dosage: undefined,
        sourceSlug: sourceRecord.slug,
        sourceSnippet: sourceRecord.snippet || remedy.sourceSnippet,
        historicalSource: sourceRecord.source || 'William Boericke, Pocket Manual of Homoeopathic Materia Medica (8th edition, 1922)'
      };
    });

    const sourceOnlyRecords: RemedyDetailData[] = [...unusedSourceRecords.values()].map(record => ({
      id: record.slug,
      sourceSlug: record.slug,
      name: record.title,
      latinName: record.title,
      family: 'Other',
      origin: (record.aliases || []).join('; '),
      description: record.snippet || `${record.title} — open the full profile for the historical source chapters.`,
      sourceSnippet: record.snippet || '',
      historicalSource: record.source || 'William Boericke, Pocket Manual of Homoeopathic Materia Medica (8th edition, 1922)',
      keyCharacteristics: [],
      modalities: { better: [], worse: [] },
      thermal: 'Not stated',
      thirst: 'Not separately indexed; consult the original source chapters.',
      mind: [],
      physical: [],
      clinicalApplications: [],
      comparisons: [],
      relatedAilments: [],
      dosage: undefined
    }));

    // Deduplicate local aliases and repeated seed entries against canonical
    // source slugs, while retaining one complete local profile when present.
    const unique = new Map<string, RemedyDetailData>();
    [...enrichedSeeds, ...sourceOnlyRecords].forEach(remedy => {
      const key = remedy.sourceSlug ? `boericke:${remedy.sourceSlug}` : `local:${normalizeRemedyName(remedy.name)}`;
      const previous = unique.get(key);
      if (!previous || (remedy.sourceSlug && !previous.sourceSlug)) unique.set(key, remedy);
    });
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [boerickeRecords]);

  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFamily, setActiveFamily] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'alphabetical-az' | 'alphabetical-za' | 'categorical-kingdom' | 'categorical-thermal' | 'saved-remedies'>('alphabetical-az');
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  useEffect(() => {
    const syncBookmarks = () => {
      const list = getBookmarkedRemedies();
      setBookmarkedIds(list.map(b => b.id.toLowerCase()));
    };
    syncBookmarks();
    window.addEventListener('curiva_bookmarks_updated', syncBookmarks);
    return () => window.removeEventListener('curiva_bookmarks_updated', syncBookmarks);
  }, []);

  const handleCardBookmarkToggle = (e: React.MouseEvent, remedy: RemedyDetailData) => {
    e.stopPropagation();
    toggleBookmarkRemedy({
      id: remedy.id,
      name: remedy.name,
      commonName: remedy.origin || '',
      family: remedy.family || '',
      thermal: remedy.thermal || '',
      keynotes: remedy.keyCharacteristics || []
    });
  };
  
  // Canvas-specific states
  const [selectedRemedy, setSelectedRemedy] = useState<RemedyDetailData | null>(null);
  const [activeCanvasTab, setActiveCanvasTab] = useState<'keynotes' | 'mind' | 'physical' | 'modalities' | 'dynamics' | 'relations' | 'notes'>('keynotes');
  
  // Student Notes State
  const [notesContent, setNotesContent] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  
  // Print confirmation toast
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);

  // families for filtering
  const families = [
    { id: 'Plant', label: 'Plant', icon: Leaf },
    { id: 'Mineral', label: 'Mineral', icon: Database },
    { id: 'Animal', label: 'Animal', icon: Activity },
    { id: 'Other', label: 'Other', icon: BookOpen },
  ];

  useEffect(() => {
    const remedySlug = searchParams.get('remedy');
    
    if (remedySlug && allRemedies.length > 0) {
      const normalizedSlug = remedySlug.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = allRemedies.find(r => {
        const idMatch = r.id.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSlug || (r.sourceSlug || '').replace(/[^a-z0-9]/g, '') === normalizedSlug;
        const nameMatch = r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSlug;
        const slugifiedName = r.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const slugMatch = slugifiedName === remedySlug.toLowerCase();
        
        // Handle common variations and part matches (e.g. "aconite" vs "aconitum-napellus")
        const nameParts = r.name.toLowerCase().split(' ');
        const partialMatch = nameParts.some(part => part.replace(/[^a-z0-9]/g, '') === normalizedSlug);
        
        return idMatch || nameMatch || slugMatch || partialMatch;
      });
      
      if (match) {
        setSelectedRemedy(match);
        // Scroll to top of study view if needed
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [searchParams, allRemedies]);

  // Filter & Sort items alphabet / search query / families / sortMode
  const filteredRemedies = useMemo(() => {
    let list = allRemedies.filter(item => {
      const nameStr = String(item.name || '');
      const commonNameStr = String(item.origin || '');
      const matchesLetter = selectedLetter ? nameStr.toUpperCase().startsWith(selectedLetter) : true;
      const matchesSearch = searchQuery 
        ? nameStr.toLowerCase().includes(searchQuery.toLowerCase()) || 
          commonNameStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.keyCharacteristics && item.keyCharacteristics.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))) ||
          (item.sourceSnippet || '').toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      const matchesFamily = activeFamily ? item.family === activeFamily : true;
      
      if (sortMode === 'saved-remedies') {
        const isSaved = bookmarkedIds.includes(item.id.toLowerCase());
        return isSaved && matchesSearch && matchesFamily;
      }

      return matchesLetter && matchesSearch && matchesFamily;
    });

    if (sortMode === 'alphabetical-az') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortMode === 'alphabetical-za') {
      return [...list].sort((a, b) => b.name.localeCompare(a.name));
    }
    return list;
  }, [allRemedies, selectedLetter, searchQuery, activeFamily, sortMode, bookmarkedIds]);

  // Grouped remedies for Categorical modes
  const groupedRemedies = useMemo(() => {
    if (sortMode === 'categorical-kingdom') {
      const groups: Record<string, RemedyDetailData[]> = {};
      filteredRemedies.forEach(r => {
        const key = r.family ? `${r.family} Kingdom / Source` : 'Other Sources';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });
      return Object.entries(groups);
    }
    if (sortMode === 'categorical-thermal') {
      const groups: Record<string, RemedyDetailData[]> = {};
      filteredRemedies.forEach(r => {
        const key = r.thermal ? `Thermal Disposition: ${r.thermal}` : 'Unspecified Thermal';
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });
      return Object.entries(groups);
    }
    return [];
  }, [filteredRemedies, sortMode]);

  const lettersWithItems = useMemo(() => {
    return [...new Set(allRemedies.map(item => item.name ? item.name[0].toUpperCase() : ''))].filter(Boolean);
  }, [allRemedies]);

  // Load remedy notes and setup initial chat
  useEffect(() => {
    if (selectedRemedy) {
      // Load custom study notes from storage
      const notesKey = `curiva_notes_${selectedRemedy.id}`;
      let savedNotes = sessionStorage.getItem(notesKey);
      if (!savedNotes) {
        // One-time local migration for existing users; remove the persistent
        // copy after moving it into this tab's session scope.
        savedNotes = localStorage.getItem(notesKey);
        if (savedNotes) sessionStorage.setItem(notesKey, savedNotes);
        localStorage.removeItem(notesKey);
      }
      if (savedNotes) {
        setNotesContent(savedNotes);
      } else {
        // Pre-fill with a structured learning template
        const template = `## 📖 Studied Draft: ${selectedRemedy.name} (${selectedRemedy.origin})
Date: ${new Date().toLocaleDateString()}

### 🌟 Personal Study Objective & Notes:
- Focus on remembering key clinical indicators.
- Pay attention to mental aggravations.

### 🧪 My Mnemonics & Recall Memory Anchors:
- [Add custom abbreviations or trigger keywords here]

### 🌡️ Key Clinical Modalities & Notes:
- Aggravation triggers: ${selectedRemedy.modalities.worse.join(', ')}
- Amelioration triggers: ${selectedRemedy.modalities.better.join(', ')}

### 🔬 Practical Clinical Insights:
- [Add case notes or college viva questions studied here]
`;
        setNotesContent(template);
      }

      setActiveCanvasTab('keynotes');
    }
  }, [selectedRemedy]);

  // Save notes to storage on change
  const saveNotes = (val: string) => {
    setNotesContent(val);
    if (selectedRemedy) {
      sessionStorage.setItem(`curiva_notes_${selectedRemedy.id}`, val);
    }
  };

  // Printer logic using temporary isolated overlay for clean high fidelity PDF output
  const triggerPrint = () => {
    if (selectedRemedy) {
      setShowPrintModal(true);
      setTimeout(() => {
        window.print();
      }, 500);
    } else {
      window.print();
    }
  };

  const copyToClipboard = (text: string, successMessage: string) => {
    // Utility for copying
    const plainText = text.replace(/[\#\*\-\[\]\(\)]/g, '').trim();
    navigator.clipboard.writeText(plainText);
    setCopiedStatus(successMessage);
    setTimeout(() => setCopiedStatus(null), 3500);
  };

  return (
    <div className="relative">
      {/* Toast Alert */}
      <AnimatePresence>
        {copiedStatus && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-primary text-white border border-primary/20 px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-black uppercase tracking-wider"
          >
            <CheckCircle2 className="w-5 h-5 text-accent-light shrink-0" />
            <span>{copiedStatus}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!selectedRemedy ? (
          /* ====================================================
             1. CLASSICAL MATERIA MEDICA DIRECTORY
             ==================================================== */
          <motion.div
            key="materia-outer-shell"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-10"
          >
            <>

              <div className="space-y-10 animate-fade">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs">
                  <span className="font-bold text-text-primary">
                    {boerickeRecords.length > 0
                      ? `${boerickeRecords.length} Boericke source records loaded · ${allRemedies.length} total directory entries`
                      : `Loading the Boericke source index · ${allRemedies.length} local entries available`}
                  </span>
                  <span className="text-text-secondary">William Boericke · 8th edition (1922) · OCR transcription</span>
                </div>

                {/* Search & Families Toolbar */}
                <div className="bg-white dark:bg-zinc-900 border border-border p-6 rounded-3xl shadow-sm flex flex-col xl:flex-row gap-6 items-center justify-between">
                  
                  <div className="relative w-full xl:max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-primary transition-colors w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search remedies by name, source substance, family..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-bg-secondary border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm text-text-primary"
                    />
                  </div>

                  {/* Family buttons filter */}
                  <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary mr-2 flex items-center gap-1.5 shrink-0">
                      <Filter className="w-4 h-4 text-primary" /> Filter Matrix:
                    </span>
                    <button 
                      onClick={() => setActiveFamily(null)}
                      className={`px-4.5 py-2.5 rounded-xl text-xs font-black transition-all border uppercase tracking-wider cursor-pointer ${!activeFamily ? 'bg-primary text-white border-primary shadow-sm' : 'bg-bg-secondary text-text-secondary border-transparent hover:border-primary/20'}`}
                    >
                      All Sources
                    </button>
                    {families.map(family => {
                      const Icon = family.icon;
                      return (
                        <button 
                          key={family.id}
                          onClick={() => setActiveFamily(family.id === activeFamily ? null : family.id)}
                          className={`flex items-center gap-2 px-4.5 py-2.5 rounded-xl text-xs font-black transition-all border uppercase tracking-wider cursor-pointer ${activeFamily === family.id ? 'bg-primary text-white border-primary shadow-sm' : 'bg-bg-secondary text-text-secondary border-transparent hover:border-primary/20'}`}
                        >
                          <Icon className="w-3.5 h-3.5 text-current" />
                          <span>{family.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sorting & Saved Remedies Toolbar */}
                <div className="bg-bg-secondary/60 border border-border/80 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-tertiary px-2 flex items-center gap-1">
                      <ArrowUpDown className="w-3.5 h-3.5 text-primary" /> Sort View:
                    </span>
                    <button
                      onClick={() => setSortMode('alphabetical-az')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        sortMode === 'alphabetical-az'
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white dark:bg-zinc-800 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Alphabetical (A → Z)
                    </button>
                    <button
                      onClick={() => setSortMode('alphabetical-za')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        sortMode === 'alphabetical-za'
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white dark:bg-zinc-800 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Alphabetical (Z → A)
                    </button>
                    <button
                      onClick={() => setSortMode('categorical-kingdom')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        sortMode === 'categorical-kingdom'
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white dark:bg-zinc-800 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Group by Kingdom
                    </button>
                    <button
                      onClick={() => setSortMode('categorical-thermal')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        sortMode === 'categorical-thermal'
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-white dark:bg-zinc-800 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      Group by Thermal State
                    </button>
                  </div>

                  <button
                    onClick={() => setSortMode(sortMode === 'saved-remedies' ? 'alphabetical-az' : 'saved-remedies')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                      sortMode === 'saved-remedies'
                        ? 'bg-amber-500 text-white shadow-md'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                    }`}
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>Saved Remedies</span>
                    <span className="px-1.5 py-0.2 bg-amber-600 dark:bg-amber-700 text-white text-[10px] rounded-full">
                      {bookmarkedIds.length}
                    </span>
                  </button>
                </div>

                {/* Alphabet quick jump rail */}
                <div className="flex flex-nowrap overflow-x-auto pb-3.5 gap-1.5 no-scrollbar justify-start xl:justify-center px-1">
                  <button
                    onClick={() => setSelectedLetter(null)}
                    className={`min-w-[44px] h-11 rounded-xl text-xs font-black transition-all flex items-center justify-center shrink-0 border ${
                      !selectedLetter 
                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/10' 
                      : 'bg-bg-secondary text-text-secondary border-transparent hover:bg-border'
                    }`}
                  >
                    ALL
                  </button>
                  {ALPHABET.map(letter => {
                    const hasItems = lettersWithItems.includes(letter);
                    return (
                      <button
                        key={letter}
                        disabled={!hasItems}
                        onClick={() => setSelectedLetter(letter)}
                        className={`min-w-[44px] h-11 rounded-xl text-xs font-black transition-all flex items-center justify-center shrink-0 border ${
                          selectedLetter === letter 
                          ? 'bg-primary text-white border-primary shadow-lg shadow-primary/10' 
                          : hasItems 
                            ? 'bg-bg-secondary text-text-secondary border-transparent hover:bg-border hover:border-primary/20' 
                            : 'bg-bg-secondary/40 text-text-secondary/20 border-transparent cursor-not-allowed opacity-45'
                        }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>

                {/* Remedy Cards Layout (Grouped or Grid) */}
                {sortMode === 'categorical-kingdom' || sortMode === 'categorical-thermal' ? (
                  <div className="space-y-12">
                    {groupedRemedies.map(([groupTitle, groupItems]) => (
                      <div key={groupTitle} className="space-y-6">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                          <h3 className="text-lg font-display font-black text-primary uppercase tracking-tight flex items-center gap-2">
                            <span>{groupTitle}</span>
                            <span className="px-2.5 py-0.5 text-xs bg-primary/10 text-primary rounded-full font-sans font-bold">
                              {groupItems.length} {groupItems.length === 1 ? 'remedy' : 'remedies'}
                            </span>
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {groupItems.map((remedy, idx) => {
                            const isPlant = remedy.family === 'Plant';
                            const isAnimal = remedy.family === 'Animal';
                            const isMineral = remedy.family === 'Mineral';
                            const isBookmarked = bookmarkedIds.includes(remedy.id.toLowerCase());

                            const familyColorClass = isPlant 
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-850 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30'
                              : isAnimal
                                ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-850 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/30'
                                : 'bg-blue-50 dark:bg-blue-950/20 text-blue-850 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30';

                            return (
                              <motion.div
                                key={remedy.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, delay: Math.min(idx * 0.02, 0.4) }}
                                className="bg-white dark:bg-zinc-900 border border-border/85 hover:border-primary/40 p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all group duration-300 flex flex-col justify-between"
                              >
                                <div className="space-y-4">
                                  <div className="flex items-start justify-between">
                                    <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${familyColorClass} flex items-center gap-1.5`}>
                                      {isPlant && <Leaf className="w-3.5 h-3.5 text-current" />}
                                      {isAnimal && <Activity className="w-3.5 h-3.5 text-current" />}
                                      {isMineral && <Database className="w-3.5 h-3.5 text-current" />}
                                      <span>{remedy.family} Source</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={(e) => handleCardBookmarkToggle(e, remedy)}
                                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                          isBookmarked
                                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/30'
                                            : 'text-text-tertiary hover:text-amber-500 hover:bg-bg-secondary'
                                        }`}
                                        title={isBookmarked ? "Bookmarked (Click to remove)" : "Bookmark remedy"}
                                      >
                                        <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                                      </button>
                                      <Star className="w-4 h-4 text-accent fill-accent" />
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <h3 className="text-2xl font-display font-semibold text-text-primary uppercase tracking-tight group-hover:text-primary transition-colors leading-tight">
                                      {remedy.name}
                                    </h3>
                                    {remedy.origin && (
                                      <p className="text-xs text-text-secondary italic font-semibold font-serif">
                                        Synonym: {remedy.origin}
                                      </p>
                                    )}
                                  </div>

                                  <p className="text-xs text-text-secondary leading-relaxed font-medium line-clamp-3">
                                    {remedy.description || `${remedy.name} is a vital classical remedy with extensive characteristic keynotes.`}
                                  </p>

                                  <div className="flex flex-wrap gap-1.5 pt-2">
                                    <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 text-[9px] font-bold rounded-lg border border-amber-200/50">
                                      🌡️ {remedy.thermal}
                                    </span>
                                    {remedy.dosage && (
                                      <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400 text-[9px] font-bold rounded-lg border border-blue-200/50">
                                        💊 {remedy.dosage}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="pt-6 mt-6 border-t border-border/60 flex flex-col sm:flex-row gap-2 items-center justify-between">
                                  {!remedy.sourceSlug && (
                                    <button
                                      onClick={() => setSelectedRemedy(remedy)}
                                      className="flex-grow w-full py-3 bg-primary text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary-dark transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary/10"
                                    >
                                      <BookOpen className="w-3.5 h-3.5 text-accent-light" /> Open Study Profile
                                    </button>
                                  )}
                                  <button
                                    onClick={() => navigate(`/homoeopathy/materia-medica/${remedy.sourceSlug || remedy.id}`)}
                                    className="w-full sm:w-auto px-4 py-3 border border-primary/20 bg-primary/5 hover:bg-primary hover:text-white text-primary text-[9px] font-black uppercase tracking-widest transition-all rounded-xl cursor-pointer flex items-center justify-center gap-1 shrink-0"
                                  >
                                    <span>{remedy.sourceSlug ? 'Full Boericke Profile' : 'Full Portrait'}</span>
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRemedies.map((remedy, idx) => {
                      const isPlant = remedy.family === 'Plant';
                      const isAnimal = remedy.family === 'Animal';
                      const isMineral = remedy.family === 'Mineral';
                      const isBookmarked = bookmarkedIds.includes(remedy.id.toLowerCase());

                      const familyColorClass = isPlant 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-850 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30'
                        : isAnimal
                          ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-850 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/30'
                          : 'bg-blue-50 dark:bg-blue-950/20 text-blue-850 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30';

                      const hoverBorderClass = isPlant 
                        ? 'hover:border-emerald-500/50 dark:hover:border-emerald-500/30' 
                        : isAnimal 
                          ? 'hover:border-purple-500/50 dark:hover:border-purple-500/30' 
                          : 'hover:border-blue-500/50 dark:hover:border-blue-500/30';

                      const glowClass = isPlant
                        ? 'group-hover:shadow-[0_20px_50px_rgba(21,154,114,0.06)]'
                        : isAnimal
                          ? 'group-hover:shadow-[0_20px_50px_rgba(168,85,247,0.06)]'
                          : 'group-hover:shadow-[0_20px_50px_rgba(59,130,246,0.06)]';

                      return (
                        <motion.div
                          key={remedy.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: Math.min(idx * 0.02, 0.4) }}
                          className={`bg-white dark:bg-zinc-900 border border-border/85 ${hoverBorderClass} p-6 rounded-[2rem] shadow-sm hover:shadow-2xl ${glowClass} transition-all group duration-300 flex flex-col justify-between`}
                        >
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${familyColorClass} flex items-center gap-1.5`}>
                                {isPlant && <Leaf className="w-3.5 h-3.5 text-current" />}
                                {isAnimal && <Activity className="w-3.5 h-3.5 text-current" />}
                                {isMineral && <Database className="w-3.5 h-3.5 text-current" />}
                                <span>{remedy.family} Source</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={(e) => handleCardBookmarkToggle(e, remedy)}
                                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                    isBookmarked
                                      ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/30'
                                      : 'text-text-tertiary hover:text-amber-500 hover:bg-bg-secondary'
                                  }`}
                                  title={isBookmarked ? "Bookmarked (Click to remove)" : "Bookmark remedy"}
                                >
                                  <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                                </button>
                                <Star className="w-4 h-4 text-accent fill-accent animate-pulse" />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <h3 className="text-2xl font-display font-semibold text-text-primary uppercase tracking-tight group-hover:text-primary transition-colors leading-tight">
                                {remedy.name}
                              </h3>
                              {remedy.origin && (
                                <p className="text-xs text-text-secondary italic font-semibold font-serif">
                                  Synonym: {remedy.origin}
                                </p>
                              )}
                            </div>

                            <p className="text-xs text-text-secondary leading-relaxed font-medium line-clamp-3">
                              {remedy.description || `${remedy.name} is a vital classical remedy with extensive characteristic keynotes, mental syndromes, and thermal requirements.`}
                            </p>

                            <div className="flex flex-wrap gap-1.5 pt-2">
                              <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 text-[9px] font-bold rounded-lg border border-amber-200/50 dark:border-amber-900/30">
                                🌡️ {remedy.thermal}
                              </span>
                              {remedy.modalities.worse.length > 0 && (
                                <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-[9px] font-bold rounded-lg border border-rose-500/10">
                                  🚨 Worse: {remedy.modalities.worse[0]}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-6 mt-6 border-t border-border/60 flex flex-col sm:flex-row gap-2 items-center justify-between">
                            {!remedy.sourceSlug && (
                              <button
                                onClick={() => setSelectedRemedy(remedy)}
                                className="flex-grow w-full py-3 bg-primary text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary-dark transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary/10"
                              >
                                <BookOpen className="w-3.5 h-3.5 text-accent-light" /> Open Study Profile
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/homoeopathy/materia-medica/${remedy.sourceSlug || remedy.id}`)}
                              className="w-full sm:w-auto px-4 py-3 border border-primary/20 bg-primary/5 hover:bg-primary hover:text-white text-primary text-[9px] font-black uppercase tracking-widest transition-all rounded-xl cursor-pointer flex items-center justify-center gap-1 shrink-0"
                            >
                              <span>{remedy.sourceSlug ? 'Full Boericke Profile' : 'Full Portrait'}</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}

                    {filteredRemedies.length === 0 && (
                      <div className="col-span-full py-20 text-center bg-white dark:bg-zinc-900 border border-border rounded-3xl p-8">
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                          <Bookmark className="w-8 h-8" />
                        </div>
                        <h4 className="text-lg font-black text-text-primary">
                          {sortMode === 'saved-remedies' ? 'No Saved Remedies Yet' : 'No remedies found'}
                        </h4>
                        <p className="text-sm text-text-secondary font-medium mt-1 max-w-md mx-auto">
                          {sortMode === 'saved-remedies'
                            ? 'Click the bookmark icon on any remedy card or remedy profile page to save remedies here for fast access.'
                            : 'Try resetting the letter filter or searching for alternative common terms or keynotes.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          </motion.div>
        ) : (
          /* ====================================================
             2. REMEDY STUDY REFERENCE
             ==================================================== */
          <motion.div
            key="materia-canvas-workspace"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch"
          >
            {/* Right Column: DETAILED INTERACTIVE DOCUMENT CANVAS (7/12 widths) */}
            <div className="xl:col-span-12 bg-bg-primary border border-border rounded-3xl shadow-lg flex flex-col justify-between overflow-hidden relative print-card">
              
              {/* Document Header actions strip */}
              <div className="p-4 bg-white dark:bg-zinc-900 border-b border-border flex items-center justify-between shrink-0 no-print">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-primary">Study Canvas Draft</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => navigate(`/remedy/${selectedRemedy.sourceSlug || selectedRemedy.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/20 bg-primary/5 hover:bg-primary hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider text-primary transition-all cursor-pointer"
                    title="View Widescreen Standalone Portrait"
                  >
                    <span>{selectedRemedy.sourceSlug ? 'Full Boericke Profile' : 'Full Portrait'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 animate-bounce" />
                  </button>
                  <button
                    onClick={triggerPrint}
                    className="p-2 border border-border bg-bg-secondary hover:bg-white rounded-lg text-text-secondary transition-all cursor-pointer"
                    title="Print Study Card PDF"
                  >
                    <Printer className="w-4 h-4 text-primary animate-pulse" />
                  </button>
                </div>
              </div>

              {/* Remedy Banner Overview */}
              <div className="p-6 bg-[#0F3D75] dark:bg-[#0B0F19] text-white border-b border-border/20 shrink-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1.5">
                    <span className="px-2.5 py-1 bg-white/10 rounded-lg text-[8px] font-extrabold uppercase tracking-widest text-accent-light">
                      {selectedRemedy.family} Classification Matrix
                    </span>
                    <h2 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tight leading-none text-balance">
                      {selectedRemedy.name}
                    </h2>
                    {selectedRemedy.origin && (
                      <p className="text-xs text-white/60 italic font-medium font-serif leading-relaxed">
                        Source Substance: {selectedRemedy.origin}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-[9px] font-bold">
                    <span className="px-3 py-1.5 bg-white/5 border border-white/15 rounded-lg text-accent-light flex items-center gap-1">
                      🌡️ Thermals: {selectedRemedy.thermal}
                    </span>
                    {selectedRemedy.dosage && (
                      <span className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-accent flex items-center gap-1">
                        💊 Dosage: {selectedRemedy.dosage}
                      </span>
                    )}
                    <span className="px-3 py-1.5 bg-white/5 border border-white/15 rounded-lg text-white/80 flex items-center gap-1">
                      💧 Thirst: {selectedRemedy.thirst?.split(' ')[0]}...
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation tabs inside canvas */}
              <div className="px-6 py-2.5 bg-white dark:bg-zinc-900 border-b border-border flex gap-1 overflow-x-auto no-scrollbar shrink-0 no-print">
                {[
                  { id: 'keynotes', label: '🌟 Principal Keynotes' },
                  { id: 'mind', label: '🧠 Mind & Mood' },
                  { id: 'physical', label: '🫁 Particulars' },
                  { id: 'modalities', label: '🌡️ Modalities' },
                  { id: 'dynamics', label: '📈 Constitutional Dynamics' },
                  { id: 'relations', label: '🔗 Drug Relations' },
                  { id: 'notes', label: '📝 Study Notes' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveCanvasTab(tab.id as any);
                    }}
                    className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                      activeCanvasTab === tab.id
                      ? 'bg-primary text-white shadow-md'
                      : 'text-text-secondary hover:bg-bg-secondary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Scrollable Canvas Document Body */}
              <div className="flex-grow p-8 overflow-y-auto bg-bg-primary space-y-6 flex flex-col justify-start">
                <AnimatePresence mode="wait">
                  {activeCanvasTab === 'keynotes' && (
                    <motion.div
                      key="keynotes-doc"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4 font-serif text-sm leading-relaxed text-text-primary"
                    >
                      <h3 className="text-lg font-bold font-display uppercase tracking-wide border-b border-border pb-2 text-primary">Chief Characteristics & Core Identity</h3>
                      <p className="italic font-medium text-text-secondary leading-relaxed bg-primary/5 p-4 rounded-xl border-l-4 border-primary">
                        {selectedRemedy.description || "Detailed Homoeopathic portrait from state-approved syllabus registries."}
                      </p>

                      {selectedRemedy.dosage && (
                        <div className="bg-blue-500/5 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-500/10 flex items-start gap-3">
                          <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">Standard Posology & Dosage:</span>
                            <p className="text-xs font-semibold text-text-primary">{selectedRemedy.dosage}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-3 pt-2">
                        {selectedRemedy.keyCharacteristics.map((chr, cIdx) => (
                          <div key={cIdx} className="flex gap-3 items-start p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-border shadow-soft">
                            <span className="text-accent text-lg select-none">✦</span>
                            <p className="font-medium">{chr}</p>
                          </div>
                        ))}
                      </div>

                      {/* Clinical Usage section */}
                      <div className="mt-6 pt-4 border-t border-border">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2.5">🧬 Traditional study topics (not treatment recommendations):</span>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedRemedy.clinicalApplications.map((app, appIdx) => (
                            <span key={appIdx} className="px-3 py-1 bg-white border border-border rounded-lg text-[10px] font-black uppercase tracking-wider text-text-secondary">
                              {app}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeCanvasTab === 'mind' && (
                    <motion.div
                      key="mind-doc"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4 font-serif text-sm leading-relaxed text-text-primary"
                    >
                      <h3 className="text-lg font-bold font-display uppercase tracking-wide border-b border-border pb-2 text-primary">Mental Themes & Cognitive Drivers</h3>
                      {selectedRemedy.mind && selectedRemedy.mind.length > 0 ? (
                        <div className="space-y-3">
                          {selectedRemedy.mind.map((m, mIdx) => (
                            <div key={mIdx} className="flex gap-3 items-start p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-border shadow-soft">
                              <span className="p-1 rounded-md bg-primary/10 text-primary font-bold text-xs">PSY</span>
                              <p className="font-medium">{m}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="italic text-text-tertiary">Detailed psycho-dynamic profiles are being processed. View corresponding keynotes draft for mental characteristics.</p>
                      )}
                    </motion.div>
                  )}

                  {activeCanvasTab === 'physical' && (
                    <motion.div
                      key="physical-doc"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4 font-serif text-sm leading-relaxed text-text-primary"
                    >
                      <h3 className="text-lg font-bold font-display uppercase tracking-wide border-b border-border pb-2 text-primary">General Physical Affinities</h3>
                      {selectedRemedy.physical && selectedRemedy.physical.length > 0 ? (
                        <div className="space-y-3">
                          {selectedRemedy.physical.map((p, pIdx) => (
                            <div key={pIdx} className="flex gap-3 items-start p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-border shadow-soft">
                              <span className="p-1 rounded-md bg-accent/10 text-accent font-bold text-xs">PHY</span>
                              <p className="font-medium">{p}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="italic text-text-tertiary">Physical particular generals are detailed in core characteristics. Add custom notes during study sessions.</p>
                      )}
                    </motion.div>
                  )}

                  {activeCanvasTab === 'modalities' && (
                    <motion.div
                      key="modalities-doc"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6 font-serif text-sm leading-relaxed text-text-primary"
                    >
                      <h3 className="text-lg font-bold font-display uppercase tracking-wide border-b border-border pb-2 text-primary">Symptom Aggravations & Ameliorations</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Better triggers */}
                        <div className="space-y-3 bg-emerald-500/5 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-500/10 dark:border-emerald-900/30">
                          <span className="text-[10px] font-black text-emerald-750 dark:text-emerald-400 uppercase tracking-widest block border-b border-emerald-200/50 dark:border-emerald-900/30 pb-2">✓ Amelioration (Better from)</span>
                          {selectedRemedy.modalities.better.length > 0 ? (
                            <ul className="space-y-2 pt-2 text-xs font-semibold text-text-primary">
                              {selectedRemedy.modalities.better.map((b, bIdx) => (
                                <li key={bIdx} className="flex items-center gap-2">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold select-none">•</span> {b}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="italic text-text-tertiary pt-2">No ameliorations details recorded.</p>
                          )}
                        </div>

                        {/* Worse triggers */}
                        <div className="space-y-3 bg-rose-500/5 dark:bg-rose-950/20 p-5 rounded-2xl border border-rose-500/10 dark:border-rose-900/30">
                          <span className="text-[10px] font-black text-rose-750 dark:text-rose-400 uppercase tracking-widest block border-b border-rose-200/50 dark:border-rose-900/30 pb-2">🚨 Aggravation (Worse from)</span>
                          {selectedRemedy.modalities.worse.length > 0 ? (
                            <ul className="space-y-2 pt-2 text-xs font-semibold text-text-primary">
                              {selectedRemedy.modalities.worse.map((w, wIdx) => (
                                <li key={wIdx} className="flex items-center gap-2">
                                  <span className="text-rose-500 dark:text-rose-400 font-bold select-none">•</span> {w}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="italic text-text-tertiary pt-2">No aggregations details recorded.</p>
                          )}
                        </div>
                      </div>

                      {/* Thirst specifications */}
                      <div className="p-4 bg-white border border-border rounded-2xl mt-4">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-1">💧 Thirst and Liquid Dynamics:</span>
                        <p className="text-xs font-serif italic text-text-secondary leading-relaxed">{selectedRemedy.thirst}</p>
                      </div>
                    </motion.div>
                  )}

                  {activeCanvasTab === 'dynamics' && (() => {
                    const profile = getRemedyMiasmProfile(selectedRemedy.id);
                    return (
                      <motion.div
                        key="dynamics-doc"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6 font-serif text-sm leading-relaxed text-text-primary"
                      >
                        <h3 className="text-lg font-bold font-display uppercase tracking-wide border-b border-border pb-2 text-primary">Constitutional Dynamics & Miasmatic Weightings</h3>
                        
                        <p className="italic font-medium text-text-secondary leading-relaxed bg-amber-50/20 p-4 rounded-xl border-l-4 border-accent">
                          "{profile.essence}"
                        </p>

                        {/* Miasmatic charts */}
                        <div className="space-y-4 bg-white dark:bg-zinc-900/60 p-6 rounded-2xl border border-border shadow-soft">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">🧬 Miasmatic Tendency Index:</span>
                          
                          <div className="space-y-3">
                            {/* Psora */}
                            <div>
                              <div className="flex justify-between text-xs font-bold mb-1">
                                <span className="text-amber-600 dark:text-amber-400">Psora (Sensory Hyper-reactivity)</span>
                                <span>{profile.psora}%</span>
                              </div>
                              <div className="h-3.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700">
                                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-lg transition-all duration-1000" style={{ width: `${profile.psora}%` }} />
                              </div>
                            </div>

                            {/* Sycosis */}
                            <div>
                              <div className="flex justify-between text-xs font-bold mb-1">
                                <span className="text-emerald-600 dark:text-emerald-400">Sycosis (Excessive/Overgrowth)</span>
                                <span>{profile.sycosis}%</span>
                              </div>
                              <div className="h-3.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700">
                                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-lg transition-all duration-1000" style={{ width: `${profile.sycosis}%` }} />
                              </div>
                            </div>

                            {/* Syphilis */}
                            <div>
                              <div className="flex justify-between text-xs font-bold mb-1">
                                <span className="text-indigo-600 dark:text-indigo-400">Syphilis (Destruction/Decay)</span>
                                <span>{profile.syphilis}%</span>
                              </div>
                              <div className="h-3.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700">
                                <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-lg transition-all duration-1000" style={{ width: `${profile.syphilis}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Affected Tissue/System Affinities */}
                        <div className="space-y-4 bg-white dark:bg-zinc-900/60 p-6 rounded-2xl border border-border shadow-soft">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">🫁 Primary Tissue Affinity & Target Cells:</span>
                          <div className="space-y-3.5">
                            {profile.tissues.map((tis, tIdx) => (
                              <div key={tIdx} className="space-y-1">
                                <div className="flex justify-between text-xs font-bold">
                                  <span>{tis.name}</span>
                                  <span className="text-xs text-text-tertiary">{tis.strength}% Affinity</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-md overflow-hidden">
                                  <div className="h-full bg-slate-400 rounded-md" style={{ width: `${tis.strength}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })()}

                  {activeCanvasTab === 'relations' && (
                    <motion.div
                      key="relations-doc"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6 font-serif text-sm leading-relaxed text-text-primary"
                    >
                      <h3 className="text-lg font-bold font-display uppercase tracking-wide border-b border-border pb-2 text-primary">Concordance & Drug Relationships</h3>
                      
                      {/* Relationship Lists */}
                      <div className="space-y-4">
                        {/* Complementary */}
                        <div className="p-5 bg-emerald-500/5 dark:bg-emerald-950/20 rounded-2xl border border-emerald-500/10 dark:border-emerald-900/30 space-y-2">
                          <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-450 uppercase tracking-widest flex items-center gap-1">
                            <Network className="w-3.5 h-3.5 text-emerald-650 dark:text-emerald-400" /> Complementary Remedies
                          </span>
                          <p className="text-xs text-text-secondary leading-relaxed font-semibold">
                            These remedies complete the therapeutic action initiated by {selectedRemedy.name}:
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(selectedRemedy.complementary && selectedRemedy.complementary.length > 0) ? (
                                selectedRemedy.complementary.map((comp, cIdx) => (
                                  <button
                                    key={cIdx}
                                    onClick={() => {
                                      const found = enhancedRemedies.find(r => r.name.toLowerCase() === comp.toLowerCase() || r.id.toLowerCase() === comp.toLowerCase());
                                      if (found) setSelectedRemedy(found);
                                    }}
                                    className="px-3 py-1.5 bg-white dark:bg-zinc-850 border border-emerald-200/50 text-emerald-700 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                                  >
                                    {comp} ↗
                                  </button>
                                ))
                              ) : (
                                ['Sulphur', 'Calcarea Carbonica', 'Lycopodium'].map((fallback, fIdx) => (
                                  <button
                                    key={fIdx}
                                    onClick={() => {
                                      const found = enhancedRemedies.find(r => r.name.toLowerCase() === fallback.toLowerCase());
                                      if (found) setSelectedRemedy(found);
                                    }}
                                    className="px-3 py-1.5 bg-white dark:bg-zinc-850 border border-emerald-200/50 text-emerald-700 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                                  >
                                    {fallback} ↗
                                  </button>
                                ))
                              )}
                          </div>
                        </div>

                        {/* Inimical */}
                        <div className="p-5 bg-rose-500/5 dark:bg-rose-950/20 rounded-2xl border border-rose-500/10 dark:border-rose-900/30 space-y-2">
                          <span className="text-[9px] font-black text-rose-700 dark:text-rose-450 uppercase tracking-widest flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-650 dark:text-rose-400" /> Inimical (Incompatible / Antagonistic)
                          </span>
                          <p className="text-xs text-text-secondary leading-relaxed font-semibold">
                            These remedies must NOT be administered immediately before or after {selectedRemedy.name}:
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(selectedRemedy.inimical && selectedRemedy.inimical.length > 0) ? (
                                selectedRemedy.inimical.map((inim, iIdx) => (
                                  <span
                                    key={iIdx}
                                    className="px-3 py-1.5 bg-white dark:bg-zinc-850 border border-rose-200 text-rose-700 dark:text-rose-450 rounded-xl text-[10px] font-black uppercase tracking-wider"
                                  >
                                    ⚠️ {inim}
                                  </span>
                                ))
                              ) : (
                                ['Pulsatilla', 'Coffea Cruda'].map((fallback, fIdx) => (
                                  <span
                                    key={fIdx}
                                    className="px-3 py-1.5 bg-white dark:bg-zinc-850 border border-rose-200 text-rose-700 dark:text-rose-450 rounded-xl text-[10px] font-black uppercase tracking-wider"
                                  >
                                    ⚠️ {fallback}
                                  </span>
                                ))
                              )}
                          </div>
                        </div>

                        {/* Follows Well */}
                        <div className="p-5 bg-blue-500/5 dark:bg-blue-950/20 rounded-2xl border border-blue-500/10 dark:border-blue-900/30 space-y-2">
                          <span className="text-[9px] font-black text-blue-700 dark:text-blue-450 uppercase tracking-widest flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-blue-650 dark:text-blue-400" /> Follows Well (Complementary Post-Sequelae)
                          </span>
                          <p className="text-xs text-text-secondary leading-relaxed font-semibold">
                            These remedies are clinical successors that commonly follow {selectedRemedy.name} with optimal curative action:
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(selectedRemedy.followsWell && selectedRemedy.followsWell.length > 0) ? (
                                selectedRemedy.followsWell.map((foll, fIdx) => (
                                  <button
                                    key={fIdx}
                                    onClick={() => {
                                      const found = enhancedRemedies.find(r => r.name.toLowerCase() === foll.toLowerCase() || r.id.toLowerCase() === foll.toLowerCase());
                                      if (found) setSelectedRemedy(found);
                                    }}
                                    className="px-3 py-1.5 bg-white dark:bg-zinc-850 border border-blue-200 text-blue-700 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-500 hover:text-white transition-all cursor-pointer"
                                  >
                                    {foll} ↗
                                  </button>
                                ))
                              ) : (
                                ['Arsenicum Album', 'Silicea', 'Merc Sol'].map((fallback, fIdx) => (
                                  <button
                                    key={fIdx}
                                    onClick={() => {
                                      const found = enhancedRemedies.find(r => r.name.toLowerCase() === fallback.toLowerCase());
                                      if (found) setSelectedRemedy(found);
                                    }}
                                    className="px-3 py-1.5 bg-white dark:bg-zinc-850 border border-blue-200 text-blue-700 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-500 hover:text-white transition-all cursor-pointer"
                                  >
                                    {fallback} ↗
                                  </button>
                                ))
                              )}
                          </div>
                        </div>
                      </div>

                      {/* Related Ailments / Clinical Applications */}
                      {selectedRemedy.relatedAilments && selectedRemedy.relatedAilments.length > 0 && (
                        <div className="space-y-3 bg-white dark:bg-zinc-900/60 p-6 rounded-2xl border border-border shadow-soft">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-2">🧬 Associated Pathological Precedents (Ailments):</span>
                          <div className="grid md:grid-cols-2 gap-3 pb-2">
                            {selectedRemedy.relatedAilments.map((ail, aIdx) => (
                              <Link
                                key={aIdx}
                                to={`/conditions/${ail.id}`}
                                className="p-3.5 bg-slate-50 dark:bg-zinc-850 hover:bg-primary/5 hover:border-primary/30 border border-slate-200 dark:border-zinc-700 rounded-xl transition-all block text-xs font-bold text-text-primary"
                              >
                                <span className="text-primary mr-1 bg-primary/10 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-extrabold">AIL</span> {ail.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeCanvasTab === 'notes' && (
                    <motion.div
                      key="notes-doc"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-4 flex flex-col flex-grow"
                    >
                      <div className="flex items-center justify-between border-b border-border pb-2 shrink-0">
                        <h3 className="text-lg font-bold font-display uppercase tracking-wide text-primary">Student Interactive Notebook</h3>
                        <button
                          onClick={() => setIsEditingNotes(!isEditingNotes)}
                          className="px-3 py-1.5 bg-primary text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer hover:bg-primary-dark transition-all"
                        >
                          {isEditingNotes ? (
                            <>
                              <Save className="w-3.5 h-3.5" /> Save Notebook
                            </>
                          ) : (
                            <>
                              <Edit2 className="w-3.5 h-3.5" /> Edit Template
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex-grow flex flex-col relative min-h-[300px]">
                        {isEditingNotes ? (
                          <textarea
                            value={notesContent}
                            onChange={(e) => saveNotes(e.target.value)}
                            className="w-full h-full min-h-[300px] p-5 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white font-mono text-xs text-text-primary leading-relaxed shadow-inner"
                            placeholder="Add your own study guidelines or clinical observations here..."
                          />
                        ) : (
                          <div className="w-full h-full min-h-[300px] p-6 bg-white dark:bg-zinc-900 border border-border/70 rounded-2xl font-serif text-sm leading-relaxed text-text-primary shadow-soft overflow-y-auto whitespace-pre-line border-l-4 border-l-accent animate-fade">
                            {notesContent || "Add your own source-referenced study notes for this remedy."}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Printable overlay specifically targeting standard printers. Satisfies local print actions cleanly! */}
              <div id="print-section" className="hidden">
                <div className="p-8 space-y-6 bg-white text-black font-serif">
                  <div className="border-b-2 border-black pb-4 text-center">
                    <h1 className="text-4xl uppercase tracking-wider font-extrabold">{selectedRemedy.name}</h1>
                    <p className="text-sm italic">Classical materia medica reference study card</p>
                    <p className="text-xs">Curiva Peer-Review Library &middot; Authentic College Curriculum</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-widest border-b border-black pb-1">Origin substance:</h4>
                      <p className="text-sm italic">{selectedRemedy.origin}</p>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-widest border-b border-black pb-1">Core characteristics & keynotes:</h4>
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {selectedRemedy.keyCharacteristics.map((chr, cIdx) => (
                          <li key={cIdx}>{chr}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black">
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest">Worse Aggravations:</h4>
                        <p className="text-xs italic">{selectedRemedy.modalities.worse.join(', ') || 'No specific aggravations.'}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest">Better Ameliorations:</h4>
                        <p className="text-xs italic">{selectedRemedy.modalities.better.join(', ') || 'No specific ameliorations.'}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-black">
                      <h4 className="text-xs font-bold uppercase tracking-widest">Personal Student Canvas Notes:</h4>
                      <p className="text-xs italic leading-relaxed whitespace-pre-line bg-gray-50 p-4 border border-gray-300 rounded-lg">{notesContent}</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
