import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Heart,
  Star,
  ArrowLeft,
  Palette,
  Trash2,
  Instagram,
  Linkedin,
} from 'lucide-react';
import { getCampaign, getPostsByCampaign, toggleFavorite, deletePost } from '../api/client';
import type { Campaign, ContentPost } from '../types';

const PLATFORM_LABELS: Record<string, { label: string; icon: typeof Instagram }> = {
  instagram_feed_1x1: { label: 'IG 1:1', icon: Instagram },
  instagram_feed_4x5: { label: 'IG 4:5', icon: Instagram },
  instagram_carousel: { label: 'IG Carousel', icon: Instagram },
  linkedin_post: { label: 'LinkedIn', icon: Linkedin },
};

const ANGLE_COLORS: Record<string, string> = {
  educational: 'bg-blue-100 text-blue-700',
  storytelling: 'bg-purple-100 text-purple-700',
  direct_sale: 'bg-red-100 text-red-700',
  authority: 'bg-amber-100 text-amber-700',
  social_proof: 'bg-green-100 text-green-700',
  pain_agitate_solve: 'bg-orange-100 text-orange-700',
};

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, p] = await Promise.all([getCampaign(id), getPostsByCampaign(id)]);
      setCampaign(c);
      setPosts(p);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleToggleFav = async (postId: string) => {
    await toggleFavorite(postId);
    load();
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('¿Eliminar este post?')) return;
    await deletePost(postId);
    load();
  };

  const filteredPosts = filter === 'favorites' ? posts.filter((p) => p.isFavorite) : posts;

  if (loading) return <div className="text-center py-20 text-gray-400">Cargando...</div>;
  if (!campaign) return <div className="text-center py-20 text-gray-400">Campaña no encontrada</div>;

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:gap-3">
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <p className="text-sm text-gray-500">
            {campaign.industry} · {campaign.targetAudience}
          </p>
        </div>
        <Link
          to={`/campaigns/${id}/generate`}
          className="flex items-center justify-center gap-2 w-full sm:w-auto bg-brand-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition"
        >
          <Sparkles className="w-5 h-5" />
          Generar Contenido
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
            filter === 'all' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todos ({posts.length})
        </button>
        <button
          onClick={() => setFilter('favorites')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-1 ${
            filter === 'favorites' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Star className="w-4 h-4" />
          Favoritos ({posts.filter((p) => p.isFavorite).length})
        </button>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">
            {filter === 'favorites' ? 'No hay favoritos aún' : 'No hay posts aún'}
          </p>
          {filter === 'all' && (
            <Link
              to={`/campaigns/${id}/generate`}
              className="text-brand-600 font-medium hover:text-brand-700"
            >
              Generar tu primer contenido
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPosts.map((post) => {
            const platInfo = PLATFORM_LABELS[post.platform] || { label: post.platform, icon: Instagram };
            const PlatIcon = platInfo.icon;
            return (
              <div
                key={post.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <PlatIcon className="w-4 h-4 text-gray-500" />
                      <span className="text-xs font-medium text-gray-500">{platInfo.label}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full max-w-full ${ANGLE_COLORS[post.marketingAngle] || 'bg-gray-100 text-gray-600'}`}>
                        {post.marketingAngle.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleFav(post.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                      >
                        <Star className={`w-4 h-4 ${post.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="font-bold text-gray-900 text-lg leading-tight mb-2 line-clamp-2">
                    {post.hook}
                  </p>
                  {post.headline && (
                    <p className="text-sm font-semibold text-brand-700 mb-1">{post.headline}</p>
                  )}
                  <p className="text-sm text-gray-600 line-clamp-3 mb-3">{post.body}</p>
                  <div className="bg-brand-50 rounded-lg px-3 py-2 mb-3">
                    <span className="text-xs text-brand-600 font-semibold uppercase tracking-wider">CTA</span>
                    <p className="text-sm font-medium text-brand-800">{post.cta}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">v{post.currentVersion}</span>
                    <Link
                      to={`/posts/${post.id}`}
                      className="text-sm text-brand-600 font-medium hover:text-brand-700"
                    >
                      Ver detalle →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
