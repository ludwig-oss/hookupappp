import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { discoverAPI, User, Interest, Place, UserPreference } from '../../api/discover';
import './Widget.css';

const DiscoverWidgetFull = () => {
  const { user } = useContext(AuthContext);
  const [view, setView] = useState<'cities' | 'city' | 'places' | 'interests' | 'preferences'>('cities');
  const [allCities, setAllCities] = useState<{ city: string; userCount: number; hasActiveUsers: boolean }[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [cityUsers, setCityUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [interests, setInterests] = useState<{ sent: Interest[]; received: Interest[] }>({ sent: [], received: [] });
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [placeUsers, setPlaceUsers] = useState<User[]>([]);
  const [preference, setPreference] = useState<UserPreference | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    loadAllCities();
    loadInterests();
    loadPreference();
    getLocation();
  }, []);

  useEffect(() => {
    if (coords && view === 'places') {
      loadPlaces();
    }
  }, [coords, view]);

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => setError('Location access denied')
      );
    }
  };

  const loadAllCities = async () => {
    setLoading(true);
    try {
      const response = await discoverAPI.getAllCities();
      setAllCities(response.cities);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load cities');
    } finally {
      setLoading(false);
    }
  };

  const loadPreference = async () => {
    try {
      const response = await discoverAPI.getMyPreference();
      setPreference(response.preference);
    } catch (err) {
      console.error('Failed to load preference', err);
    }
  };

  const loadInterests = async () => {
    try {
      const response = await discoverAPI.getMyInterests();
      setInterests(response);
    } catch (err) {
      console.error('Failed to load interests', err);
    }
  };

  const handleCitySearch = async () => {
    if (!citySearch.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await discoverAPI.searchByCity(citySearch);
      setCityUsers(response.users || []);
      if (response.message) {
        // Show info message instead of error if no users found
        setError('');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to search city');
      setCityUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleShowInterest = async (toUserId: string, city?: string, placeId?: string, placeType?: string) => {
    try {
      // Check if casual encounter and show warning
      if (preference?.lookingFor?.includes('casual')) {
        const confirmed = window.confirm(
          '⚠️ Safety Warning: For casual encounters, always ensure your partner is comfortable. ' +
          'The app will request a 5-second 360° video verification before meeting. Continue?'
        );
        if (!confirmed) return;
      }
      
      await discoverAPI.showInterest(toUserId, city, placeId, placeType);
      await loadInterests();
      alert('Interest sent! They have 24 hours to accept or decline. Once you match, reply within 24 hours to every message you receive or the match ends.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send interest');
    }
  };

  const handleRespondInterest = async (interestId: string, response: 'accepted' | 'rejected') => {
    try {
      const result = await discoverAPI.respondInterest(interestId, response);
      await loadInterests();
      
      if (result.openChat && result.chatUserId) {
        localStorage.setItem('chatSelectedUserId', result.chatUserId);
        window.dispatchEvent(new CustomEvent('chat:open', { detail: { userId: result.chatUserId } }));
        alert('Match! Opening chat — reply within 24 hours to every message you receive, or the match ends.');
      } else if (response === 'rejected') {
        alert('Interest declined.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to respond');
    }
  };

  const loadPlaces = async () => {
    if (!coords) return;
    try {
      const response = await discoverAPI.searchPlaces(coords.lat, coords.lon, 1000);
      setPlaces(response.places);
    } catch (err) {
      console.error('Failed to load places', err);
    }
  };

  const loadPlaceUsers = async (place: Place) => {
    if (!coords) return;
    setLoading(true);
    try {
      const response = await discoverAPI.getPlaceUsers(place.id, coords.lat, coords.lon);
      setPlaceUsers(response.users);
      setSelectedPlace(place);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPreference = async () => {
    if (!preference) return;
    try {
      await discoverAPI.setPreference(preference);
      alert('Preferences saved!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save preferences');
    }
  };

  return (
    <div className="widget-full-content">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => { setView('cities'); loadAllCities(); }}
          className={view === 'cities' ? 'select-user-btn' : 'back-btn'}
        >
          All Cities
        </button>
        <button
          onClick={() => setView('city')}
          className={view === 'city' ? 'select-user-btn' : 'back-btn'}
        >
          Search City
        </button>
        <button
          onClick={() => setView('places')}
          className={view === 'places' ? 'select-user-btn' : 'back-btn'}
        >
          Find Places
        </button>
        <button
          onClick={() => { setView('interests'); loadInterests(); }}
          className={view === 'interests' ? 'select-user-btn' : 'back-btn'}
        >
          My Interests
        </button>
        <button
          onClick={() => { setView('preferences'); loadPreference(); }}
          className={view === 'preferences' ? 'select-user-btn' : 'back-btn'}
        >
          Preferences
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {view === 'cities' && (
        <div>
          <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Cities with Active Users</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading cities...</div>
          ) : allCities.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
              maxHeight: '500px',
              overflowY: 'auto',
            }}>
              {allCities.map((cityInfo) => (
                <div
                  key={cityInfo.city}
                  onClick={() => {
                    setCitySearch(cityInfo.city);
                    setView('city');
                    handleCitySearch();
                  }}
                  style={{
                    padding: '16px',
                    border: `2px solid ${cityInfo.hasActiveUsers ? '#10b981' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: cityInfo.hasActiveUsers ? '#f0fdf4' : '#f9fafb',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (cityInfo.hasActiveUsers) {
                      e.currentTarget.style.borderColor = '#059669';
                      e.currentTarget.style.background = '#dcfce7';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (cityInfo.hasActiveUsers) {
                      e.currentTarget.style.borderColor = '#10b981';
                      e.currentTarget.style.background = '#f0fdf4';
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                        {cityInfo.city}
                      </h4>
                      <p style={{ margin: 0, color: cityInfo.hasActiveUsers ? '#059669' : '#6b7280', fontSize: '13px' }}>
                        {cityInfo.userCount} {cityInfo.userCount === 1 ? 'user' : 'users'}
                      </p>
                    </div>
                    {cityInfo.hasActiveUsers && (
                      <span style={{ fontSize: '20px' }}>✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
              No cities with active users found
            </p>
          )}
        </div>
      )}

      {view === 'city' && (
        <div>
          <div style={{ marginBottom: '20px', padding: '15px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
            <p style={{ margin: 0, color: '#0369a1', fontSize: '14px' }}>
              🌍 <strong>Search any city worldwide!</strong> Enter any city name to see if there are users there, or discover new places.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              type="text"
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCitySearch()}
              placeholder="Enter any city name (e.g., New York, London, Tokyo, Paris...)"
              style={{
                flex: 1,
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
              }}
            />
            <button onClick={handleCitySearch} className="select-user-btn" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {error && (
            <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {cityUsers.length > 0 ? (
            <div>
              <p style={{ marginBottom: '15px', color: '#6b7280', fontSize: '14px' }}>
                Found {cityUsers.length} user{cityUsers.length !== 1 ? 's' : ''} in {citySearch}
              </p>
              <div className="users-list">
                {cityUsers.map((u) => (
                  <div key={u.id} className="user-item">
                    <div className="user-avatar">
                      {u.profilePicture ? (
                        <img src={u.profilePicture} alt={u.name} />
                      ) : (
                        <div className="avatar-placeholder">{u.name[0]}</div>
                      )}
                    </div>
                    <div className="user-details">
                      <h4>{u.name}</h4>
                      <p>@{u.username}</p>
                    </div>
                    <button
                      onClick={() => handleShowInterest(u.id, citySearch)}
                      className="send-btn"
                    >
                      Show Interest
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : citySearch && !loading && !error ? (
            <div style={{ textAlign: 'center', padding: '40px', background: '#f9fafb', borderRadius: '12px', border: '2px dashed #e5e7eb' }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🌍</div>
              <h3 style={{ marginBottom: '10px', color: '#1f2937' }}>No users found in {citySearch}</h3>
              <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                This city is available for search! Be the first to add your profile location to {citySearch}.
              </p>
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                You can search for any city worldwide - New York, London, Tokyo, Paris, Sydney, Dubai, and more!
              </p>
            </div>
          ) : null}
        </div>
      )}

      {view === 'places' && (
        <div>
          {!coords ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>Enable location to find places nearby</p>
              <button onClick={getLocation} className="select-user-btn">Enable Location</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '20px' }}>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      loadPlaces();
                    }
                  }}
                  style={{
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '16px',
                    width: '100%',
                  }}
                >
                  <option value="">All Places</option>
                  <option value="bar">Bars</option>
                  <option value="gym">Gyms</option>
                  <option value="restaurant">Restaurants</option>
                  <option value="park">Parks</option>
                  <option value="cafe">Cafes</option>
                  <option value="club">Clubs</option>
                </select>
              </div>

              {selectedPlace ? (
                <div>
                  <button onClick={() => setSelectedPlace(null)} className="back-btn" style={{ marginBottom: '20px' }}>
                    ← Back to Places
                  </button>
                  <h3 style={{ marginBottom: '16px' }}>{selectedPlace.name}</h3>
                  <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                    {placeUsers.length} users of your interest nearby (within 50m)
                  </p>
                  {preference?.lookingFor?.includes('casual') && (
                    <div style={{
                      background: '#fef3c7',
                      border: '2px solid #f59e0b',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '20px',
                    }}>
                      <strong>⚠️ Safety Warning:</strong> For casual encounters, always ensure your partner is comfortable. 
                      The app will automatically send a notification requesting a 5-second 360° video verification before any meeting.
                      Do not make any moves until the other partner confirms they are comfortable.
                    </div>
                  )}
                  {placeUsers.length > 0 ? (
                    <div className="users-list">
                      {placeUsers.map((u) => (
                        <div key={u.id} className="user-item">
                          <div className="user-avatar">
                            {u.profilePicture ? (
                              <img src={u.profilePicture} alt={u.name} />
                            ) : (
                              <div className="avatar-placeholder">{u.name[0]}</div>
                            )}
                          </div>
                          <div className="user-details">
                            <h4>{u.name}</h4>
                            <p>@{u.username}</p>
                          </div>
                          <button
                            onClick={() => handleShowInterest(u.id, undefined, selectedPlace.id, selectedPlace.type)}
                            className="send-btn"
                          >
                            Show Interest
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#6b7280', padding: '40px' }}>
                      No matching users at this location right now
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {places.map((place) => (
                    <div
                      key={place.id}
                      onClick={() => loadPlaceUsers(place)}
                      style={{
                        padding: '16px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#ff6b9d';
                        e.currentTarget.style.background = '#fff5f8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.background = 'white';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 4px 0' }}>{place.name}</h4>
                          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                            {place.type} • {place.city}, {place.country}
                          </p>
                          <p style={{ margin: '4px 0 0', color: '#ff6b9d', fontSize: '13px', fontWeight: 600 }}>
                            Click to see users of your interest here
                          </p>
                        </div>
                        <span style={{ fontSize: '24px', marginLeft: '12px' }}>
                          {place.type === 'bar' ? '🍺' : place.type === 'gym' ? '💪' : place.type === 'restaurant' ? '🍽️' : place.type === 'park' ? '🌳' : place.type === 'cafe' ? '☕' : '📍'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === 'interests' && (
        <div>
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '16px' }}>Received Interests</h3>
            {interests.received.length > 0 ? (
              <div className="buzz-list">
                {interests.received.map((interest) => {
                  const msLeft = Math.max(0, new Date(interest.expiresAt).getTime() - Date.now());
                  const timeLeftLabel =
                    msLeft <= 0
                      ? 'Expired'
                      : msLeft < 60 * 60 * 1000
                        ? `${Math.max(1, Math.ceil(msLeft / 60000))} min left`
                        : `${Math.floor(msLeft / 3600000)}h ${Math.floor((msLeft % 3600000) / 60000)}m left (24h max)`;
                  return (
                    <div key={interest.id} className="buzz-item">
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, color: '#374151' }}>
                          Someone showed interest in you {interest.city ? `in ${interest.city}` : ''}
                        </p>
                        <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '12px' }}>
                          {timeLeftLabel} — accept or decline or it disappears
                        </p>
                      </div>
                      <div className="buzz-actions">
                        <button
                          className="send-btn"
                          onClick={() => handleRespondInterest(interest.id, 'accepted')}
                        >
                          Accept
                        </button>
                        <button
                          className="danger-btn"
                          onClick={() => handleRespondInterest(interest.id, 'rejected')}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: '#6b7280' }}>No received interests</p>
            )}
          </div>

          <div>
            <h3 style={{ marginBottom: '16px' }}>Sent Interests</h3>
            {interests.sent.length > 0 ? (
              <div className="buzz-list">
                {interests.sent.map((interest) => (
                  <div key={interest.id} className="buzz-item">
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, color: '#374151' }}>
                        Status: <strong>{interest.status}</strong>
                      </p>
                      {interest.responseMessage && (
                        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '12px' }}>
                          {interest.responseMessage}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#6b7280' }}>No sent interests</p>
            )}
          </div>
        </div>
      )}

      {view === 'preferences' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Orientation</label>
            <select
              value={preference?.orientation || 'straight'}
              onChange={(e) => setPreference({ ...preference!, orientation: e.target.value as any })}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
              }}
            >
              <option value="straight">Straight</option>
              <option value="gay">Gay</option>
              <option value="lesbian">Lesbian</option>
              <option value="bisexual">Bisexual</option>
              <option value="pansexual">Pansexual</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Looking For (select two or more if you like)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {[
                { value: 'dating' as const, label: 'Dating' },
                { value: 'casual' as const, label: 'Casual' },
                { value: 'friends' as const, label: 'Friends' },
                { value: 'serious' as const, label: 'Serious Relationship' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    border: `2px solid ${(preference?.lookingFor ?? []).includes(opt.value) ? '#00d4ff' : 'rgba(0, 212, 255, 0.3)'}`,
                    borderRadius: '8px',
                    background: (preference?.lookingFor ?? []).includes(opt.value) ? 'rgba(0, 212, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={(preference?.lookingFor ?? []).includes(opt.value)}
                    onChange={() => {
                      const current = preference?.lookingFor ?? ['dating'];
                      const next = current.includes(opt.value)
                        ? current.filter((v) => v !== opt.value)
                        : [...current, opt.value];
                      setPreference({ ...preference!, lookingFor: next.length ? next : ['dating'] });
                    }}
                    style={{ width: '18px', height: '18px', accentColor: '#00d4ff' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Your City</label>
            <input
              type="text"
              value={preference?.city || ''}
              onChange={(e) => setPreference({ ...preference!, city: e.target.value })}
              placeholder="Enter your city..."
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '16px',
              }}
            />
          </div>

          <button onClick={handleSetPreference} className="select-user-btn" style={{ width: '100%' }}>
            Save Preferences
          </button>
        </div>
      )}
    </div>
  );
};

export default DiscoverWidgetFull;

