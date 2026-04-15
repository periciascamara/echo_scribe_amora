/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Trash2,
  Edit,
  FileUp,
  Tag,
  LayoutDashboard, 
  Layout,
  History, 
  Users, 
  FileText, 
  Settings, 
  Settings2,
  PlusCircle, 
  Mic, 
  LogOut, 
  Search, 
  Bell,
  ChevronRight,
  Download,
  MoreVertical,
  FileJson,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  Share2,
  Printer,
  FileCode,
  Sparkles,
  Check,
  Info,
  Menu,
  Star,
  ShieldCheck,
  Zap,
  ArrowRight,
  Play,
  Pause,
  PlayCircle,
  Send,
  Copy,
  Plus,
  X,
  Eye,
  Upload,
  Clipboard,
  Save,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { GeminiLiveService, TranscriptionPart } from './services/geminiLiveService';
import { jsPDF } from 'jspdf';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  auth, 
  db, 
  signInWithGoogle, 
  loginWithEmail,
  logout, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

// --- Types ---

type View = 
  | 'landing' 
  | 'auth' 
  | 'dashboard' 
  | 'history' 
  | 'scripts' 
  | 'doc-config' 
  | 'patient-models'
  | 'session-prep' 
  | 'live-session' 
  | 'transcription-validation'
  | 'doc-viewer';

type Script = {
  id: string;
  name: string;
  category: string;
  updated: string;
  status: 'Active' | 'Draft';
  instructions: string;
  checklist: { label: string, done: boolean }[];
  tags: string[];
  isFavorite: boolean;
}

type DocTemplate = {
  id: string;
  name: string;
  category: string;
  updated: string;
  status: 'Active' | 'Draft';
  instructions: string;
  sections: string[];
  latexTemplate?: string;
}

type HistoryItem = {
  id: string;
  patient: string;
  date: string;
  time: string;
  script: string;
  status: string;
  transcriptions: TranscriptionPart[];
  caseSummary: string;
  summary?: string;
  scriptInstructions: string;
  createdAt?: any;
}

type PatientModel = {
  id: string;
  name: string;
  age: string;
  gender: string;
  history: string;
  medications: string;
  allergies: string;
  updated: string;
  createdAt?: any;
}

// --- Mock Data ---

const INITIAL_SCRIPTS: Script[] = [
  { 
    id: '1',
    name: 'Anamnese Geral', 
    category: 'General', 
    updated: '24 Out, 2023', 
    status: 'Active', 
    instructions: 'Generate a structured SOAP note based on the clinical interview. Ensure medical terminology is accurate and concise.',
    checklist: [
      { label: 'Queixa Principal', done: false },
      { label: 'Histórico da Doença Atual', done: false },
      { label: 'Exame Físico', done: false },
      { label: 'Avaliação e Diagnóstico', done: false },
      { label: 'Plano e Orientação', done: false },
    ],
    tags: ['Geral', 'SOAP'],
    isFavorite: true
  },
  { 
    id: '2',
    name: 'Consulta Ortopédica', 
    category: 'Specialty', 
    updated: '20 Out, 2023', 
    status: 'Active', 
    instructions: 'Foque em anamnese ortopédica: mecanismo de trauma, localização da dor, testes especiais e plano de reabilitação.',
    checklist: [
      { label: 'História do Trauma', done: false },
      { label: 'Localização e Tipo de Dor', done: false },
      { label: 'Testes Especiais', done: false },
      { label: 'Exame de Imagem Prévios', done: false },
      { label: 'Plano de Reabilitação', done: false },
    ],
    tags: ['Ortopedia', 'Trauma'],
    isFavorite: false
  },
  { 
    id: '3',
    name: 'Triagem Psiquiátrica', 
    category: 'Specialty', 
    updated: '15 Out, 2023', 
    status: 'Active', 
    instructions: 'Foque em saúde mental: histórico familiar, sintomas atuais, avaliação de risco e plano terapêutico.',
    checklist: [
      { label: 'Histórico Familiar', done: false },
      { label: 'Sintomas Atuais', done: false },
      { label: 'Avaliação de Risco', done: false },
      { label: 'Plano Terapêutico', done: false },
    ],
    tags: ['Psiquiatria', 'Saúde Mental'],
    isFavorite: false
  },
];

const MOCK_PATIENT_MODELS: PatientModel[] = [
  {
    id: 'pm1',
    name: 'Carlos Eduardo Mendonça',
    age: '45',
    gender: 'Masculino',
    history: 'Hipertensão arterial sistêmica, Diabetes Mellitus tipo 2.',
    medications: 'Losartana 50mg, Metformina 850mg.',
    allergies: 'Penicilina',
    updated: '12 Mai, 2024'
  },
  {
    id: 'pm2',
    name: 'Maria Cavalcanti',
    age: '62',
    gender: 'Feminino',
    history: 'Hipotireoidismo, Osteoporose.',
    medications: 'Levotiroxina 75mcg, Alendronato 70mg.',
    allergies: 'Nenhuma',
    updated: '10 Mai, 2024'
  }
];

const MOCK_DOC_TEMPLATES: DocTemplate[] = [
  { 
    id: 'dt1', 
    name: 'SOAP Notes', 
    category: 'Clinical', 
    updated: '24 Out, 2023', 
    status: 'Active',
    instructions: 'Gere uma nota SOAP estruturada baseada na entrevista clínica. Garanta que a terminologia médica seja precisa e concisa.',
    sections: ['Subjetivo', 'Objetivo', 'Avaliação', 'Plano']
  },
  { 
    id: 'dt2', 
    name: 'Laudo Médico Pericial', 
    category: 'Legal', 
    updated: '20 Out, 2023', 
    status: 'Active',
    instructions: 'Gere um laudo pericial detalhando nexo causal e incapacidade laborativa.',
    sections: ['Identificação', 'Histórico', 'Exame Físico', 'Conclusão']
  },
  { 
    id: 'dt3', 
    name: 'Atestado de Saúde Ocupacional', 
    category: 'Occupational', 
    updated: '15 Out, 2023', 
    status: 'Draft',
    instructions: 'Gere um ASO conforme as normas da NR-7.',
    sections: ['Dados do Trabalhador', 'Riscos Ocupacionais', 'Exames Realizados', 'Aptidão']
  },
];

// --- Components ---

const MOCK_TRENDS = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  value: Math.floor(Math.random() * 200) + 100
}));

const MOCK_HISTORY: HistoryItem[] = [
  { 
    id: '#4492-B', 
    patient: 'Maria Cavalcanti', 
    date: '12 Mai, 2024', 
    time: '14:30', 
    script: 'Anamnese Cardíaca', 
    status: 'Concluído',
    transcriptions: [],
    caseSummary: 'Paciente com histórico de hipertensão...',
    scriptInstructions: 'Generate a structured SOAP note...'
  },
  { 
    id: '#1029-A', 
    patient: 'João Soares', 
    date: '12 Mai, 2024', 
    time: '11:15', 
    script: 'Consulta de Retorno', 
    status: 'Processando',
    transcriptions: [],
    caseSummary: '',
    scriptInstructions: ''
  },
  { 
    id: '#3381-C', 
    patient: 'Ricardo Mendes', 
    date: '11 Mai, 2024', 
    time: '16:45', 
    script: 'Exame Neurológico', 
    status: 'Rascunho',
    transcriptions: [],
    caseSummary: '',
    scriptInstructions: ''
  },
];

const MOCK_SCRIPTS = [
  { name: 'SOAP Standard', category: 'General', updated: 'Oct 24, 2023', status: 'Active', icon: <FileText className="w-4 h-4" /> },
  { name: 'Orthopedic Initial', category: 'Specialty', updated: 'Oct 20, 2023', status: 'Draft', icon: <Zap className="w-4 h-4" /> },
  { name: 'Psychiatric Intake', category: 'Specialty', updated: 'Oct 15, 2023', status: 'Active', icon: <Users className="w-4 h-4" /> },
];

const DEFAULT_SCRIPT = {
  name: "Roteiro Simplificado",
  instructions: "Realize uma anamnese básica focada na queixa principal, histórico da doença atual e sintomas associados. Gere um documento no formato SOAP.",
  checklist: [
    { label: "Identificar queixa principal", done: false },
    { label: "Histórico da doença atual", done: false },
    { label: "Sintomas associados", done: false },
    { label: "Plano de conduta", done: false }
  ]
};

// --- Components ---

const Sidebar = ({ currentView, setView, user, role }: { currentView: View, setView: (v: View) => void, user: FirebaseUser | null, role: string | null }) => {
  const navItems = [
    { id: 'patient-models', label: 'Meus Pacientes', icon: Users },
    { id: 'scripts', label: 'Roteiros', icon: FileText },
    { id: 'doc-config', label: 'Geração de Docs', icon: Settings },
    { id: 'history', label: 'Histórico', icon: History },
  ];

  if (role === 'admin') {
    navItems.push({ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard });
  }

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="size-10 rounded-lg bg-blue-600 flex items-center justify-center text-white">
          <Mic className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-slate-900 font-bold text-lg leading-tight">ECHO scribe</h1>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{role === 'admin' ? 'Admin Console' : 'Medical App'}</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id as View)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-medium",
              currentView === item.id 
                ? "bg-blue-50 text-blue-600 font-semibold" 
                : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <button 
          onClick={() => setView('session-prep')}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all mb-4"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nova Entrevista</span>
        </button>
        
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer group">
          <div className="size-8 rounded-full bg-slate-200 overflow-hidden">
            <img src={user?.photoURL || "https://picsum.photos/seed/doc/100/100"} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold truncate">{user?.displayName || 'Usuário'}</p>
            <p className="text-xs text-slate-500 truncate capitalize">{role || 'Médico'}</p>
          </div>
          <button 
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await logout();
                setView('landing');
              } catch (err) {
                console.error("Erro ao sair:", err);
              }
            }}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
            title="Sair da aplicação"
          >
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
          </button>
        </div>
      </div>
    </aside>
  );
};

const Header = ({ title }: { title: string }) => (
  <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
    <h2 className="text-xl font-bold text-slate-900">{title}</h2>
    <div className="flex items-center gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input 
          className="pl-10 pr-4 py-1.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-600 w-64" 
          placeholder="Global search..." 
          type="text"
        />
      </div>
      <button className="size-8 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 relative">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1 right-1 size-2 bg-red-500 rounded-full border-2 border-white"></span>
      </button>
    </div>
  </header>
);

// --- Views ---

const SpecialtyGrid = () => {
  const [items, setItems] = useState([
    { id: 1, label: "Neurologia", icon: "🧠" },
    { id: 2, label: "Nefrologia", icon: "💧" },
    { id: 3, label: "Perícia Médica", icon: "⚖️" },
    { id: 4, label: "Medicina do Trabalho", icon: "👷" },
    { id: 5, label: "Cirurgia Geral", icon: "🔪" },
    { id: 6, label: "Urologia", icon: "🧬" },
    { id: 7, label: "Cardiologia", icon: "❤️" },
    { id: 8, label: "Pediatria", icon: "👶" },
    { id: 9, label: "Ortopedia", icon: "🦴" },
  ]);

  const shuffle = () => {
    setItems([...items].sort(() => Math.random() - 0.5));
  };

  return (
    <>
      {items.map((item) => (
        <motion.div
          key={item.id}
          layout
          onClick={shuffle}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.15)" }}
          whileTap={{ scale: 0.95 }}
          className="bg-white/10 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center aspect-square"
        >
          <span className="text-3xl">{item.icon}</span>
          <span className="text-[10px] font-black uppercase tracking-tighter text-blue-400">{item.label}</span>
        </motion.div>
      ))}
    </>
  );
};

const LandingPage = ({ setView }: { setView: (v: View) => void }) => {
  const [extraTestimonials, setExtraTestimonials] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const baseTestimonials = [
    {
      name: "Dra. Helena Souza",
      role: "Cardiologista • Hospital Sírio-Libanês",
      comment: "O ECHO scribe reduziu meu tempo de documentação em 70%. Agora consigo dar mais atenção aos meus pacientes e sair do consultório no horário.",
      image: "https://picsum.photos/seed/doc1/100/100"
    },
    {
      name: "Dr. Ricardo Mendes",
      role: "Ortopedista • Clínica OrthoLife",
      comment: "A precisão na terminologia médica é impressionante. Ele entende termos complexos e organiza tudo de forma lógica no prontuário.",
      image: "https://picsum.photos/seed/doc2/100/100"
    },
    {
      name: "Dra. Ana Beatriz",
      role: "Pediatra • Unimed",
      comment: "Finalmente uma ferramenta que não me obriga a ficar olhando para a tela enquanto converso com os pais. A conexão humana voltou ao meu consultório.",
      image: "https://picsum.photos/seed/doc3/100/100"
    }
  ];

  const generateMore = () => {
    setIsGenerating(true);
    // Simulate AI generation or just add more variety
    setTimeout(() => {
      const newTestimonials = [
        {
          name: "Dr. Marcos Vinícius",
          role: "Neurologista • Santa Casa",
          comment: "A integração com o CID-10 facilitou muito meu fluxo. O rascunho gerado é quase perfeito, exigindo mínimos ajustes.",
          image: `https://picsum.photos/seed/doc${Math.random()}/100/100`
        },
        {
          name: "Dra. Cláudia Lima",
          role: "Ginecologista • Consultório Particular",
          comment: "O ECHO scribe é como ter um assistente invisível. A segurança jurídica que a transcrição fidedigna traz é um diferencial enorme.",
          image: `https://picsum.photos/seed/doc${Math.random()}/100/100`
        }
      ];
      setExtraTestimonials(prev => [...prev, ...newTestimonials]);
      setIsGenerating(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-blue-600">ECHO scribe</h2>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a className="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors" href="#features">Recursos</a>
            <a className="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors" href="#testimonials">Depoimentos</a>
            <a className="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors" href="#pricing">Preços</a>
            <button onClick={() => setView('auth')} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200">Começar Agora</button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col gap-8">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full w-fit">
              <Zap className="w-3 h-3 fill-current" />
              <span className="text-xs font-bold uppercase tracking-wider">Novo: Motor V2 com 99,9% de Precisão</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight text-slate-900">
              Documentação Clínica <span className="text-blue-600">Sem Esforço</span> com IA
            </h1>
            <p className="text-lg text-slate-600 max-w-xl">
              Foco total no seu paciente, não no teclado. O ECHO scribe ouve as consultas e gera documentos estruturados e prontos para registro e documentação.
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => setView('auth')} className="bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:shadow-lg hover:shadow-blue-600/25 transition-all flex items-center gap-2">
                Iniciar Teste Grátis <ArrowRight className="w-5 h-5" />
              </button>
              <button className="bg-white border border-blue-400 px-8 py-4 rounded-xl text-lg font-bold hover:bg-slate-50 transition-all flex items-center gap-2 text-slate-800">
                Ver Demonstração <PlayCircle className="w-5 h-5 text-blue-600" />
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-blue-600/5 rounded-[2rem] blur-2xl"></div>
            <div className="relative bg-white border border-blue-100 rounded-2xl shadow-2xl overflow-hidden aspect-[4/3] p-8 flex flex-col gap-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse"></div>
              <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse"></div>
              <div className="h-32 w-full bg-blue-50 rounded-xl border border-blue-100 p-4">
                <p className="text-blue-600 font-mono text-sm leading-relaxed">
                  [Análise IA] Paciente relata dor localizada no joelho. Gerando estrutura SOAP... Diagnóstico: Suspeita de lesão no menisco medial.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* New Section: Technological Differentiators & Versatility */}
        <section className="py-24 bg-slate-900 text-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-1.5 rounded-full border border-blue-500/30">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Diferenciais Exclusivos</span>
                </div>
                <h2 className="text-4xl md:text-6xl font-black leading-tight">
                  Liberdade total para <span className="text-blue-500">qualquer especialidade</span>
                </h2>
                <p className="text-xl text-slate-400 leading-relaxed">
                  Nossa tecnologia permite que qualquer área da medicina crie seus próprios roteiros personalizados. Um médico pode atuar em qualquer especialidade com o suporte de pré-roteiros inteligentes, garantindo segurança e precisão.
                </p>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="size-12 rounded-xl bg-blue-600/20 border border-blue-600/30 flex items-center justify-center shrink-0">
                      <Layout className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Controle de Layout com LaTeX</h3>
                      <p className="text-slate-400">Compromisso com a perfeição estética. Utilizamos tecnologia LaTeX embutida para gerar documentos com o melhor controle de layout e tipografia do mercado.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="size-12 rounded-xl bg-purple-600/20 border border-purple-600/30 flex items-center justify-center shrink-0">
                      <Zap className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Versatilidade Ilimitada</h3>
                      <p className="text-slate-400">Seja na Neurologia ou na Medicina do Trabalho, o ECHO scribe se adapta ao seu fluxo, não o contrário.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-10 bg-blue-600/20 blur-[100px] rounded-full"></div>
                <div className="relative grid grid-cols-3 gap-4">
                  <SpecialtyGrid />
                </div>
                <p className="text-center mt-8 text-slate-500 text-sm italic">Clique nos ícones para ver a versatilidade em ação</p>
              </div>
            </div>
          </div>
        </section>

        {/* New Section: All Specialties & Smart Questions */}
        <section className="py-24 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6">
            <div className="bg-blue-600 rounded-[2.5rem] p-12 md:p-20 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
              <div className="absolute top-0 right-0 w-1/2 h-full bg-white/5 skew-x-12 translate-x-1/4"></div>
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-xs font-bold uppercase tracking-wider">Versatilidade Total</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black leading-tight">
                    Feito para <span className="text-blue-200">todas as especialidades</span> e problemas médicos.
                  </h2>
                  <p className="text-xl text-blue-50 leading-relaxed">
                    O importante é fazer as perguntas certas na hora certa. O ECHO scribe ajuda você a não se esquecer nunca o que deve ser perguntado para cada paciente, independentemente da complexidade do caso.
                  </p>
                  <div className="flex gap-4">
                    <div className="flex -space-x-3">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="size-10 rounded-full border-2 border-blue-600 bg-slate-200 overflow-hidden">
                          <img src={`https://picsum.photos/seed/doc${i+10}/100/100`} alt="Doc" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                    <div className="text-sm">
                      <p className="font-bold">Utilizado por +500 médicos</p>
                      <p className="text-blue-200">Em 25 especialidades diferentes</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Cardiologia", icon: "❤️" },
                    { label: "Pediatria", icon: "👶" },
                    { label: "Ortopedia", icon: "🦴" },
                    { label: "Psiquiatria", icon: "🧠" },
                    { label: "Ginecologia", icon: "👩" },
                    { label: "Dermatologia", icon: "✨" },
                  ].map((spec, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-white/20 transition-all cursor-default group">
                      <span className="text-3xl group-hover:scale-110 transition-transform">{spec.icon}</span>
                      <span className="text-sm font-bold">{spec.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="bg-slate-50 py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">Tecnologia que entende a medicina</h2>
              <p className="text-slate-600">Desenvolvido por médicos para médicos, nossa plataforma resolve o maior gargalo da prática clínica: a burocracia.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { 
                  icon: <Zap className="w-6 h-6" />, 
                  title: "E - EFICIENTE: Automação que Liberta", 
                  desc: "A principal funcionalidade é a eliminação da digitação manual durante e após a consulta. O sistema atua de forma invisível, permitindo que o profissional de saúde recupere até 2 horas de seu dia que seriam gastas com burocracia, redirecionando o foco total ao atendimento do paciente." 
                },
                { 
                  icon: <Sparkles className="w-6 h-6" />, 
                  title: "C - CLÍNICO: Especialização em Saúde", 
                  desc: "Diferente de IAs genéricas, o E.C.H.O. possui um motor de processamento treinado em terminologias médicas complexas e fluxos de atendimento específicos (CID-10). Ele compreende o contexto da entrevista clínica para gerar um rascunho de prontuário tecnicamente impecável." 
                },
                { 
                  icon: <ShieldCheck className="w-6 h-6" />, 
                  title: "H - HONESTO: Segurança Jurídica \"Ipsis Litteris\"", 
                  desc: "Sob o selo de validação da Veridicus I.A., a funcionalidade de transcrição fidedigna garante que o registro reflita exatamente o que foi dito. Isso cria uma camada de proteção jurídica essencial, validando a verdade do ato médico contra eventuais judicializações." 
                },
                { 
                  icon: <LayoutDashboard className="w-6 h-6" />, 
                  title: "O - ORGANIZADO: Dados Prontos para a Gestão", 
                  desc: "A tecnologia não apenas transcreve, mas estrutura diálogos informais em seções organizadas (Anamnese, Exame Físico, Conduta), prontas para integração direta com qualquer PEP (Prontuário Eletrônico do Paciente). O resultado é um dado auditável e de fácil leitura para a gestão hospitalar." 
                }
              ].map((f, i) => (
                <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="bg-blue-50 w-12 h-12 rounded-lg flex items-center justify-center text-blue-600 mb-6">{f.icon}</div>
                  <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-24">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
              <h2 className="text-4xl font-black text-slate-900 leading-tight">O que dizem os especialistas</h2>
              <p className="text-slate-600">Médicos de diversas especialidades já transformaram sua rotina com o ECHO scribe.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
              {[...baseTestimonials, ...extraTestimonials].map((t, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="bg-slate-50 p-8 rounded-3xl border border-slate-100 flex flex-col gap-6"
                >
                  <p className="text-slate-700 italic flex-1 leading-relaxed">"{t.comment}"</p>
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
                      <img src={t.image} alt={t.name} referrerPolicy="no-referrer" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{t.name}</p>
                      <p className="text-xs text-slate-500">{t.role}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex justify-center">
              <button 
                onClick={generateMore}
                disabled={isGenerating}
                className="bg-white border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? "Carregando avaliações..." : "Ver mais avaliações"}
              </button>
            </div>
          </div>
        </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-900 py-24 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-black mb-4">Planos para cada estágio</h2>
            <p className="text-slate-400">Escolha o plano que melhor se adapta ao volume da sua clínica.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Individual", price: "R$ 299", features: ["Até 50 consultas/mês", "Suporte via E-mail", "Exportação PDF/LaTeX"] },
              { name: "Profissional", price: "R$ 599", features: ["Consultas Ilimitadas", "Suporte Prioritário", "Integração com Prontuário", "IA Personalizada"], popular: true },
              { name: "Clínica", price: "Sob Consulta", features: ["Múltiplos Usuários", "Gestão de Equipe", "API de Integração", "SLA Garantido"] }
            ].map((p, i) => (
              <div key={i} className={cn("p-8 rounded-3xl border flex flex-col gap-6", p.popular ? "bg-blue-600 border-blue-500 scale-105" : "bg-slate-800 border-slate-700")}>
                <div>
                  <h3 className="text-xl font-bold mb-2">{p.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black">{p.price}</span>
                    {p.price !== "Sob Consulta" && <span className="text-sm opacity-60">/mês</span>}
                  </div>
                </div>
                <ul className="space-y-3 flex-1">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm opacity-90">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {f}
                    </li>
                  ))}
                </ul>
                <button className={cn("w-full py-3 rounded-xl font-bold transition-all", p.popular ? "bg-white text-blue-600 hover:bg-slate-100" : "bg-blue-600 text-white hover:bg-blue-700")}>
                  Selecionar Plano
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6 bg-blue-600 rounded-[3rem] p-12 md:p-20 text-center text-white space-y-8">
          <h2 className="text-4xl md:text-6xl font-black leading-tight">Pronto para transformar sua prática?</h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">Junte-se a milhares de médicos que já recuperaram seu tempo com o ECHO scribe.</p>
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button onClick={() => setView('auth')} className="bg-white text-blue-600 px-10 py-4 rounded-2xl text-lg font-bold hover:bg-slate-100 transition-all">Começar Agora</button>
            <button className="bg-blue-700 text-white px-10 py-4 rounded-2xl text-lg font-bold hover:bg-blue-800 transition-all">Falar com Consultor</button>
          </div>
        </div>
      </section>
    </main>

    <footer className="bg-slate-50 border-t border-slate-200 py-12">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Mic className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-blue-600">ECHO scribe</h2>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">A próxima geração de documentação médica assistida por inteligência artificial.</p>
        </div>
        <div>
          <h4 className="font-bold mb-4">Produto</h4>
          <ul className="space-y-2 text-sm text-slate-600">
            <li><a href="#" className="hover:text-blue-600">Recursos</a></li>
            <li><a href="#" className="hover:text-blue-600">Segurança</a></li>
            <li><a href="#" className="hover:text-blue-600">Integrações</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-4">Empresa</h4>
          <ul className="space-y-2 text-sm text-slate-600">
            <li><a href="#" className="hover:text-blue-600">Sobre Nós</a></li>
            <li><a href="#" className="hover:text-blue-600">Blog</a></li>
            <li><a href="#" className="hover:text-blue-600">Carreiras</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-bold mb-4">Legal</h4>
          <ul className="space-y-2 text-sm text-slate-600">
            <li><a href="#" className="hover:text-blue-600">Privacidade</a></li>
            <li><a href="#" className="hover:text-blue-600">Termos de Uso</a></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-slate-200 flex flex-col md:row justify-between items-center gap-4">
        <p className="text-xs text-slate-400">© 2024 ECHO scribe. Todos os direitos reservados.</p>
        <div className="flex gap-6">
          <a href="#" className="text-slate-400 hover:text-blue-600"><Send className="w-5 h-5" /></a>
          <a href="#" className="text-slate-400 hover:text-blue-600"><Zap className="w-5 h-5" /></a>
        </div>
      </div>
    </footer>
    </div>
  );
};

const AuthPage = ({ setView }: { setView: (v: View) => void }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      alert("Erro ao entrar com Google. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
        alert("Credenciais inválidas. Use admin@teste.com / 123 ou usuario@teste.com / 123");
      } else {
        alert("Erro ao entrar. Verifique se o login por e-mail está ativado no Firebase.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="relative hidden w-full lg:flex lg:w-1/2 items-center justify-center bg-blue-600 overflow-hidden">
        <div className="absolute inset-0 opacity-40 bg-cover bg-center" style={{ backgroundImage: 'url(https://picsum.photos/seed/med/1200/800)' }}></div>
        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/90 to-blue-600/40"></div>
        <div className="relative z-10 p-12 max-w-xl text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="size-10 bg-white rounded-lg flex items-center justify-center text-blue-600">
              <Mic className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">ECHO scribe</h2>
          </div>
          <h1 className="text-5xl font-black leading-tight mb-6">IA avançada para a gestão em saúde moderna.</h1>
          <p className="text-lg text-slate-100/90 leading-relaxed">
            Transforme suas consultas em registros precisos instantaneamente. Foco total no paciente, enquanto nossa IA cuida da documentação.
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-24 bg-white">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Bem-vindo ao ECHO scribe</h2>
            <p className="mt-2 text-slate-600">Acesse sua conta profissional para começar.</p>
          </div>

          <div className="mb-8 p-1 bg-slate-100 rounded-xl flex">
            <button 
              onClick={() => setAuthMode('login')}
              className={cn("flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all", authMode === 'login' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700")}
            >
              Login
            </button>
            <button 
              onClick={() => setAuthMode('signup')}
              className={cn("flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all", authMode === 'signup' ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700")}
            >
              Criar Conta
            </button>
          </div>

          <form className="space-y-5" onSubmit={handleEmailLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
              <input 
                className="block w-full rounded-lg border-slate-300 focus:border-blue-600 focus:ring-blue-600 py-3 px-4" 
                placeholder="seu@email.com" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Senha</label>
                {authMode === 'login' && <a className="text-xs font-semibold text-blue-600 hover:underline" href="#">Esqueceu a senha?</a>}
              </div>
              <input 
                className="block w-full rounded-lg border-slate-300 focus:border-blue-600 focus:ring-blue-600 py-3 px-4" 
                placeholder="••••••••" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
            <button 
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50" 
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                authMode === 'login' ? 'Entrar' : 'Criar Conta'
              )}
            </button>
          </form>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
            <div className="relative flex justify-center text-sm"><span className="bg-white px-2 text-slate-500">Ou continue com</span></div>
          </div>

          <div className="mt-6">
            <button 
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-lg bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              )}
              Entrar com Google
            </button>
          </div>
          
          <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-[10px] font-bold text-blue-600 uppercase mb-2">Contas de Teste:</p>
            <div className="space-y-1 text-[10px] text-blue-700">
              <p><strong>Admin:</strong> admin@teste.com / 123456</p>
              <p><strong>Usuário:</strong> usuario@teste.com / 123456</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardView = ({ allUsers, allHistory }: { allUsers: any[], allHistory: any[] }) => {
  const totalUsers = allUsers.length;
  const totalInterviews = allHistory.length;
  
  // MTD (Month to Date)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const interviewsMTD = allHistory.filter(h => {
    const date = h.createdAt?.toDate ? h.createdAt.toDate() : new Date(h.createdAt);
    return date >= startOfMonth;
  }).length;

  // Trend data (last 30 days)
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const trendData = last30Days.map(date => {
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    const count = allHistory.filter(h => {
      const hDate = h.createdAt?.toDate ? h.createdAt.toDate() : new Date(h.createdAt);
      return hDate >= date && hDate < nextDay;
    }).length;
    return {
      day: date.getDate(),
      value: count
    };
  });

  const stats = [
    { label: 'Total Users', value: totalUsers.toLocaleString(), change: '+0%', icon: Users },
    { label: 'Interviews MTD', value: interviewsMTD.toLocaleString(), change: '+0%', icon: Mic },
    { label: 'Total Interviews', value: totalInterviews.toLocaleString(), change: '+0%', icon: Zap },
    { label: 'Platform Revenue', value: 'R$ 0', change: '+0%', icon: Download },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 text-sm font-medium">{stat.label}</span>
              <div className="size-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-3xl font-bold">{stat.value}</h3>
            <p className="text-emerald-600 text-sm font-semibold mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3 fill-current" /> {stat.change}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Interview Trends (Last 30 Days)</h3>
            <p className="text-sm text-slate-500">Daily processed audio transcription volume</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData}>
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Tooltip />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-bold">User Management</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">User Name</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Email Address</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Role</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allUsers.map((u, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-semibold">{u.displayName}</td>
                <td className="px-6 py-4 text-slate-600 text-sm">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded text-[10px] font-bold uppercase",
                    u.role === 'admin' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                  )}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-blue-600 font-bold text-sm hover:underline">Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const HistoryView = ({ 
  history, 
  setHistory, 
  setView, 
  setPatientName, 
  setCaseSummary, 
  setTranscriptions,
  setScriptInstructions,
  setSummary,
  setCurrentHistoryId
}: { 
  history: HistoryItem[], 
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  setView: (v: View) => void,
  setPatientName: (n: string) => void,
  setCaseSummary: (s: string) => void,
  setTranscriptions: (t: TranscriptionPart[]) => void,
  setScriptInstructions: (s: string) => void,
  setSummary: (s: string) => void,
  setCurrentHistoryId: (id: string | null) => void
}) => {
  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta sessão?')) {
      try {
        await deleteDoc(doc(db, 'history', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'history');
      }
    }
  };

  const handleEdit = (item: HistoryItem) => {
    setPatientName(item.patient);
    setCaseSummary(item.caseSummary);
    setTranscriptions(item.transcriptions);
    setScriptInstructions(item.scriptInstructions);
    setSummary(item.summary || '');
    setCurrentHistoryId(item.id);
    setView('transcription-validation');
  };

  const handleSendToContext = (item: HistoryItem) => {
    setPatientName(item.patient);
    setCaseSummary(item.caseSummary);
    setTranscriptions(item.transcriptions);
    setScriptInstructions(item.scriptInstructions);
    setView('transcription-validation');
  };

  const handleDownload = (item: HistoryItem) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(item, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `sessao_${item.patient.replace(/\s+/g, '_')}_${item.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Histórico de Entrevistas</h2>
          <p className="text-slate-500 text-sm">Gerencie e visualize todas as suas sessões gravadas e transcrições.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
          <Download className="w-4 h-4" /> Exportar Relatório
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm outline-none" placeholder="Buscar por nome do paciente ou ID..." />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-sm font-medium">Período</button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-sm font-medium">Tipo</button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-sm font-medium">Status</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Data/Hora</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Paciente</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Roteiro / Script</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((item, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{item.date}</span>
                    <span className="text-xs text-slate-500">{item.time}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
                      {item.patient.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{item.patient}</span>
                      <span className="text-xs text-slate-500">ID: {item.id}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{item.script}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium",
                    item.status === 'Concluído' ? "bg-emerald-100 text-emerald-700" :
                    item.status === 'Processando' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                  )}>
                    <span className={cn("size-1.5 rounded-full", 
                      item.status === 'Concluído' ? "bg-emerald-500" :
                      item.status === 'Processando' ? "bg-blue-500" : "bg-amber-500"
                    )}></span>
                    {item.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button 
                      onClick={() => handleSendToContext(item)}
                      title="Enviar para Contexto"
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <FileUp className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleEdit(item)}
                      title="Editar"
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDownload(item)}
                      title="Download"
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      title="Excluir"
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ScriptsView = ({ 
  scripts, 
  setScripts, 
  setView,
  setScriptInstructions,
  setChecklistItems
}: { 
  scripts: Script[], 
  setScripts: (s: Script[]) => void, 
  setView: (v: View) => void,
  setScriptInstructions: (s: string) => void,
  setChecklistItems: (items: { label: string, done: boolean }[]) => void
}) => {
  const [editingScript, setEditingScript] = useState<Script | null>(scripts[0] || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('Todos os Roteiros');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [newTag, setNewTag] = useState('');

  const allTags = Array.from(new Set(scripts.flatMap(s => s.tags)));

  const toggleFavorite = async (id: string) => {
    const script = scripts.find(s => s.id === id);
    if (!script) return;
    try {
      await updateDoc(doc(db, 'scripts', id), {
        isFavorite: !script.isFavorite
      });
      if (editingScript?.id === id) {
        setEditingScript({ ...editingScript, isFavorite: !editingScript.isFavorite });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'scripts');
    }
  };

  const addTagToEditing = () => {
    if (!editingScript || !newTag.trim()) return;
    if (editingScript.tags.includes(newTag.trim())) return;
    setEditingScript({
      ...editingScript,
      tags: [...editingScript.tags, newTag.trim()]
    });
    setNewTag('');
  };

  const removeTagFromEditing = (tag: string) => {
    if (!editingScript) return;
    setEditingScript({
      ...editingScript,
      tags: editingScript.tags.filter(t => t !== tag)
    });
  };

  const saveScript = async () => {
    if (!editingScript || !auth.currentUser) return;
    try {
      const { id, ...data } = editingScript;
      await updateDoc(doc(db, 'scripts', id), {
        ...data,
        updated: new Date().toLocaleDateString('pt-BR')
      });
      alert('Roteiro salvo com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'scripts');
    }
  };

  const startInterview = () => {
    if (!editingScript) return;
    setScriptInstructions(editingScript.instructions);
    setChecklistItems(editingScript.checklist.map(item => ({ ...item, done: false })));
    setView('session-prep');
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      alert('Por favor, insira um comando para a IA.');
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Gere um roteiro de entrevista clínica e instruções para processamento de documentos (como SOAP) baseado no seguinte comando: "${aiPrompt}". 
        
        Retorne o resultado em formato JSON com a seguinte estrutura:
        {
          "instructions": "instruções detalhadas para a IA",
          "checklist": ["item 1", "item 2", ...]
        }`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      if (!response.text) {
        throw new Error("A IA não retornou um conteúdo válido.");
      }
      
      const result = JSON.parse(response.text);
      if (editingScript && result.instructions) {
        setEditingScript({
          ...editingScript,
          instructions: result.instructions,
          checklist: result.checklist.map((label: string) => ({ label, done: false }))
        });
        setAiPrompt('');
      }
    } catch (err) {
      console.error("Erro ao gerar roteiro:", err);
      alert("Ocorreu um erro ao gerar o roteiro com IA.");
    } finally {
      setIsGenerating(false);
    }
  };

  const addCheckPoint = () => {
    if (!editingScript) return;
    setEditingScript({
      ...editingScript,
      checklist: [...editingScript.checklist, { label: 'Novo Ponto', done: false }]
    });
  };

  const updateCheckPoint = (index: number, label: string) => {
    if (!editingScript) return;
    const newChecklist = [...editingScript.checklist];
    newChecklist[index].label = label;
    setEditingScript({ ...editingScript, checklist: newChecklist });
  };

  const addScript = async () => {
    if (!auth.currentUser) return;
    try {
      const newScript = {
        name: 'Novo Roteiro',
        category: 'General',
        updated: new Date().toLocaleDateString('pt-BR'),
        status: 'Draft',
        instructions: 'Insira as instruções para a IA aqui...',
        checklist: [{ label: 'Item 1', done: false }],
        tags: [],
        isFavorite: false,
        ownerUid: auth.currentUser.uid,
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'scripts'), newScript);
      setEditingScript({ id: docRef.id, ...newScript } as Script);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'scripts');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Roteiros de Entrevista</h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie e personalize padrões de entrevista clínica para processamento automatizado.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar roteiros..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={addScript} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-200 whitespace-nowrap">
            <PlusCircle className="w-4 h-4" /> Criar Novo Roteiro
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        {['Todos os Roteiros', 'Favoritos', 'Medicina Geral', 'Especialidades', 'Arquivados'].map((tab) => (
          <button 
            key={tab} 
            onClick={() => {
              setActiveTab(tab);
              setSelectedTag(null);
            }}
            className={cn(
              "px-4 py-2 text-sm font-bold border-b-2 transition-colors", 
              activeTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-blue-600"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-slate-400 uppercase mr-2">Filtrar por Tag:</span>
          <button 
            onClick={() => setSelectedTag(null)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-bold transition-all",
              selectedTag === null ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Todas
          </button>
          {allTags.map(tag => (
            <button 
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-bold transition-all",
                selectedTag === tag ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scripts
                    .filter(s => {
                      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
                      const matchesTab = 
                        activeTab === 'Todos os Roteiros' || 
                        (activeTab === 'Favoritos' && s.isFavorite) ||
                        (activeTab === 'Medicina Geral' && s.category === 'General') ||
                        (activeTab === 'Especialidades' && s.category === 'Specialty') ||
                        (activeTab === 'Arquivados' && s.status === 'Draft');
                      const matchesTag = !selectedTag || s.tags.includes(selectedTag);
                      return matchesSearch && matchesTab && matchesTag;
                    })
                    .map((script, i) => (
                      <tr key={i} className={cn("hover:bg-slate-50 transition-colors cursor-pointer", editingScript?.id === script.id && "bg-blue-50/50")} onClick={() => setEditingScript(script)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md shrink-0"><FileText className="w-3 h-3" /></div>
                              <span className="font-semibold text-xs truncate">{script.name}</span>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(script.id);
                              }}
                              className={cn("p-1 rounded-full transition-colors", script.isFavorite ? "text-amber-500" : "text-slate-300 hover:text-slate-400")}
                            >
                              <Star className={cn("w-3 h-3", script.isFavorite && "fill-current")} />
                            </button>
                          </div>
                          {script.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {script.tags.map(t => (
                                <span key={t} className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-bold">{t}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right relative group">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              // Simple action for now, could be a dropdown
                              if (confirm(`Deseja excluir o roteiro "${script.name}"?`)) {
                                setScripts(scripts.filter(s => s.id !== script.id));
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Excluir Roteiro"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-lg">Editar Roteiro</h3>
              {editingScript && (
                <button 
                  onClick={() => toggleFavorite(editingScript.id)}
                  className={cn("p-2 rounded-lg transition-all", editingScript.isFavorite ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}
                >
                  <Star className={cn("w-4 h-4", editingScript.isFavorite && "fill-current")} />
                </button>
              )}
            </div>
            {editingScript && (
              <button 
                onClick={startInterview}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200"
              >
                <PlayCircle className="w-4 h-4" /> Iniciar Entrevista
              </button>
            )}
          </div>
          {editingScript ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome do Roteiro</label>
                  <input 
                    className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3" 
                    value={editingScript.name}
                    onChange={(e) => setEditingScript({ ...editingScript, name: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tags do Roteiro</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editingScript.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">
                        {tag}
                        <button onClick={() => removeTagFromEditing(tag)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Nova tag..."
                      className="flex-1 rounded-lg border-slate-200 bg-slate-50 text-sm py-1.5 px-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTagToEditing()}
                    />
                    <button 
                      onClick={addTagToEditing}
                      className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Gerar com IA</span>
                  </div>
                  <textarea 
                    className="w-full rounded-lg border-blue-200 bg-white text-sm py-2 px-3 h-20 resize-none focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="Descreva o tipo de roteiro que deseja (ex: Anamnese para Pediatria)..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                  <button 
                    onClick={generateWithAI}
                    disabled={isGenerating}
                    className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>Comando para IA</>
                    )}
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Instruções da IA</label>
                  <textarea 
                    className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3 h-48 resize-none font-mono" 
                    value={editingScript.instructions}
                    onChange={(e) => setEditingScript({ ...editingScript, instructions: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-3">
                    <label className="text-xs font-bold text-slate-500 uppercase">Pontos do Checklist</label>
                    <button onClick={addCheckPoint} className="text-xs font-bold text-blue-600">+ Adicionar Ponto</button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {editingScript.checklist.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <Menu className="w-4 h-4 text-slate-400" />
                        <input 
                          className="text-xs flex-1 bg-transparent border-none outline-none" 
                          value={p.label}
                          onChange={(e) => updateCheckPoint(i, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-4">
                  <button onClick={saveScript} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow-sm hover:bg-blue-700 transition-all">Salvar Alterações</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              Selecione um roteiro para editar
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

const DocConfigView = ({ templates, setTemplates }: { templates: DocTemplate[], setTemplates: (t: DocTemplate[]) => void }) => {
  const [editingTemplate, setEditingTemplate] = useState<DocTemplate | null>(templates[0] || null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateStructureWithAI = async () => {
    if (!editingTemplate || !editingTemplate.instructions.trim()) {
      alert('Por favor, insira instruções para a IA primeiro.');
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Baseado nas instruções: "${editingTemplate.instructions}", sugira as seções ideais para este documento médico. 
        
        Retorne o resultado em formato JSON com a seguinte estrutura:
        {
          "sections": ["Seção 1", "Seção 2", ...]
        }`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      if (!response.text) throw new Error("Sem resposta da IA");
      
      const result = JSON.parse(response.text);
      if (result.sections) {
        setEditingTemplate({
          ...editingTemplate,
          sections: result.sections
        });
      }
    } catch (err) {
      console.error("Erro ao gerar estrutura:", err);
      alert("Erro ao gerar estrutura com IA.");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate || !auth.currentUser) return;
    try {
      const { id, ...data } = editingTemplate;
      await updateDoc(doc(db, 'templates', id), {
        ...data,
        updated: new Date().toLocaleDateString('pt-BR')
      });
      alert('Modelo de documento salvo com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'templates');
    }
  };

  const addTemplate = async () => {
    if (!auth.currentUser) return;
    try {
      const newTemplate = {
        name: 'Novo Modelo de Documento',
        category: 'Clinical',
        updated: new Date().toLocaleDateString('pt-BR'),
        status: 'Draft',
        instructions: 'Insira as instruções para a IA gerar este documento...',
        sections: ['Nova Seção'],
        latexTemplate: '',
        ownerUid: auth.currentUser.uid,
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'templates'), newTemplate);
      setEditingTemplate({ id: docRef.id, ...newTemplate } as DocTemplate);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'templates');
    }
  };

  const addSection = () => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      sections: [...editingTemplate.sections, 'Nova Seção']
    });
  };

  const updateSection = (index: number, value: string) => {
    if (!editingTemplate) return;
    const newSections = [...editingTemplate.sections];
    newSections[index] = value;
    setEditingTemplate({ ...editingTemplate, sections: newSections });
  };

  const removeSection = (index: number) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      sections: editingTemplate.sections.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Geração de Documentos</h2>
          <p className="text-slate-500 text-sm mt-1">Configure como a IA gera e estrutura seus documentos médicos.</p>
        </div>
        <button onClick={addTemplate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-200">
          <PlusCircle className="w-4 h-4" /> Novo Modelo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                <tr>
                  <th className="px-6 py-4">Nome do Modelo</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((doc, i) => (
                  <tr 
                    key={i} 
                    className={cn("hover:bg-slate-50 transition-colors cursor-pointer", editingTemplate?.id === doc.id && "bg-blue-50/50")}
                    onClick={() => setEditingTemplate(doc)}
                  >
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><FileText className="w-4 h-4" /></div>
                      <span className="font-semibold text-sm">{doc.name}</span>
                    </td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium">{doc.category}</span></td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 py-0.5 px-2 rounded-full text-xs font-medium", doc.status === 'Active' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                        <span className={cn("size-1.5 rounded-full", doc.status === 'Active' ? "bg-green-500" : "bg-amber-500")}></span>
                        {doc.status === 'Active' ? 'Ativo' : 'Rascunho'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Deseja excluir o modelo "${doc.name}"?`)) {
                            setTemplates(templates.filter(t => t.id !== doc.id));
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                        title="Excluir Modelo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-lg mb-6">Editor de Modelo</h3>
          {editingTemplate ? (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome do Modelo</label>
                <input 
                  className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3" 
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Instruções da IA</label>
                  <button 
                    onClick={generateStructureWithAI}
                    disabled={isGenerating}
                    className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1 disabled:opacity-50"
                  >
                    {isGenerating ? <div className="size-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Gerar Estrutura
                  </button>
                </div>
                <textarea 
                  className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3 h-32 resize-none font-mono outline-none focus:ring-2 focus:ring-blue-600/20" 
                  value={editingTemplate.instructions}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, instructions: e.target.value })}
                  placeholder="Ex: Gere um documento SOAP focado em cardiologia..."
                />
              </div>
              <div>
                <div className="flex justify-between mb-3">
                  <label className="text-xs font-bold text-slate-500 uppercase block">Seções do Documento</label>
                  <button onClick={addSection} className="text-xs font-bold text-blue-600 hover:underline">+ Adicionar</button>
                </div>
                <div className="space-y-2">
                  {editingTemplate.sections.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <input 
                        className="text-xs font-semibold flex-1 bg-transparent border-none outline-none" 
                        value={s}
                        onChange={(e) => updateSection(i, e.target.value)}
                      />
                      <button onClick={() => removeSection(i)} className="text-slate-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase">Modelo LaTeX (Opcional)</label>
                  <label className="text-[10px] font-bold text-blue-600 cursor-pointer hover:underline">
                    Carregar .tex
                    <input 
                      type="file" 
                      accept=".tex" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (re) => {
                            setEditingTemplate({ ...editingTemplate, latexTemplate: re.target?.result as string });
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea 
                  className="w-full rounded-lg border-slate-200 bg-slate-900 text-slate-300 text-[10px] py-2 px-3 h-32 resize-none font-mono" 
                  value={editingTemplate.latexTemplate || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, latexTemplate: e.target.value })}
                  placeholder="\documentclass{article}..."
                />
                <p className="text-[10px] text-slate-400 mt-1 italic">A IA usará este código como base estrutural para o documento.</p>
              </div>

              <button onClick={saveTemplate} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow-sm hover:bg-blue-700 transition-all">Salvar Modelo</button>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              Selecione um roteiro para editar
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

const SessionPrepView = ({ 
  setView, 
  patientName, 
  setPatientName, 
  caseSummary, 
  setCaseSummary, 
  scripts,
  setScriptInstructions,
  setChecklistItems,
  scriptInstructions,
  patients,
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
  deviceError,
  onRefreshDevices,
  onRequestPermission
}: { 
  setView: (v: View) => void,
  patientName: string,
  setPatientName: (v: string) => void,
  caseSummary: string,
  setCaseSummary: (v: string) => void,
  scripts: Script[],
  setScriptInstructions: (v: string) => void,
  setChecklistItems: (v: { label: string, done: boolean }[]) => void,
  scriptInstructions: string,
  patients: PatientModel[],
  devices: MediaDeviceInfo[],
  selectedDeviceId: string,
  setSelectedDeviceId: (v: string) => void,
  deviceError: string | null,
  onRefreshDevices: () => void,
  onRequestPermission: () => void
}) => {
  const [contextType, setContextType] = useState<'text' | 'file'>('text');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState | 'unknown'>('unknown');
  const testCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const testStreamRef = React.useRef<MediaStream | null>(null);
  const testAnimRef = React.useRef<number | null>(null);

  const checkPermission = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as any });
        setPermissionState(result.state);
        result.onchange = () => {
          setPermissionState(result.state);
          if (result.state === 'granted') onRefreshDevices();
        };
      }
    } catch (e) {
      console.warn("Permissions API not supported", e);
    }
  };

  React.useEffect(() => {
    checkPermission();
  }, []);

  const stopTestMic = () => {
    setIsTestingMic(false);
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(t => t.stop());
      testStreamRef.current = null;
    }
    if (testAnimRef.current) {
      cancelAnimationFrame(testAnimRef.current);
      testAnimRef.current = null;
    }
  };

  const startTestMic = async () => {
    try {
      setIsTestingMic(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true 
      });
      testStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!testCanvasRef.current) return;
        const canvas = testCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] / 2;
          ctx.fillStyle = `rgb(59, 130, 246)`; // blue-500
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }

        testAnimRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (err) {
      console.error("Error testing mic:", err);
      setIsTestingMic(false);
    }
  };

  React.useEffect(() => {
    return () => stopTestMic();
  }, []);

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatientId(patientId);
    const selected = patients.find(p => p.id === patientId);
    if (selected) {
      setPatientName(selected.name);
      // Optionally pre-fill case summary with patient history if empty
      if (!caseSummary.trim()) {
        setCaseSummary(`[Histórico do Paciente]: ${selected.history}\n[Medicações]: ${selected.medications}\n[Alergias]: ${selected.allergies}\n\n`);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setIsAnalyzing(true);
      setTimeout(() => {
        setCaseSummary(`[Informações extraídas do arquivo ${file.name}]: Paciente com histórico de hipertensão e diabetes tipo 2. Relata dores articulares recorrentes.`);
        setIsAnalyzing(false);
      }, 1500);
    }
  };

  const handleScriptSelect = (scriptId: string) => {
    setSelectedScriptId(scriptId);
    const selected = scripts.find(s => s.id === scriptId);
    if (selected) {
      setScriptInstructions(selected.instructions);
      setChecklistItems(selected.checklist.map(item => ({ ...item, done: false })));
    } else {
      // Fallback to default if somehow unselected
      setScriptInstructions(DEFAULT_SCRIPT.instructions);
      setChecklistItems(DEFAULT_SCRIPT.checklist.map(item => ({ ...item, done: false })));
    }
  };

  const startSession = () => {
    if (!scriptInstructions) {
      // Use default if none selected
      setScriptInstructions(DEFAULT_SCRIPT.instructions);
      setChecklistItems(DEFAULT_SCRIPT.checklist.map(item => ({ ...item, done: false })));
    }
    setView('live-session');
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Preparação da Sessão</h1>
          <p className="text-slate-500 text-sm">Identifique o paciente e forneça o contexto clínico prévio.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={startSession} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2">
            <Play className="w-4 h-4 fill-current" /> Iniciar Sessão
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-8">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold">Identificação do Paciente</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Selecionar Paciente Cadastrado</label>
                <select 
                  value={selectedPatientId}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm p-2.5 focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                >
                  <option value="">-- Selecione um paciente (opcional) --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nome do Paciente</label>
                <input 
                  className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none p-2.5" 
                  placeholder="Nome completo" 
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">ID do Paciente</label>
                  <input className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm p-2.5" placeholder="#8829-X" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Data da Consulta</label>
                  <input className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm p-2.5" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold">Seleção de Roteiro</h2>
              </div>
              <button 
                onClick={() => setView('scripts')}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Criar Novo
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Escolha um roteiro pré-definido ou use o padrão simplificado:</p>
              <select 
                value={selectedScriptId}
                onChange={(e) => handleScriptSelect(e.target.value)}
                className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Roteiro Padrão Simplificado</option>
                {scripts.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-blue-900 mb-1">Instruções Ativas:</p>
                    <p className="text-[11px] text-blue-700 leading-relaxed italic">
                      {scriptInstructions || DEFAULT_SCRIPT.instructions}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold">Teste de Microfone</h2>
              </div>
              <button 
                onClick={onRefreshDevices}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                title="Atualizar lista de dispositivos"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              {deviceError || permissionState === 'denied' ? (
                <div className="p-4 bg-red-50 border border-red-100 rounded-lg space-y-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-red-800">Acesso ao Microfone Bloqueado</p>
                      <p className="text-xs text-red-700 leading-relaxed">
                        {deviceError || "O navegador bloqueou o acesso ao microfone. O ECHO scribe precisa dele para realizar a transcrição."}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white/50 p-3 rounded-md border border-red-200 space-y-2">
                    <p className="text-[11px] font-bold text-red-900 uppercase tracking-wider">Como resolver:</p>
                    <ol className="text-[11px] text-red-800 space-y-1.5 list-decimal ml-4">
                      <li>Clique no <b>ícone de Cadeado</b> na barra de endereços do navegador.</li>
                      <li>Certifique-se de que <b>"Microfone"</b> está como <b>"Permitir"</b>.</li>
                      <li>Se o problema persistir, tente <b>abrir o app em uma nova aba</b> usando o ícone no canto superior direito do preview.</li>
                    </ol>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={onRequestPermission}
                      className="w-full py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all shadow-sm"
                    >
                      Tentar Liberar Agora
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => window.location.reload()}
                        className="py-2 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-all"
                      >
                        Recarregar
                      </button>
                      <button 
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="py-2 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Nova Aba
                      </button>
                    </div>
                  </div>
                </div>
              ) : devices.length === 0 ? (
                <div className="p-6 bg-blue-50 border border-blue-100 rounded-lg text-center space-y-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <Mic className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-blue-900">Configurar Microfone</p>
                    <p className="text-xs text-blue-700">Clique no botão abaixo para permitir o acesso ao áudio e iniciar o teste.</p>
                  </div>
                  <button 
                    onClick={onRequestPermission}
                    className="px-6 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200"
                  >
                    Ativar Microfone
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Dispositivo de Entrada</label>
                    <select 
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {devices.map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microfone ${device.deviceId.slice(0, 5)}...`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="h-12 bg-slate-900 rounded-lg overflow-hidden relative">
                      <canvas 
                        ref={testCanvasRef}
                        className="w-full h-full"
                        width={400}
                        height={48}
                      />
                      {!isTestingMic && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px]">
                          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Clique para testar</span>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={isTestingMic ? stopTestMic : startTestMic}
                      className={cn(
                        "w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                        isTestingMic 
                          ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" 
                          : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                      )}
                    >
                      {isTestingMic ? (
                        <><Pause className="w-3 h-3" /> Parar Teste</>
                      ) : (
                        <><PlayCircle className="w-3 h-3" /> Iniciar Teste de Voz</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Clipboard className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold">Contexto Prévio</h2>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setContextType('text')}
                className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all", contextType === 'text' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Texto
              </button>
              <button 
                onClick={() => setContextType('file')}
                className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all", contextType === 'file' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Arquivo
              </button>
            </div>
          </div>

          {contextType === 'text' ? (
            <textarea 
              className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm h-[320px] resize-none p-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Histórico ou queixas prévias..."
              value={caseSummary}
              onChange={(e) => setCaseSummary(e.target.value)}
            />
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative h-[320px]">
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                />
                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <p className="font-bold text-slate-700 text-center">Clique ou arraste o arquivo aqui</p>
                <p className="text-xs text-slate-400 mt-1">PDF, DOCX ou TXT</p>
              </div>
              
              {fileName && (
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-bold text-blue-900">{fileName}</p>
                      {isAnalyzing && <p className="text-[10px] text-blue-600 animate-pulse">Analisando...</p>}
                    </div>
                  </div>
                  <button onClick={() => setFileName(null)} className="text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <button 
          onClick={startSession} 
          className="w-full max-w-md py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-3 group"
        >
          <Play className="w-6 h-6 fill-current group-hover:scale-110 transition-transform" />
          <span>INICIAR SESSÃO CLÍNICA</span>
        </button>
      </div>
    </div>
  );
};

const LiveSessionView = ({ 
  setView, 
  transcriptions, 
  setTranscriptions,
  patientName,
  checklistItems,
  setChecklistItems,
  scriptInstructions,
  setScriptInstructions,
  setConfirmed,
  scripts,
  setHistory,
  caseSummary,
  summary,
  setCurrentHistoryId,
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
  deviceError
}: { 
  setView: (v: View) => void, 
  transcriptions: TranscriptionPart[], 
  setTranscriptions: React.Dispatch<React.SetStateAction<TranscriptionPart[]>>,
  patientName: string,
  checklistItems: { label: string, done: boolean }[],
  setChecklistItems: (v: { label: string, done: boolean }[]) => void,
  scriptInstructions: string,
  setScriptInstructions: (v: string) => void,
  setConfirmed: (v: boolean) => void,
  scripts: Script[],
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  caseSummary: string,
  summary: string,
  setCurrentHistoryId: (id: string | null) => void,
  devices: MediaDeviceInfo[],
  selectedDeviceId: string,
  setSelectedDeviceId: (v: string) => void,
  deviceError: string | null
}) => {
  const [authorized, setAuthorized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionReceived, setTranscriptionReceived] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  
  const serviceRef = React.useRef<GeminiLiveService | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const progress = Math.round((checklistItems.filter(s => s.done).length / checklistItems.length) * 100);

  const toggleStep = (index: number) => {
    const newItems = [...checklistItems];
    newItems[index].done = !newItems[index].done;
    setChecklistItems(newItems);
  };

  const handleScriptSelect = (scriptId: string) => {
    const selected = scripts.find(s => s.id === scriptId);
    if (selected) {
      setScriptInstructions(selected.instructions);
      setChecklistItems(selected.checklist.map(item => ({ ...item, done: false })));
    }
  };

  React.useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.stop();
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const drawWaveform = () => {
    if (analyserRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'rgb(15, 23, 42)'; // bg-slate-900
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgb(59, 130, 246)'; // text-blue-500
      ctx.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Also update audioLevel for the small bars
      const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(freqData);
      const average = freqData.reduce((a, b) => a + b, 0) / freqData.length;
      setAudioLevel(average);

      animationFrameRef.current = requestAnimationFrame(drawWaveform);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      setIsPaused(false);
      setTranscriptionReceived(false);
      setRecordingStartTime(null);
      setConnectionStatus('disconnected');
      setAudioLevel(0);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (serviceRef.current) {
        serviceRef.current.stop();
        serviceRef.current = null;
      }
    } else {
      setIsRecording(true);
      setIsPaused(false);
      setTranscriptionReceived(false);
      setRecordingStartTime(Date.now());
      setConnectionStatus('connecting');
      setLastErrorMessage(null);
      setTranscriptions([]); 
      try {
        const apiKey = process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
          throw new Error("Chave da API Gemini não encontrada. Verifique as configurações do ambiente.");
        }

        const service = new GeminiLiveService(
          apiKey, 
          (part) => {
            setTranscriptions(prev => [...prev, part]);
            setTranscriptionReceived(true);
            setConnectionStatus('connected');
          },
          (err) => {
            console.error("Gemini Service Error:", err);
            setLastErrorMessage(err?.message || "Erro na conexão com a API Gemini.");
            setConnectionStatus('error');
            setIsRecording(false);
          }
        );
        serviceRef.current = service;
        await service.start(selectedDeviceId);
        
        // Setup visualizer using the same stream and context
        const stream = service.getStream();
        const audioCtx = service.getAudioContext();
        
        if (stream && audioCtx) {
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 2048;
          source.connect(analyser);
          analyserRef.current = analyser;
          drawWaveform();
        }
        
        setConnectionStatus('connected');
      } catch (err: any) {
        console.error(err);
        setIsRecording(false);
        setConnectionStatus('error');
        setLastErrorMessage(err?.message || "Não foi possível iniciar o serviço de transcrição.");
        serviceRef.current = null;
      }
    }
  };

  const togglePause = () => {
    if (serviceRef.current) {
      const nextPaused = !isPaused;
      setIsPaused(nextPaused);
      serviceRef.current.setPaused(nextPaused);
    }
  };

  const handleFinalize = async (targetView: View = 'history') => {
    if (isRecording) {
      setIsRecording(false);
      setIsPaused(false);
      setTranscriptionReceived(false);
      setRecordingStartTime(null);
      setConnectionStatus('disconnected');
      setAudioLevel(0);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (serviceRef.current) {
        serviceRef.current.stop();
        serviceRef.current = null;
      }

      // Add to history in Firestore
      if (auth.currentUser) {
        try {
          const newHistoryItem = {
            patient: patientName || 'Paciente Sem Nome',
            date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            script: scripts.find(s => s.instructions === scriptInstructions)?.name || 'Roteiro Personalizado',
            status: 'Concluído',
            transcriptions: [...transcriptions],
            caseSummary: caseSummary,
            summary: summary,
            scriptInstructions: scriptInstructions,
            ownerUid: auth.currentUser.uid,
            createdAt: serverTimestamp()
          };
          const docRef = await addDoc(collection(db, 'history'), newHistoryItem);
          if (typeof setCurrentHistoryId === 'function') {
            setCurrentHistoryId(docRef.id);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'history');
        }
      }
    }
    setView(targetView);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-7 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold">Sessão Ambiente</h2>
              {patientName && <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Paciente: {patientName}</p>}
            </div>
            {isRecording && (
              <div className="flex items-center gap-2">
                <div className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                  connectionStatus === 'connecting' ? "bg-amber-100 text-amber-700 animate-pulse" :
                  connectionStatus === 'connected' ? "bg-emerald-100 text-emerald-700" :
                  connectionStatus === 'error' ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                )}>
                  {connectionStatus === 'connecting' ? 'Conectando...' :
                   connectionStatus === 'connected' ? 'API Conectada' :
                   connectionStatus === 'error' ? 'Erro na Conexão' : 'Desconectado'}
                </div>
                {connectionStatus === 'connected' && (
                  <div className="flex items-center gap-1 h-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div 
                        key={i} 
                        className={cn(
                          "w-1 rounded-full transition-all duration-75",
                          audioLevel > (i * 10) ? "bg-emerald-500" : "bg-slate-200"
                        )}
                        style={{ height: `${Math.min(100, Math.max(20, audioLevel * (i/2)))}%` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setView('session-prep')}
              className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button onClick={() => setShowFinalizeModal(true)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">Finalizar</button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-md border border-slate-100 space-y-6">
          {deviceError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Problema com o Microfone</p>
                <p className="text-xs opacity-90">{deviceError}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-2 text-xs font-bold underline hover:no-underline"
                >
                  Recarregar página
                </button>
              </div>
            </div>
          )}
          {connectionStatus === 'error' && lastErrorMessage && (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-3 text-amber-700">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Erro na Transcrição</p>
                <p className="text-xs opacity-90">{lastErrorMessage}</p>
                {lastErrorMessage.includes("Acesso ao microfone negado") && (
                  <div className="mt-2 p-2 bg-white/50 rounded border border-amber-200 text-[10px]">
                    <p className="font-bold mb-1">Como resolver:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Clique no ícone de cadeado na barra de endereços e permita o microfone.</li>
                      <li>Verifique se o microfone não está sendo usado por outro aplicativo.</li>
                      <li>Tente abrir o aplicativo em uma <strong>Nova Aba</strong> usando o botão no topo da tela.</li>
                    </ul>
                  </div>
                )}
                <p className="text-[10px] mt-1 opacity-75 italic">Dica: Verifique sua conexão de internet ou tente novamente em alguns instantes.</p>
              </div>
            </div>
          )}
          <div className="flex justify-between items-center">
            <div>
              <p className="text-lg font-bold">Fluxo de Áudio de Alta Fidelidade</p>
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", isRecording ? "bg-red-500 animate-pulse" : "bg-slate-300")}></span>
                <p className="text-slate-500 text-sm">{isRecording ? "Ouvindo detalhes clínicos..." : "Microfone inativo"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isRecording && (
                <div className="flex items-center gap-2">
                  <select 
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-2 bg-slate-50 focus:ring-2 focus:ring-blue-600 outline-none max-w-[150px]"
                  >
                    {devices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microfone ${device.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Recarregar dispositivos"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                {!isRecording ? (
                  <button 
                    onClick={() => {
                      if (!authorized) {
                        setLastErrorMessage("Por favor, confirme a autorização do paciente antes de iniciar a gravação.");
                        setConnectionStatus('error');
                        return;
                      }
                      toggleRecording();
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-blue-700 transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" /> Iniciar
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={togglePause}
                      className={cn(
                        "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all",
                        isPaused ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700 border border-amber-200"
                      )}
                    >
                      {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                      {isPaused ? "Retomar" : "Pausar"}
                    </button>
                    <button 
                      onClick={() => setShowFinalizeModal(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-red-700 transition-all"
                    >
                      <X className="w-4 h-4" /> Finalizar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("size-5 rounded-full flex items-center justify-center transition-colors", authorized ? "bg-emerald-600 text-white" : "border-2 border-emerald-200 bg-white")}>
                {authorized && <Check className="w-3 h-3" />}
              </div>
              <p className="text-sm font-bold text-emerald-900">O paciente autorizou a gravação e transcrição da consulta</p>
            </div>
            <button 
              onClick={() => setAuthorized(!authorized)}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", authorized ? "bg-emerald-600 text-white" : "bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50")}
            >
              {authorized ? "Autorizado" : "Confirmar Autorização"}
            </button>
          </div>

          <div className="w-full bg-slate-900 aspect-video rounded-lg flex items-center justify-center relative overflow-hidden">
            <canvas 
              ref={canvasRef} 
              className="w-full h-full"
              width={800}
              height={400}
            />
            <div className="absolute bottom-4 left-4 right-4 flex justify-between text-white/50 text-[10px] font-mono pointer-events-none">
              <span>{isRecording ? "GRAVANDO EM TEMPO REAL" : "MICROFONE PRONTO"}</span>
              <span>Estéreo • 48kHz • PCM</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold border-b border-slate-200 pb-2">Transcrição em Tempo Real</h3>
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-sm leading-relaxed max-h-[400px] overflow-y-auto">
            {transcriptions.map((t, i) => (
              <p key={i} className="text-slate-700">
                {t.text}
              </p>
            ))}
            {isRecording && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-slate-400 italic animate-pulse">
                  <Sparkles className="w-3 h-3" />
                  <span>{transcriptions.length > 0 ? "IA transcrevendo..." : "IA processando áudio (aguardando fala)..."}</span>
                </div>
                {!transcriptionReceived && recordingStartTime && (Date.now() - recordingStartTime > 10000) && (
                  <div className="p-2 bg-red-50 border border-red-100 rounded text-[10px] text-red-600 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" />
                    <span>Nenhuma fala detectada ainda. Verifique se o microfone correto está selecionado e se você está falando próximo a ele.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold">Alterar Roteiro</span>
            </div>
            <button 
              onClick={() => setView('scripts')}
              className="text-[10px] font-bold px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
            >
              Gerar Novo
            </button>
          </div>
          <div className="p-4">
            <select 
              onChange={(e) => handleScriptSelect(e.target.value)}
              className="w-full rounded-lg border-slate-200 bg-slate-50 text-xs p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              defaultValue=""
            >
              <option value="" disabled>Trocar roteiro ativo...</option>
              {scripts.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between">
            <span className="text-sm font-semibold">Progresso do Roteiro</span>
            <span className="text-sm font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5"><div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${progress}%` }}></div></div>
          <div className="p-4 space-y-4">
            {checklistItems.map((item, i) => (
              <button 
                key={i} 
                onClick={() => toggleStep(i)}
                className={cn("w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all", item.done ? "bg-blue-50 border border-blue-100" : "hover:bg-slate-50 border border-transparent")}
              >
                <div className={cn("size-6 rounded-full flex items-center justify-center shrink-0", item.done ? "bg-blue-600 text-white" : "border-2 border-slate-200 text-transparent")}>
                  <Check className="w-3 h-3" />
                </div>
                <span className={cn("text-sm font-bold", item.done ? "text-blue-900" : "text-slate-500")}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold">Instruções do Roteiro</span>
          </div>
          <div className="p-4">
            <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-600 leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap font-mono">
              {scriptInstructions}
            </div>
          </div>
        </div>
      </div>

      {showFinalizeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="p-6 text-center space-y-4">
              <div className="size-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Finalizar Sessão?</h3>
                <p className="text-slate-500 text-sm">
                  Deseja realmente finalizar esta sessão de entrevista? Todos os dados capturados serão salvos no histórico.
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setShowFinalizeModal(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all"
              >
                Continuar Sessão
              </button>
              <button 
                onClick={() => {
                  setShowFinalizeModal(false);
                  handleFinalize('transcription-validation');
                }}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
              >
                Sim, Finalizar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const TranscriptionValidationView = ({ 
  setView, 
  transcriptions, 
  patientName,
  caseSummary,
  scriptInstructions,
  confirmed,
  setConfirmed,
  summary,
  setSummary,
  currentHistoryId
}: { 
  setView: (v: View) => void, 
  transcriptions: TranscriptionPart[], 
  patientName: string,
  caseSummary: string,
  scriptInstructions: string,
  confirmed: boolean,
  setConfirmed: (v: boolean) => void,
  summary: string,
  setSummary: (v: string) => void,
  currentHistoryId: string | null
}) => {
  const [activeTab, setActiveTab] = useState<'transcription' | 'context' | 'summary'>('summary');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customSummaryPrompt, setCustomSummaryPrompt] = useState<string>('');

  const handleSaveSummary = async () => {
    if (!currentHistoryId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'history', currentHistoryId), {
        summary: summary,
        transcriptions: transcriptions // Save any edits to transcription parts too if needed
      });
      alert('Resumo salvo com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `history/${currentHistoryId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const generateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = customSummaryPrompt.trim() 
        ? `Instrução Adicional do Usuário: ${customSummaryPrompt}\n\n` + 
          `Gere um resumo estruturado da entrevista médica abaixo, aplicando a transcrição ao contexto prévio e ao roteiro de entrevista selecionado.\n\n` +
          `Contexto Prévio do Paciente: ${caseSummary}\n` +
          `Roteiro de Entrevista (Objetivos e Checklist): ${scriptInstructions}\n\n` +
          `Transcrição da Sessão:\n${transcriptions.map(t => t.text).join('\n')}\n\n` +
          `O resumo deve ser profissional, conciso e focado nos pontos clínicos relevantes. Demonstre claramente como as informações da transcrição validam ou complementam o contexto prévio e como os pontos do roteiro foram abordados.`
        : `Gere um resumo estruturado da entrevista médica abaixo, aplicando a transcrição ao contexto prévio e ao roteiro de entrevista selecionado.
            
            Contexto Prévio do Paciente: ${caseSummary}
            Roteiro de Entrevista (Objetivos e Checklist): ${scriptInstructions}
            
            Transcrição da Sessão:
            ${transcriptions.map(t => t.text).join('\n')}
            
            O resumo deve ser profissional, conciso e focado nos pontos clínicos relevantes. Demonstre claramente como as informações da transcrição validam ou complementam o contexto prévio e como os pontos do roteiro foram abordados.`;

      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          parts: [{ text: prompt }]
        }]
      });
      const response = await model;
      setSummary(response.text || 'Não foi possível gerar o resumo.');
    } catch (error) {
      console.error("Erro ao gerar resumo:", error);
      setSummary('Erro ao gerar resumo automático.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleCopy = () => {
    let textToCopy = '';
    if (activeTab === 'transcription') textToCopy = transcriptions.map(t => t.text).join('\n');
    else if (activeTab === 'context') textToCopy = `Contexto: ${caseSummary}\n\nRoteiro: ${scriptInstructions}`;
    else if (activeTab === 'summary') textToCopy = summary;

    navigator.clipboard.writeText(textToCopy);
    alert('Texto copiado para a área de transferência!');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = (format: 'pdf' | 'latex' | 'txt' = 'txt') => {
    let content = '';
    let filename = '';
    const extension = format === 'pdf' ? 'pdf' : format === 'latex' ? 'tex' : 'txt';
    
    if (activeTab === 'transcription') {
      content = transcriptions.map(t => t.text).join('\n');
      filename = `transcricao_${patientName || 'paciente'}.${extension}`;
    } else if (activeTab === 'context') {
      content = `Contexto: ${caseSummary}\n\nRoteiro: ${scriptInstructions}`;
      filename = `contexto_${patientName || 'paciente'}.${extension}`;
    } else if (activeTab === 'summary') {
      content = summary;
      filename = `resumo_${patientName || 'paciente'}.${extension}`;
    }

    if (format === 'pdf') {
      const doc = new jsPDF();
      const splitText = doc.splitTextToSize(content, 180);
      doc.setFontSize(12);
      doc.text(splitText, 15, 20);
      doc.save(filename);
    } else if (format === 'latex') {
      const latexContent = `
\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[portuguese]{babel}
\\begin{document}
\\title{Resumo Médico - ${patientName || 'Paciente'}}
\\author{ECHO scribe}
\\date{\\today}
\\maketitle

${content.replace(/&/g, '\\&').replace(/%/g, '\\%').replace(/\$/g, '\\$').replace(/#/g, '\\#').replace(/_/g, '\\_').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/~/g, '\\textasciitilde').replace(/\^/g, '\\textasciicircum')}

\\end{document}
      `.trim();
      const blob = new Blob([latexContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    if (activeTab === 'summary' && !summary && !isGeneratingSummary) {
      generateSummary();
    }
  }, [activeTab]);

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
      <aside className="w-full lg:w-64 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 sticky top-24">
          <p className="text-xs font-bold text-slate-400 uppercase mb-4">Ações Rápidas</p>
          <div className="space-y-2">
            <button onClick={() => handleDownload('pdf')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-semibold">
              <Download className="w-4 h-4 text-red-500" /> Salvar como PDF
            </button>
            <button onClick={() => handleDownload('latex')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-semibold">
              <FileCode className="w-4 h-4 text-blue-500" /> Exportar LaTeX
            </button>
            <button onClick={handlePrint} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-semibold">
              <Printer className="w-4 h-4 text-slate-500" /> Imprimir
            </button>
            <button onClick={handleCopy} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-semibold">
              <Copy className="w-4 h-4 text-emerald-500" /> Copiar Texto
            </button>
            <button 
              onClick={handleSaveSummary} 
              disabled={isSaving || !currentHistoryId}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-semibold text-blue-600 disabled:opacity-50"
            >
              {isSaving ? <div className="size-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Paciente</p>
              <p className="text-sm font-bold text-slate-700">{patientName || 'Não Identificado'}</p>
            </div>
            {confirmed ? (
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">Transcrição Confirmada</span>
              </div>
            ) : (
              <button 
              onClick={() => {
                setConfirmed(true);
              }}
              disabled={!summary || isGeneratingSummary}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingSummary ? "Processando Resumo..." : summary ? "Confirmar Transcrição" : "Aguardando Resumo IA..."}
            </button>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">Validação da Transcrição</h2>
              {confirmed && (
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest">Confirmada</span>
              )}
            </div>
            <p className="text-slate-500 text-sm mt-1">Revise a transcrição, o contexto e o resumo gerado.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setView('live-session')} className="px-4 py-2 bg-slate-100 rounded-lg font-bold text-sm">Voltar</button>
            <button onClick={() => setView('doc-viewer')} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm flex items-center gap-2">
              Gerar Documento <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('transcription')}
            className={cn(
              "px-6 py-3 text-sm font-bold transition-all border-b-2",
              activeTab === 'transcription' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            Transcrição
          </button>
          <button 
            onClick={() => setActiveTab('context')}
            className={cn(
              "px-6 py-3 text-sm font-bold transition-all border-b-2",
              activeTab === 'context' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            Contexto Prévio
          </button>
          <button 
            onClick={() => setActiveTab('summary')}
            className={cn(
              "px-6 py-3 text-sm font-bold transition-all border-b-2",
              activeTab === 'summary' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            Resumo IA
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
          {activeTab === 'transcription' && (
            <>
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-500 uppercase">Transcrição Completa</span>
                  <div className="h-4 w-px bg-slate-200" />
                  <div className="flex gap-1">
                    <button onClick={handleCopy} className="p-1.5 text-slate-500 hover:text-emerald-600 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-all" title="Copiar Texto"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDownload('pdf')} className="p-1.5 text-slate-500 hover:text-red-600 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-all" title="Salvar como PDF"><Download className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDownload('latex')} className="p-1.5 text-slate-500 hover:text-blue-600 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-all" title="Exportar LaTeX"><FileCode className="w-3.5 h-3.5" /></button>
                    <button onClick={handlePrint} className="p-1.5 text-slate-500 hover:text-slate-700 rounded hover:bg-white border border-transparent hover:border-slate-200 transition-all" title="Imprimir"><Printer className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"><Search className="w-4 h-4" /></button>
                  <button className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100"><Sparkles className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                {transcriptions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-medium">Nenhuma transcrição capturada nesta sessão.</p>
                  </div>
                ) : (
                  transcriptions.map((t, i) => (
                    <div key={i} className="space-y-2">
                      <p 
                        className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600" 
                        contentEditable
                        suppressContentEditableWarning={true}
                      >
                        {t.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'context' && (
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-slate-900">Contexto e Roteiro</h3>
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-all">
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                  <button onClick={() => handleDownload('pdf')} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-all">
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button onClick={() => handleDownload('latex')} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 transition-all">
                    <FileCode className="w-3 h-3" /> LaTeX
                  </button>
                  <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                    <Printer className="w-3 h-3" /> Imprimir
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Contexto do Paciente</h3>
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {caseSummary || "Nenhum contexto prévio foi fornecido para esta sessão."}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Roteiro Utilizado</h3>
                <div className="p-6 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-900 leading-relaxed">
                  {scriptInstructions}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="p-8 space-y-6">
              <div className="flex flex-col gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="flex items-center gap-2 text-blue-900">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm font-bold">Orientar a IA (Prompt Customizado)</span>
                </div>
                <textarea 
                  value={customSummaryPrompt}
                  onChange={(e) => setCustomSummaryPrompt(e.target.value)}
                  placeholder="Ex: Foque nos sintomas de dor lombar e ignore as conversas sobre clima. Use um tom mais formal."
                  className="w-full p-3 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none min-h-[80px] bg-white"
                />
                <div className="flex justify-end">
                  <button 
                    onClick={generateSummary}
                    disabled={isGeneratingSummary}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingSummary ? <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Gerar Resumo com estas Orientações
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Resumo Estruturado pela IA</h3>
                <div className="flex gap-2">
                  <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-all">
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                  <button onClick={() => handleDownload('pdf')} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-all">
                    <Download className="w-3 h-3" /> PDF
                  </button>
                  <button onClick={() => handleDownload('latex')} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 transition-all">
                    <FileCode className="w-3 h-3" /> LaTeX
                  </button>
                  <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                    <Printer className="w-3 h-3" /> Imprimir
                  </button>
                </div>
              </div>
              
              {isGeneratingSummary ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="size-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-slate-500">Analisando transcrição e contexto...</p>
                </div>
              ) : (
                <textarea 
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Clique em regerar para processar o resumo ou escreva aqui..."
                  className="w-full p-6 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed min-h-[300px] focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none"
                />
              )}
            </div>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-900">Dica de Edição</p>
            <p className="text-xs text-amber-700 mt-1">Você pode clicar diretamente no texto para corrigir eventuais erros de reconhecimento de voz. A IA usará essas correções para melhorar a precisão do documento final.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const DocViewerView = ({ 
  setView, 
  patientName,
  templates,
  setTemplates,
  patients,
  transcriptions,
  caseSummary,
  scriptInstructions
}: { 
  setView: (v: View) => void, 
  patientName: string,
  templates: DocTemplate[],
  setTemplates: (t: DocTemplate[]) => void,
  patients: PatientModel[],
  transcriptions: TranscriptionPart[],
  caseSummary: string,
  scriptInstructions: string
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<DocTemplate | null>(templates[0] || null);
  const [selectedPatient, setSelectedPatient] = useState<PatientModel | null>(patients.find(p => p.name === patientName) || patients[0] || null);
  const [reportTitle, setReportTitle] = useState(selectedTemplate?.name || 'Relatório Médico');
  const [sections, setSections] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('');

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(templateFilter.toLowerCase()) ||
    t.category.toLowerCase().includes(templateFilter.toLowerCase())
  );

  const generateWithAI = async () => {
    if (!selectedTemplate) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

      const prompt = `
        Você é um assistente médico especializado em documentação clínica.
        Gere o conteúdo para um documento médico baseado nos seguintes dados:
        
        PACIENTE: ${selectedPatient?.name || patientName} (${selectedPatient?.age || 'N/A'}, ${selectedPatient?.gender || 'N/A'})
        CONTEXTO: ${caseSummary}
        ROTEIRO DE ENTREVISTA: ${scriptInstructions}
        TRANSCRIÇÃO DA SESSÃO: ${transcriptions.map(t => t.text).join(' ')}
        
        MODELO DE DOCUMENTO: ${selectedTemplate.name}
        INSTRUÇÕES DO MODELO: ${selectedTemplate.instructions}
        SEÇÕES REQUERIDAS: ${selectedTemplate.sections.join(', ')}
        
        ${selectedTemplate.latexTemplate ? `
        ESTRUTURA LATEX (USE COMO MODELO):
        ${selectedTemplate.latexTemplate}
        
        IMPORTANTE: O conteúdo gerado deve ser compatível com LaTeX. Evite formatação Markdown (como ** ou #). 
        O texto será inserido diretamente no modelo LaTeX.
        ` : ''}
        
        Retorne o resultado em formato JSON, onde as chaves são os nomes das seções requeridas e os valores são o conteúdo gerado para cada seção.
        Se houver um modelo LaTeX, certifique-se de que o conteúdo gerado se encaixe perfeitamente na estrutura proposta.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const text = response.text || '';
      
      // Attempt to parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const generatedSections = JSON.parse(jsonMatch[0]);
        setSections(generatedSections);
      } else {
        // Fallback if not JSON
        const fallbackSections: Record<string, string> = {};
        selectedTemplate.sections.forEach(s => {
          fallbackSections[s] = text;
        });
        setSections(fallbackSections);
      }
    } catch (error) {
      console.error("Erro ao gerar documento:", error);
      alert("Erro ao gerar documento com IA.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (selectedTemplate) {
      setReportTitle(selectedTemplate.name);
      const initialSections: Record<string, string> = {};
      selectedTemplate.sections.forEach(s => {
        initialSections[s] = sections[s] || `Aguardando geração para ${s}...`;
      });
      setSections(initialSections);
    }
  }, [selectedTemplate]);

  const handleDownload = (format: 'pdf' | 'latex' | 'txt' = 'txt') => {
    let content = `${reportTitle}\n\n`;
    content += `Paciente: ${selectedPatient?.name || patientName}\n`;
    content += `Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    
    selectedTemplate?.sections.forEach(s => {
      content += `${s.toUpperCase()}\n`;
      content += `${sections[s] || ''}\n\n`;
    });

    const filename = `${reportTitle.toLowerCase().replace(/\s+/g, '_')}_${selectedPatient?.name.toLowerCase().replace(/\s+/g, '_') || 'paciente'}.${format === 'latex' ? 'tex' : format}`;

    if (format === 'pdf') {
      const doc = new jsPDF();
      const splitText = doc.splitTextToSize(content, 180);
      doc.setFontSize(12);
      doc.text(splitText, 15, 20);
      doc.save(filename);
    } else if (format === 'latex') {
      let latexBody = '';
      if (selectedTemplate?.latexTemplate) {
        // If there's a template, try to inject the sections
        latexBody = selectedTemplate.latexTemplate;
        selectedTemplate.sections.forEach(s => {
          const placeholder = new RegExp(`\\[${s}\\]|\\{${s}\\}`, 'g');
          latexBody = latexBody.replace(placeholder, sections[s] || '');
        });
      } else {
        latexBody = `
\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[portuguese]{babel}
\\begin{document}
\\title{${reportTitle}}
\\author{ECHO scribe}
\\date{\\today}
\\maketitle

${content.replace(/&/g, '\\&').replace(/%/g, '\\%').replace(/\$/g, '\\$').replace(/#/g, '\\#').replace(/_/g, '\\_').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/~/g, '\\textasciitilde').replace(/\^/g, '\\textasciicircum')}

\\end{document}
        `.trim();
      }
      
      const blob = new Blob([latexBody], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleCopy = () => {
    let content = `${reportTitle}\n\n`;
    selectedTemplate?.sections.forEach(s => {
      content += `${s.toUpperCase()}\n${sections[s] || ''}\n\n`;
    });
    navigator.clipboard.writeText(content);
    alert('Documento copiado!');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
      <aside className="w-full lg:w-80 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <p className="text-xs font-bold text-slate-400 uppercase">Configuração</p>
            <button 
              onClick={() => setView('doc-config')}
              className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              <Settings2 className="w-3 h-3" /> Editar Modelos
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Filtrar Modelos</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar modelo..."
                  className="w-full rounded-lg border-slate-200 bg-slate-50 text-xs py-2 pl-9 pr-3 outline-none focus:ring-2 focus:ring-blue-600/20"
                  value={templateFilter}
                  onChange={(e) => setTemplateFilter(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Modelo de Documento</label>
              <select 
                className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-blue-600/20"
                value={selectedTemplate?.id}
                onChange={(e) => setSelectedTemplate(templates.find(t => t.id === e.target.value) || null)}
              >
                {filteredTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <label className="text-[10px] font-bold text-blue-600 cursor-pointer hover:bg-blue-50 p-2 rounded-lg border border-blue-100 flex items-center justify-center gap-2 transition-all">
                <FileUp className="w-3.5 h-3.5" /> Enviar Modelo LaTeX
                <input 
                  type="file" 
                  accept=".tex" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && selectedTemplate) {
                      const reader = new FileReader();
                      reader.onload = (re) => {
                        const newLatex = re.target?.result as string;
                        const updatedTemplates = templates.map(t => 
                          t.id === selectedTemplate.id ? { ...t, latexTemplate: newLatex } : t
                        );
                        setTemplates(updatedTemplates);
                        setSelectedTemplate({ ...selectedTemplate, latexTemplate: newLatex });
                        alert('Modelo LaTeX atualizado para este documento!');
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Paciente Selecionado</label>
            <select 
              className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-blue-600/20"
              value={selectedPatient?.id}
              onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value) || null)}
            >
              <option value="">Selecione um paciente</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Ações</p>
            <button 
              onClick={generateWithAI}
              disabled={isGenerating}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
            >
              {isGenerating ? <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isGenerating ? 'Gerando...' : 'Gerar com IA'}
            </button>
            <button 
              onClick={() => handleDownload('pdf')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-semibold"
            >
              <Download className="w-4 h-4 text-red-500" /> Salvar como PDF
            </button>
            <button 
              onClick={() => handleDownload('latex')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-semibold"
            >
              <FileCode className="w-4 h-4 text-blue-500" /> Exportar LaTeX
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-semibold">
              <Printer className="w-4 h-4 text-slate-500" /> Imprimir
            </button>
            <button 
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-sm font-semibold"
            >
              <Copy className="w-4 h-4 text-emerald-500" /> Copiar Texto
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-xl p-12 md:p-20 space-y-8">
        <div className="flex justify-between items-start border-b border-slate-100 pb-8">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-50 rounded flex items-center justify-center text-blue-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tighter">ECHO scribe Reports</h3>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Certified Medical Documentation</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-400 uppercase">Documento Nº</p>
            <p className="text-sm font-mono font-bold">SM-2024-{Math.floor(Math.random() * 1000000)}</p>
          </div>
        </div>

        <div className="space-y-6">
          <input 
            className="w-full text-2xl font-bold text-center uppercase tracking-wide border-none focus:ring-0 bg-transparent"
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-100">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Paciente</p>
              <p className="text-sm font-semibold">{selectedPatient?.name || patientName || 'Carlos Eduardo Mendonça'}</p>
              {selectedPatient && (
                <p className="text-[10px] text-slate-500">{selectedPatient.age} anos • {selectedPatient.gender}</p>
              )}
            </div>
            <div><p className="text-[10px] font-bold text-slate-400 uppercase">Data</p><p className="text-sm font-semibold">{new Date().toLocaleDateString('pt-BR')}</p></div>
          </div>
          
          <div className="space-y-8">
            {selectedTemplate?.sections.map((section, idx) => (
              <section key={idx} className="space-y-2">
                <h4 className="text-xs font-black text-blue-600 uppercase border-l-4 border-blue-600 pl-3">{section}</h4>
                <textarea 
                  className="w-full text-sm text-slate-700 border-none focus:ring-0 bg-transparent resize-none min-h-[100px]"
                  value={sections[section] || ''}
                  onChange={(e) => setSections({ ...sections, [section]: e.target.value })}
                />
              </section>
            ))}
          </div>
        </div>

        <div className="pt-16 flex flex-col items-center">
          <div className="w-64 h-px bg-slate-200 mb-2"></div>
          <p className="text-xs font-bold uppercase text-slate-500">Dr. Ricardo Silva</p>
          <p className="text-[10px] text-slate-400">Assinado Digitalmente via ScribaMed PKI</p>
        </div>
      </div>
    </div>
  );
};

const PatientModelsView = ({ 
  patients, 
  setPatients,
  history
}: { 
  patients: PatientModel[], 
  setPatients: (p: PatientModel[]) => void,
  history: HistoryItem[]
}) => {
  const [editingPatient, setEditingPatient] = useState<PatientModel | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const patientHistory = history.filter(h => h.patient === editingPatient?.name);

  const addPatient = async () => {
    if (!auth.currentUser) return;
    try {
      const newPatient = {
        name: 'Novo Paciente',
        age: '',
        gender: '',
        history: '',
        medications: '',
        allergies: '',
        updated: new Date().toLocaleDateString('pt-BR'),
        ownerUid: auth.currentUser.uid,
        createdAt: serverTimestamp()
      };
      const docRef = await addDoc(collection(db, 'patients'), newPatient);
      setEditingPatient({ id: docRef.id, ...newPatient } as PatientModel);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'patients');
    }
  };

  const savePatient = async () => {
    if (!editingPatient || !auth.currentUser) return;
    
    if (!editingPatient.name.trim()) {
      alert('O nome do paciente é obrigatório.');
      return;
    }

    try {
      const { id, ...data } = editingPatient;
      await updateDoc(doc(db, 'patients', id), {
        ...data,
        updated: new Date().toLocaleDateString('pt-BR')
      });
      setEditingPatient(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'patients');
    }
  };

  const deletePatient = async (id: string) => {
    if (window.confirm('Excluir este paciente?')) {
      try {
        await deleteDoc(doc(db, 'patients', id));
        if (editingPatient?.id === id) setEditingPatient(null);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'patients');
      }
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Meus Pacientes</h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie seus pacientes cadastrados para agilizar o atendimento.</p>
        </div>
        <button onClick={addPatient} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-200">
          <PlusCircle className="w-4 h-4" /> Novo Paciente
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => (
                  <tr 
                    key={p.id} 
                    className={cn("hover:bg-slate-50 transition-colors cursor-pointer", editingPatient?.id === p.id && "bg-blue-50/50")}
                    onClick={() => setEditingPatient(p)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase">{p.age} anos • {p.gender}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={(e) => { e.stopPropagation(); deletePatient(p.id); }} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
          {editingPatient ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nome Completo</label>
                  <input 
                    className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-blue-600/20" 
                    value={editingPatient.name}
                    onChange={(e) => setEditingPatient({ ...editingPatient, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Idade</label>
                  <input 
                    className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-blue-600/20" 
                    value={editingPatient.age}
                    onChange={(e) => setEditingPatient({ ...editingPatient, age: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Gênero</label>
                <select 
                  className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3 outline-none focus:ring-2 focus:ring-blue-600/20"
                  value={editingPatient.gender}
                  onChange={(e) => setEditingPatient({ ...editingPatient, gender: e.target.value })}
                >
                  <option value="">Selecione</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Histórico Médico</label>
                <textarea 
                  className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3 h-24 resize-none outline-none focus:ring-2 focus:ring-blue-600/20" 
                  value={editingPatient.history}
                  onChange={(e) => setEditingPatient({ ...editingPatient, history: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Medicações em Uso</label>
                  <textarea 
                    className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3 h-20 resize-none outline-none focus:ring-2 focus:ring-blue-600/20" 
                    value={editingPatient.medications}
                    onChange={(e) => setEditingPatient({ ...editingPatient, medications: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Alergias</label>
                  <textarea 
                    className="w-full rounded-lg border-slate-200 bg-slate-50 text-sm py-2 px-3 h-20 resize-none outline-none focus:ring-2 focus:ring-blue-600/20" 
                    value={editingPatient.allergies}
                    onChange={(e) => setEditingPatient({ ...editingPatient, allergies: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={savePatient} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all">
                  Salvar Paciente
                </button>
                <button 
                  onClick={() => setIsPreviewOpen(true)}
                  className="px-6 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
              </div>

              {isPreviewOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                  >
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="font-bold text-lg">Exemplo de Documento</h3>
                      <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-8 overflow-y-auto space-y-8 bg-white">
                      <div className="flex justify-between items-start border-b border-slate-100 pb-6">
                        <div>
                          <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">ECHO scribe</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Relatório Médico Inteligente</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">ID do Documento</p>
                          <p className="text-xs font-mono font-bold text-slate-900">PREVIEW-001</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Paciente</p>
                          <p className="text-sm font-bold text-slate-900">{editingPatient.name}</p>
                          <p className="text-[10px] text-slate-500">{editingPatient.age} anos • {editingPatient.gender}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Data</p>
                          <p className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <section className="space-y-2">
                          <h5 className="text-xs font-black text-blue-600 uppercase border-l-4 border-blue-600 pl-3">Queixa Principal</h5>
                          <p className="text-sm text-slate-600 leading-relaxed italic">
                            "Paciente relata dor torácica de início súbito há 2 horas, associada a sudorese e náuseas..."
                          </p>
                        </section>
                        <section className="space-y-2">
                          <h5 className="text-xs font-black text-blue-600 uppercase border-l-4 border-blue-600 pl-3">Histórico Relevante</h5>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {editingPatient.history || "Nenhum histórico registrado."}
                          </p>
                        </section>
                        <section className="space-y-2">
                          <h5 className="text-xs font-black text-blue-600 uppercase border-l-4 border-blue-600 pl-3">Medicações e Alergias</h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Medicações</p>
                              <p className="text-xs text-slate-600">{editingPatient.medications || "Nenhuma"}</p>
                            </div>
                            <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                              <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Alergias</p>
                              <p className="text-xs text-red-600 font-semibold">{editingPatient.allergies || "Nenhuma"}</p>
                            </div>
                          </div>
                        </section>
                      </div>

                      <div className="pt-12 flex flex-col items-center">
                        <div className="w-48 h-px bg-slate-200 mb-2"></div>
                        <p className="text-[10px] font-bold uppercase text-slate-500">Documento de Exemplo</p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest">Gerado automaticamente para visualização</p>
                      </div>
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                      <button 
                        onClick={() => setIsPreviewOpen(false)}
                        className="px-6 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-all"
                      >
                        Fechar Visualização
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Patient History Section */}
              <div className="mt-12 pt-8 border-t border-slate-100 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-600" />
                    Histórico de Sessões e Documentos
                  </h4>
                  <span className="bg-blue-50 text-blue-600 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest">
                    {patientHistory.length} {patientHistory.length === 1 ? 'Sessão' : 'Sessões'}
                  </span>
                </div>

                {patientHistory.length > 0 ? (
                  <div className="space-y-4">
                    {patientHistory.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-xl border border-slate-100 p-4 hover:border-blue-200 transition-all group">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{item.script}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">{item.date} às {item.time}</p>
                          </div>
                          <span className={cn(
                            "text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest",
                            item.status === 'Concluído' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {item.status}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                            <FileText className="w-3 h-3" /> Ver Documento
                          </button>
                          <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                            <Download className="w-3 h-3" /> Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Clock className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">Nenhuma sessão registrada para este paciente.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Users className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-sm font-medium">Selecione um paciente para editar ou crie um novo modelo.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Real Data State
  const [scripts, setScripts] = useState<Script[]>([]);
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);
  const [patientModels, setPatientModels] = useState<PatientModel[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Admin Dashboard Global State
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allHistory, setAllHistory] = useState<any[]>([]);

  // Session State
  const [patientName, setPatientName] = useState('');
  const [caseSummary, setCaseSummary] = useState('');
  const [scriptInstructions, setScriptInstructions] = useState('');
  const [checklistItems, setChecklistItems] = useState<{ label: string, done: boolean }[]>([]);
  const [transcriptions, setTranscriptions] = useState<TranscriptionPart[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);

  // Microphone & Device State
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Device Detection Logic
  const getDevices = async (forcePrompt = false) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setDeviceError("Seu navegador não suporta gravação de áudio ou você não está em um ambiente seguro (HTTPS).");
        return;
      }

      // Check if we already have permission by looking at labels
      const initialDevices = await navigator.mediaDevices.enumerateDevices();
      const hasLabels = initialDevices.some(d => d.kind === 'audioinput' && d.label !== '');

      // Only prompt if forced or if we have no devices at all
      if (forcePrompt || (initialDevices.filter(d => d.kind === 'audioinput').length > 0 && !hasLabels && forcePrompt)) {
        try {
          setDeviceError(null); // Clear error before trying
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
        } catch (permErr: any) {
          console.error("Permission error:", permErr);
          if (permErr.name === 'NotFoundError' || permErr.name === 'DevicesNotFoundError') {
            setDeviceError("Nenhum microfone foi encontrado. Por favor, conecte um dispositivo de áudio.");
          } else if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            setDeviceError("Permissão de microfone negada. O acesso está bloqueado nas configurações do seu navegador.");
          } else {
            setDeviceError(`Erro ao acessar microfone: ${permErr.message}`);
          }
          return;
        }
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter(device => device.kind === 'audioinput');
      const validDevices = audioInputs.filter(d => d.deviceId !== '');
      setDevices(validDevices);
      
      if (validDevices.length > 0) {
        setSelectedDeviceId(prev => {
          if (prev && validDevices.some(d => d.deviceId === prev)) return prev;
          return validDevices[0].deviceId;
        });
        if (hasLabels) setDeviceError(null);
      } else if (forcePrompt) {
        setDeviceError("Nenhum microfone detectado. Verifique a conexão do seu hardware.");
      }
    } catch (err: any) {
      console.error("Error accessing media devices:", err);
      if (forcePrompt) setDeviceError("Erro inesperado ao configurar dispositivos de áudio.");
    }
  };

  useEffect(() => {
    getDevices(false); // Don't force prompt on mount to avoid silent blocks
    navigator.mediaDevices.addEventListener('devicechange', () => getDevices(false));
    return () => navigator.mediaDevices.removeEventListener('devicechange', () => getDevices(false));
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserRole(userSnap.data().role);
        } else {
          // If doc doesn't exist, it's a new user (handled in signInWithGoogle usually, 
          // but for safety if they just logged in and doc creation failed)
          setUserRole('user');
        }
        if (view === 'landing' || view === 'auth') {
          setView('dashboard');
        }
      } else {
        setUserRole(null);
        if (!['landing', 'auth'].includes(view)) {
          setView('landing');
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, [view]);

  // Firestore Listeners
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const bootstrapData = async () => {
      try {
        const q = query(collection(db, 'scripts'), where('ownerUid', '==', user.uid), limit(1));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          console.log("Bootstrapping initial data for user:", user.uid);
          
          // Add Scripts
          for (const s of INITIAL_SCRIPTS) {
            const { id, ...data } = s;
            await addDoc(collection(db, 'scripts'), { 
              ...data, 
              ownerUid: user.uid, 
              createdAt: serverTimestamp() 
            });
          }
          
          // Add Templates
          for (const t of MOCK_DOC_TEMPLATES) {
            const { id, ...data } = t;
            await addDoc(collection(db, 'templates'), { 
              ...data, 
              ownerUid: user.uid, 
              createdAt: serverTimestamp() 
            });
          }
          
          // Add Patients
          for (const p of MOCK_PATIENT_MODELS) {
            const { id, ...data } = p;
            await addDoc(collection(db, 'patients'), { 
              ...data, 
              ownerUid: user.uid, 
              createdAt: serverTimestamp() 
            });
          }
        }
      } catch (err) {
        console.error("Error bootstrapping data:", err);
      }
    };

    bootstrapData();

    const qScripts = query(collection(db, 'scripts'), where('ownerUid', '==', user.uid));
    const unsubScripts = onSnapshot(qScripts, (snap) => {
      setScripts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Script)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'scripts'));

    const qTemplates = query(collection(db, 'templates'), where('ownerUid', '==', user.uid));
    const unsubTemplates = onSnapshot(qTemplates, (snap) => {
      setDocTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as DocTemplate)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'templates'));

    const qPatients = query(collection(db, 'patients'), where('ownerUid', '==', user.uid));
    const unsubPatients = onSnapshot(qPatients, (snap) => {
      setPatientModels(snap.docs.map(d => ({ id: d.id, ...d.data() } as PatientModel)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'patients'));

    const qHistory = query(collection(db, 'history'), where('ownerUid', '==', user.uid), orderBy('createdAt', 'desc'), limit(50));
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as HistoryItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'history'));

    return () => {
      unsubScripts();
      unsubTemplates();
      unsubPatients();
      unsubHistory();
    };
  }, [user, isAuthReady]);

  // Admin Global Listeners
  useEffect(() => {
    if (!user || userRole !== 'admin') {
      setAllUsers([]);
      setAllHistory([]);
      return;
    }

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubAllHistory = onSnapshot(collection(db, 'history'), (snap) => {
      setAllHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'history'));

    return () => {
      unsubUsers();
      unsubAllHistory();
    };
  }, [user, userRole]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-bold animate-pulse">Carregando ECHO scribe...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (view) {
      case 'landing': return <LandingPage setView={setView} />;
      case 'auth': return <AuthPage setView={setView} />;
      case 'dashboard': return <DashboardView allUsers={allUsers} allHistory={allHistory} />;
      case 'history': return (
        <HistoryView 
          history={history} 
          setHistory={setHistory} 
          setView={setView}
          setPatientName={setPatientName}
          setCaseSummary={setCaseSummary}
          setTranscriptions={setTranscriptions}
          setScriptInstructions={setScriptInstructions}
          setSummary={setSummary}
          setCurrentHistoryId={setCurrentHistoryId}
        />
      );
      case 'scripts': return (
        <ScriptsView 
          scripts={scripts} 
          setScripts={setScripts} 
          setView={setView}
          setScriptInstructions={setScriptInstructions}
          setChecklistItems={setChecklistItems}
        />
      );
      case 'doc-config': return <DocConfigView templates={docTemplates} setTemplates={setDocTemplates} />;
      case 'patient-models': return <PatientModelsView patients={patientModels} setPatients={setPatientModels} history={history} />;
      case 'session-prep': return (
        <SessionPrepView 
          setView={setView} 
          patientName={patientName}
          setPatientName={setPatientName}
          caseSummary={caseSummary}
          setCaseSummary={setCaseSummary}
          scripts={scripts}
          setScriptInstructions={setScriptInstructions}
          setChecklistItems={setChecklistItems}
          scriptInstructions={scriptInstructions}
          patients={patientModels}
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={setSelectedDeviceId}
          deviceError={deviceError}
          onRefreshDevices={() => getDevices(false)}
          onRequestPermission={() => getDevices(true)}
        />
      );
      case 'live-session': return (
        <LiveSessionView 
          setView={setView} 
          transcriptions={transcriptions} 
          setTranscriptions={setTranscriptions} 
          patientName={patientName}
          checklistItems={checklistItems}
          setChecklistItems={setChecklistItems}
          scriptInstructions={scriptInstructions}
          setScriptInstructions={setScriptInstructions}
          setConfirmed={setConfirmed}
          scripts={scripts}
          setHistory={setHistory}
          caseSummary={caseSummary}
          summary={summary}
          setCurrentHistoryId={setCurrentHistoryId}
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={setSelectedDeviceId}
          deviceError={deviceError}
        />
      );
      case 'transcription-validation': return (
        <TranscriptionValidationView 
          setView={setView} 
          transcriptions={transcriptions} 
          patientName={patientName} 
          caseSummary={caseSummary}
          scriptInstructions={scriptInstructions}
          confirmed={confirmed}
          setConfirmed={setConfirmed}
          summary={summary}
          setSummary={setSummary}
          currentHistoryId={currentHistoryId}
        />
      );
      case 'doc-viewer': return (
        <DocViewerView 
          setView={setView} 
          patientName={patientName} 
          templates={docTemplates}
          setTemplates={setDocTemplates}
          patients={patientModels}
          transcriptions={transcriptions}
          caseSummary={caseSummary}
          scriptInstructions={scriptInstructions}
        />
      );
      default: return <DashboardView allUsers={allUsers} allHistory={allHistory} />;
    }
  };

  const isPublic = ['landing', 'auth'].includes(view);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {isPublic ? (
        renderContent()
      ) : (
        <div className="flex">
          <Sidebar currentView={view} setView={setView} user={user} role={userRole} />
          <div className="flex-1 flex flex-col min-h-screen">
            <Header title={
              view === 'dashboard' ? 'Dashboard Overview' :
              view === 'history' ? 'Histórico de Entrevistas' :
              view === 'scripts' ? 'Interview Scripts' :
              view === 'doc-config' ? 'Geração de Documentos' :
              view === 'patient-models' ? 'Meus Pacientes' :
              view === 'session-prep' ? 'Nova Sessão' :
              view === 'live-session' ? 'Sessão em Andamento' :
              view === 'transcription-validation' ? 'Validação de Transcrição' :
              view === 'doc-viewer' ? 'Visualizador de Documento' : ''
            } />
            <main className="flex-1 overflow-y-auto">
              {renderContent()}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}
