import { useEffect, useState } from 'react';
import { gamificationAPI, Badge, UserGamification } from '../../api/gamification';
import './Widget.css';

const BadgeGallery = () => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [gamification, setGamification] = useState<UserGamification | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [badgesRes, gamRes] = await Promise.all([
        gamificationAPI.getBadges(),
        gamificationAPI.getGamification(),
      ]);
      setBadges(badgesRes.badges);
      setGamification(gamRes.gamification);
    } catch (err) {
      console.error('Failed to load badges', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Loading badges...</div>;
  }

  const earnedBadges = badges.filter(b => gamification?.badges.includes(b.id));
  const availableBadges = badges.filter(b => !gamification?.badges.includes(b.id));

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '10px' }}>Your Points: {gamification?.points || 0}</h3>
        <p style={{ color: '#6b7280', margin: 0 }}>Level {gamification?.level || 1}</p>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h4 style={{ marginBottom: '15px', fontSize: '18px' }}>Earned Badges ({earnedBadges.length})</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>
          {earnedBadges.map(badge => (
            <div
              key={badge.id}
              style={{
                padding: '15px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                textAlign: 'center',
                color: 'white',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>{badge.icon}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{badge.name}</div>
              <div style={{ fontSize: '10px', opacity: 0.9 }}>{badge.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 style={{ marginBottom: '15px', fontSize: '18px' }}>Available Badges ({availableBadges.length})</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '15px' }}>
          {availableBadges.map(badge => (
            <div
              key={badge.id}
              style={{
                padding: '15px',
                background: '#f3f4f6',
                borderRadius: '12px',
                textAlign: 'center',
                color: '#6b7280',
                opacity: 0.6,
                border: '2px dashed #d1d5db',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '8px', filter: 'grayscale(100%)' }}>{badge.icon}</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{badge.name}</div>
              <div style={{ fontSize: '10px' }}>{badge.description}</div>
              <div style={{ fontSize: '10px', marginTop: '8px', color: '#9ca3af' }}>
                {badge.pointsRequired} points needed
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BadgeGallery;



