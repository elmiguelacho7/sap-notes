"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Note = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  project_id: string | null;
  project_name: string | null;
  project_client_name: string | null;
};

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // =========================
  // CHECK SESSION
  // =========================
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }

      fetchNotes();
    };

    checkSession();
  }, []);

  // =========================
  // FETCH NOTES
  // =========================
  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from("notes")
      .select(
        `
        id,
        title,
        body,
        created_at,
        project_id,
        projects (
          name,
          clients (
            name
          )
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading notes:", error.message);
      setLoading(false);
      return;
    }

    const formatted: Note[] =
      data?.map((item: any) => {
        const project = item.projects?.[0];
        const client = project?.clients?.[0];

        return {
          id: item.id,
          title: item.title,
          body: item.body,
          created_at: item.created_at,
          project_id: item.project_id,
          project_name: project?.name ?? null,
          project_client_name: client?.name ?? null,
        };
      }) || [];

    setNotes(formatted);
    setLoading(false);
  };

  // =========================
  // CREATE NOTE
  // =========================
  const createNote = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title) return;

    const { error } = await supabase.from("notes").insert([
      {
        title,
        body,
      },
    ]);

    if (error) {
      console.error("Error creating note:", error.message);
      return;
    }

    setTitle("");
    setBody("");
    fetchNotes();
  };

  // =========================
  // LOGOUT
  // =========================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">SAP Notes Hub</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {/* CREATE NOTE */}
        <form
          onSubmit={createNote}
          className="bg-gray-900 p-6 rounded-lg mb-8 space-y-4"
        >
          <input
            type="text"
            placeholder="Note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 rounded bg-gray-800 border border-gray-700"
          />

          <textarea
            placeholder="Note description"
            value={body || ""}
            onChange={(e) => setBody(e.target.value)}
            className="w-full p-3 rounded bg-gray-800 border border-gray-700"
          />

          <button
            type="submit"
            className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
          >
            Create Note
          </button>
        </form>

        {/* NOTES LIST */}
        {loading ? (
          <p>Loading...</p>
        ) : notes.length === 0 ? (
          <p>No notes yet.</p>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-gray-900 p-5 rounded-lg border border-gray-800"
              >
                <h2 className="text-xl font-semibold">{note.title}</h2>

                {note.body && (
                  <p className="text-gray-400 mt-2">{note.body}</p>
                )}

                <div className="text-sm text-gray-500 mt-3">
                  {note.project_name && (
                    <p>Project: {note.project_name}</p>
                  )}

                  {note.project_client_name && (
                    <p>Client: {note.project_client_name}</p>
                  )}

                  <p>
                    Created:{" "}
                    {new Date(note.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}