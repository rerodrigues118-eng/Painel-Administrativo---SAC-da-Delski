'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, UserCircle, X, MessageSquare, PlusCircle, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Notificacao = {
  id: string;
  tipo: 'chamado' | 'resposta';
  mensagem: string;
  lida: boolean;
  timestamp: Date;
};

export function Topbar() {
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Inscrever no Supabase Realtime para capturar novos chamados e respostas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase.channel('realtime_topbar_notifs') as any)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chamados' }, (payload: any) => {
        const novo = payload.new as any;
        const msg = `Novo chamado criado: ${novo.assunto || 'Sem Assunto'} (Prot: ${novo.protocolo})`;
        setNotificacoes(prev => [
          {
            id: novo.id || Math.random().toString(),
            tipo: 'chamado',
            mensagem: msg,
            lida: false,
            timestamp: new Date()
          },
          ...prev
        ]);
        
        // Alerta sonoro sutil opcional (bloqueado por políticas se não houver interação prévia)
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.value = 587.33; // D5 note
          gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.15);
        } catch (_) {}
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'respostas' }, (payload: any) => {
        const nova = payload.new as any;
        // Só notificar se a resposta for do cliente (autor_id nulo indica cliente no schema)
        if (nova.autor_id === null) {
          const msg = `Nova resposta recebida do cliente.`;
          setNotificacoes(prev => [
            {
              id: nova.id || Math.random().toString(),
              tipo: 'resposta',
              mensagem: msg,
              lida: false,
              timestamp: new Date()
            },
            ...prev
          ]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marcarLida = (id: string) => {
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const limparTodas = () => {
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };

  return (
    <header className="h-16 glass border-b flex items-center justify-end px-8 sticky top-0 z-50">
      
      <div className="flex items-center gap-6">
        {/* Sino de Notificações */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="relative text-muted-foreground hover:text-primary transition-colors focus:outline-none p-1.5 rounded-full hover:bg-white/5"
          >
            <Bell size={24} />
            {nLidas > 0 && (
              <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary text-primary-foreground font-bold text-[10px] flex items-center justify-center rounded-full neon-border shadow-lg animate-pulse">
                {nLidas}
              </span>
            )}
          </button>

          {/* Dropdown de Alertas Realtime */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-3 w-80 glass border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-3 duration-250">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-card/85">
                <span className="font-semibold text-sm text-foreground">Notificações Recentes</span>
                {nLidas > 0 && (
                  <button 
                    onClick={limparTodas}
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <Check size={12} /> Marcar todas como lidas
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                {notificacoes.length > 0 ? (
                  notificacoes.map((n) => (
                    <div 
                      key={n.id} 
                      onClick={() => marcarLida(n.id)}
                      className={`p-4 flex gap-3 cursor-pointer transition-colors ${n.lida ? 'bg-transparent hover:bg-white/[0.02]' : 'bg-primary/5 hover:bg-primary/10'}`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.tipo === 'chamado' ? (
                          <PlusCircle className="text-blue-400" size={16} />
                        ) : (
                          <MessageSquare className="text-purple-400" size={16} />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className={`text-xs text-foreground/90 leading-snug ${!n.lida && 'font-medium'}`}>{n.mensagem}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {n.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!n.lida && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2"></div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                    <Bell className="opacity-30" size={24} />
                    Nenhum alerta recente.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 pl-6 border-l border-white/10">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-foreground">Equipe Delski</p>
            <p className="text-xs text-primary">Administrador</p>
          </div>
          <UserCircle size={40} className="text-primary/80" />
        </div>
      </div>
    </header>
  );
}
