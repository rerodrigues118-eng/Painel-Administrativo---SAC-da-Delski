'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Ticket, Users, BarChart3, Settings, Bell, UserCircle, PlusCircle, MessageSquare, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Notificacao = {
  id: string;
  tipo: 'chamado' | 'resposta';
  mensagem: string;
  lida: boolean;
  timestamp: Date;
};

export function Sidebar() {
  const pathname = usePathname();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const nLidas = notificacoes.filter(n => !n.lida).length;

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Supabase Realtime para notificações
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase.channel('sidebar_notifs') as any)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chamados' }, (payload: any) => {
        const novo = payload.new as any;
        setNotificacoes(prev => [{
          id: novo.id || Math.random().toString(),
          tipo: 'chamado',
          mensagem: `Novo chamado: ${novo.assunto || 'Sem Assunto'} (${novo.protocolo})`,
          lida: false,
          timestamp: new Date()
        }, ...prev]);
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.frequency.value = 587.33;
          gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
          osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        } catch (_) {}
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'respostas' }, (payload: any) => {
        const nova = payload.new as any;
        if (nova.autor_id === null) {
          setNotificacoes(prev => [{
            id: nova.id || Math.random().toString(),
            tipo: 'resposta',
            mensagem: 'Nova resposta recebida do cliente.',
            lida: false,
            timestamp: new Date()
          }, ...prev]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marcarLida = (id: string) => setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  const limparTodas = () => setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));

  const getLinkClasses = (path: string) => {
    const isActive = pathname === path || (path !== '/' && pathname?.startsWith(path));
    if (isActive) {
      return 'flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 text-primary border border-primary/20 neon-border transition-all duration-300';
    }
    return 'flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-300';
  };

  return (
    <aside className="w-64 h-screen glass border-r flex flex-col">
      {/* Logo */}
      <div className="p-6">
        <h1 className="text-2xl font-bold neon-text text-primary tracking-wider">DELSKI<span className="text-foreground">SAC</span></h1>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        <Link href="/" className={getLinkClasses('/')}>
          <LayoutDashboard size={20} />
          <span className="font-medium">Dashboard</span>
        </Link>
        <Link href="/chamados" className={getLinkClasses('/chamados')}>
          <Ticket size={20} />
          <span className="font-medium">Chamados</span>
        </Link>
        <Link href="/clientes" className={getLinkClasses('/clientes')}>
          <Users size={20} />
          <span className="font-medium">Clientes</span>
        </Link>
        <Link href="/relatorios" className={getLinkClasses('/relatorios')}>
          <BarChart3 size={20} />
          <span className="font-medium">Relatórios</span>
        </Link>
      </nav>

      {/* Rodapé: Configurações + Notificações + Usuário */}
      <div className="px-4 pb-2 border-t border-white/10 pt-3">
        <Link href="/config" className={getLinkClasses('/config')}>
          <Settings size={20} />
          <span className="font-medium">Configurações</span>
        </Link>
      </div>

      {/* Sino de Notificações */}
      <div className="px-4 pb-3 relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all duration-300 relative"
        >
          <div className="relative">
            <Bell size={20} />
            {nLidas > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground font-bold text-[9px] flex items-center justify-center rounded-full animate-pulse">
                {nLidas}
              </span>
            )}
          </div>
          <span className="font-medium">Notificações</span>
          {nLidas > 0 && (
            <span className="ml-auto text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{nLidas}</span>
          )}
        </button>

        {/* Dropdown abre para cima e para a direita */}
        {dropdownOpen && (
          <div className="absolute bottom-full left-full ml-2 mb-0 w-80 glass border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-card/85">
              <span className="font-semibold text-sm text-foreground">Notificações</span>
              {nLidas > 0 && (
                <button onClick={limparTodas} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                  <Check size={12} /> Marcar todas lidas
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
              {notificacoes.length > 0 ? notificacoes.map(n => (
                <div
                  key={n.id}
                  onClick={() => marcarLida(n.id)}
                  className={`p-3 flex gap-3 cursor-pointer transition-colors ${n.lida ? 'bg-transparent hover:bg-white/[0.02]' : 'bg-primary/5 hover:bg-primary/10'}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.tipo === 'chamado'
                      ? <PlusCircle className="text-blue-400" size={14} />
                      : <MessageSquare className="text-purple-400" size={14} />}
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <p className={`text-xs text-foreground/90 leading-snug ${!n.lida && 'font-medium'}`}>{n.mensagem}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {n.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.lida && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
                </div>
              )) : (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <Bell className="opacity-30" size={20} />
                  Nenhum alerta recente.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Usuário */}
      <div className="px-4 pb-5">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/5">
          <UserCircle size={32} className="text-primary/80 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">Maria Rodrigues</p>
            <p className="text-xs text-primary">Administrador</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
