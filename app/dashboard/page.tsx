"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type QuickLink = {
  title: string;
  description: string;
  href: string;
};

const quickLinks: QuickLink[] = [
  {
    title: "Notas",
    description: "Accede a las notas internas y documentación funcional.",
    href: "/notes",
  },
  {
    title: "Proyectos",
    description: "Revisa y organiza los proyectos registrados.",
    href: "/projects",
  },
];

type ChatMessage = {
  id: number;
  from: "user" | "bot";
  text: string;
};

export default function DashboardPage() {
  const router = useRouter();

  // 1) Estados SIEMPRE en el mismo orden
  const [checkingSession, setCheckingSession] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      from: "bot",
      text: "Hola, soy tu asistente de IA. Puedes preguntarme sobre configuraciones, ideas de documentación o cualquier duda relacionada con tus proyectos.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // 2) Efecto de auth guard (solo hay un useEffect)
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace("/");
        return;
      }

      setCheckingSession(false);
    };

    checkSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const newUserMessage: ChatMessage = {
      id: Date.now(),
      from: "user",
      text,
    };

    setChatMessages((prev) => [...prev, newUserMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/n8n", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error("Error al conectar con el asistente.");
      }

      const data = await response.json();

      const botText: string =
        typeof data.reply === "string"
          ? data.reply
          : "He recibido tu consulta, pero no pude generar una respuesta clara desde el flujo de IA.";

      const newBotMessage: ChatMessage = {
        id: Date.now() + 1,
        from: "bot",
        text: botText,
      };

      setChatMessages((prev) => [...prev, newBotMessage]);
    } catch (error) {
      const newBotMessage: ChatMessage = {
        id: Date.now() + 2,
        from: "bot",
        text:
          "No he podido contactar con el asistente en este momento. Revisa el flujo en n8n o inténtalo de nuevo más tarde.",
      };
      setChatMessages((prev) => [...prev, newBotMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  // Mientras se comprueba la sesión no mostramos nada
  if (checkingSession) return null;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              PH
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Project Hub
              </p>
              <p className="text-[11px] text-slate-500">
                Panel interno de trabajo
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-xs border border-slate-300 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Contenido */}
      <section className="max-w-6xl mx-auto px-6 py-7 space-y-6">
        {/* Intro */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Bienvenido al panel
            </h1>
            <p className="text-sm text-slate-600 max-w-xl">
              Centraliza aquí la información clave de tus proyectos: notas,
              decisiones, configuraciones y cualquier detalle que necesites
              tener controlado.
            </p>
          </div>
        </div>

        {/* Cards resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Estado general</p>
            <p className="text-base font-semibold text-slate-900">
              Entorno activo
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Uso interno para documentación de proyectos.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Acceso</p>
            <p className="text-base font-semibold text-slate-900">
              Protegido por autenticación
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Solo usuarios con credenciales válidas pueden entrar.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">Próximos pasos</p>
            <p className="text-base font-semibold text-slate-900">
              Definir estructura de notas
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Puedes empezar registrando proyectos y sus notas asociadas.
            </p>
          </div>
        </div>

        {/* Zona inferior: Accesos rápidos + Chat IA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Accesos rápidos */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Accesos rápidos
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {quickLinks.map((item) => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="text-left border border-slate-200 rounded-xl p-4 hover:border-blue-500 hover:shadow-md bg-slate-50/60 transition"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Asistente de IA */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col h-[360px]">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              Asistente de IA
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Conectado a tu flujo en n8n. Úsalo para comentar dudas sobre
              procesos, documentación o ideas de configuración.
            </p>

            <div className="flex-1 border border-slate-200 rounded-lg p-3 mb-3 overflow-y-auto bg-slate-50/60 text-xs space-y-2">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.from === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      msg.from === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white border border-slate-200 text-slate-800"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleChatSubmit}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Escribe tu pregunta..."
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {chatLoading ? "Enviando..." : "Enviar"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}