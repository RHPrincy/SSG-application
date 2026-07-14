'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Save, Loader2, ShieldCheck, Server } from 'lucide-react';
import { AuthGuard } from '@/components/AuthGuard';
import { TopBar } from '@/components/TopBar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { api } from '@/lib/client';
import type { Site } from '@/lib/types';

/** One editable row for an existing site (patch / delete). */
function SiteRow({ site, onChanged }: { site: Site; onChanged: () => void }) {
  const [form, setForm] = useState({
    name: site.name,
    lovableUrl: site.lovableUrl,
    vercelUrl: site.vercelUrl,
    vercelProject: site.vercelProject ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty =
    form.name !== site.name ||
    form.lovableUrl !== site.lovableUrl ||
    form.vercelUrl !== site.vercelUrl ||
    form.vercelProject !== (site.vercelProject ?? '');

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api(`/api/sites/${site.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      setMsg('Enregistré.');
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Supprimer le site « ${site.name} » ?`)) return;
    setDeleting(true);
    try {
      await api(`/api/sites/${site.id}`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      setMsg((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-xs text-faint">{site.id}</span>
          <Button variant="danger" size="sm" onClick={remove} loading={deleting}>
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field
            label="Projet Vercel (optionnel)"
            value={form.vercelProject}
            placeholder="ex. mak-agency"
            onChange={(v) => setForm({ ...form, vercelProject: v })}
          />
          <Field
            label="URL Lovable (source)"
            value={form.lovableUrl}
            placeholder="https://…lovable.app"
            onChange={(v) => setForm({ ...form, lovableUrl: v })}
          />
          <Field
            label="URL Vercel (cible)"
            value={form.vercelUrl}
            placeholder="https://…"
            onChange={(v) => setForm({ ...form, vercelUrl: v })}
          />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
            <Save className="h-4 w-4" />
            Enregistrer
          </Button>
          {msg && <span className="text-xs text-muted">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
    </div>
  );
}

function AddSite({ onAdded }: { onAdded: () => void }) {
  const empty = { name: '', lovableUrl: '', vercelUrl: '', vercelProject: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setSaving(true);
    setError(null);
    try {
      await api('/api/sites', { method: 'POST', body: JSON.stringify(form) });
      setForm(empty);
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
          <Plus className="h-4 w-4 text-accent" />
          Ajouter un site
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field
            label="Projet Vercel (optionnel)"
            value={form.vercelProject}
            placeholder="ex. mak-agency"
            onChange={(v) => setForm({ ...form, vercelProject: v })}
          />
          <Field
            label="URL Lovable (source)"
            value={form.lovableUrl}
            placeholder="https://…lovable.app"
            onChange={(v) => setForm({ ...form, lovableUrl: v })}
          />
          <Field
            label="URL Vercel (cible)"
            value={form.vercelUrl}
            placeholder="https://…"
            onChange={(v) => setForm({ ...form, vercelUrl: v })}
          />
        </div>
        {error && <p className="mt-3 text-xs text-danger">{error}</p>}
        <Button
          size="sm"
          className="mt-4"
          onClick={add}
          loading={saving}
          disabled={!form.name || !form.lovableUrl}
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </CardContent>
    </Card>
  );
}

function SettingsInner() {
  const [sites, setSites] = useState<Site[] | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ sites: Site[] }>('/api/sites');
    setSites(data.sites);
  }, []);

  useEffect(() => {
    load().catch(() => setSites([]));
  }, [load]);

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Paramètres</h1>
          <p className="mt-1 text-sm text-muted">Gestion des sites et configuration serveur.</p>
        </div>

        {/* Server config — informational, secrets never displayed */}
        <Card className="mb-8 border-accent/20 bg-accent-soft/40">
          <CardContent className="p-5">
            <h2 className="mb-2 flex items-center gap-2 font-display text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Secrets côté serveur
            </h2>
            <p className="text-sm text-muted">
              Le code d&apos;accès, la clé de signature des sessions et le token Vercel sont lus
              depuis le fichier <span className="font-mono text-ink">.env</span> du serveur et ne
              sont <strong className="text-ink">jamais exposés au navigateur</strong>. Modifiez-les
              directement sur le VPS.
            </p>
            <ul className="mt-3 space-y-1 font-mono text-xs text-faint">
              <li className="flex items-center gap-2"><Server className="h-3 w-3" /> ACCESS_CODE</li>
              <li className="flex items-center gap-2"><Server className="h-3 w-3" /> AUTH_SECRET</li>
              <li className="flex items-center gap-2"><Server className="h-3 w-3" /> VERCEL_TOKEN</li>
            </ul>
          </CardContent>
        </Card>

        <h2 className="mb-4 font-display text-xl font-semibold">Sites</h2>
        {sites === null ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span className="font-mono text-sm">chargement…</span>
          </div>
        ) : (
          <div className="space-y-4">
            {sites.map((s) => (
              <SiteRow key={s.id} site={s} onChanged={load} />
            ))}
            <AddSite onAdded={load} />
          </div>
        )}
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsInner />
    </AuthGuard>
  );
}
