import React, { useState, useEffect } from 'react';
import { useTranslation } from '../contexts/I18nContext';

const CATEGORIES = [
  'custom_wear',
  'abaya',
  'uniform',
  'alteration',
  'special',
] as const;

export default function PieceTypesPage() {
  const { t, currency } = useTranslation();
  const [pieceTypes, setPieceTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name_en: '',
    name_ar: '',
    category: 'custom_wear' as string,
    base_price: '',
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadPieceTypes();
  }, []);

  const loadPieceTypes = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.pieceTypes.getAll();
      setPieceTypes(data);
    } catch (err) {
      console.error('Failed to load piece types:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_en.trim() || !formData.name_ar.trim() || !formData.base_price) {
      alert(t('Please fill in all required fields.'));
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name_en: formData.name_en.trim(),
        name_ar: formData.name_ar.trim(),
        category: formData.category,
        base_price: parseFloat(formData.base_price),
      };

      if (editingId) {
        await window.electronAPI.pieceTypes.update(editingId, payload);
      } else {
        await window.electronAPI.pieceTypes.create(payload);
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ name_en: '', name_ar: '', category: 'custom_wear', base_price: '' });
      await loadPieceTypes();
    } catch (err: any) {
      console.error('Failed to save piece type:', err);
      alert(err.message || t('Failed to save piece type.'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (piece: any) => {
    setEditingId(piece.id);
    setFormData({
      name_en: piece.name_en,
      name_ar: piece.name_ar,
      category: piece.category,
      base_price: piece.base_price.toString(),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('Delete this piece type?'))) return;
    try {
      await window.electronAPI.pieceTypes.delete(id);
      await loadPieceTypes();
    } catch (err) {
      console.error('Failed to delete piece type:', err);
      alert(t('Failed to delete piece type.'));
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name_en: '', name_ar: '', category: 'custom_wear', base_price: '' });
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      custom_wear: t('Custom Wear'),
      abaya: t('Abaya'),
      uniform: t('Uniforms'),
      alteration: t('Alterations'),
      special: t('Special Orders'),
    };
    return labels[category] || category;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">
            {t('Piece Types')}
          </h1>
          <p className="text-secondary mt-1">{t('Manage piece types and base prices')}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined">add</span>
            {t('Add Piece Type')}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-surface-container-lowest rounded-xl p-6">
          <h2 className="text-lg font-headline font-bold mb-4">
            {editingId ? t('Edit Piece Type') : t('Add New Piece Type')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-widest text-secondary">
                  {t('Name (English)')} *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  placeholder={t('e.g., Abaya')}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-widest text-secondary">
                  {t('Name (Arabic)')} *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  placeholder={t('e.g., عباءة')}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-widest text-secondary">
                  {t('Category')} *
                </label>
                <select
                  className="input-field"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  disabled={loading}
                  required
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-widest text-secondary">
                  {t('Base Price')} ({t(currency)}) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  placeholder="0.00"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-3 bg-surface-container-high text-secondary rounded-xl font-bold hover:bg-surface-container-highest transition-all"
                disabled={loading}
              >
                {t('Cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 py-3 text-white rounded-xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:pointer-events-none"
                style={{ background: 'linear-gradient(135deg, #763952 0%, #92506a 100%)' }}
                disabled={loading}
              >
                {loading && <span className="material-symbols-outlined animate-spin">progress_activity</span>}
                {editingId ? t('Update') : t('Create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading && !showForm ? (
        <div className="flex items-center justify-center py-8 text-secondary">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          {t('Loading...')}
        </div>
      ) : pieceTypes.length === 0 ? (
        <p className="text-secondary text-sm py-4">{t('No piece types found.')}</p>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container-high">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-secondary text-left">
                    {t('Name')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-secondary text-left">
                    {t('Category')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-secondary text-right">
                    {t('Base Price')}
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-secondary text-center">
                    {t('Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pieceTypes.map((piece) => (
                  <tr key={piece.id} className="border-t border-outline-variant/20">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-on-surface">{piece.name_en}</div>
                      <div className="text-sm text-secondary">{piece.name_ar}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="chip chip-progress">{getCategoryLabel(piece.category)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-primary">
                      {Number(piece.base_price).toFixed(2)} {t(currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(piece)}
                          className="text-primary hover:bg-primary/10 p-1.5 rounded transition-colors"
                          title={t('Edit')}
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(piece.id)}
                          className="text-error hover:bg-error/10 p-1.5 rounded transition-colors"
                          title={t('Delete')}
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
