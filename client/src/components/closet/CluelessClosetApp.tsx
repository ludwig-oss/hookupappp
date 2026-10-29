import { useEffect, useMemo, useRef, useState } from 'react';
import { fashionAPI } from '../../api/fashion';
import { inspirationContextLine, type InspirationMatch } from '../../lib/inspirationBadge';
import { itemsFor, type ClosetGender, type ClosetItem } from '../../data/closetCatalog';
import SwipeableOutfitWrapper from './SwipeableOutfitWrapper';
import './CluelessClosetApp.css';

const PATTERN =
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&q=60';

function garmentSrc(item: ClosetItem) {
  return item.tryOnPreviewUrl || item.thumbUrl || '';
}

export default function CluelessClosetApp({
  gender,
  onTryOn,
}: {
  gender: ClosetGender;
  onTryOn?: (top: ClosetItem, bottom: ClosetItem) => void;
}) {
  const tops = useMemo(() => {
    const list = itemsFor('tops', gender).filter((i) => garmentSrc(i));
    return list.length ? list : itemsFor('tops', 'any').filter((i) => garmentSrc(i));
  }, [gender]);
  const bottoms = useMemo(() => {
    const list = itemsFor('bottoms', gender).filter((i) => garmentSrc(i));
    return list.length ? list : itemsFor('bottoms', 'any').filter((i) => garmentSrc(i));
  }, [gender]);

  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [trendMatches, setTrendMatches] = useState<InspirationMatch[]>([]);
  const [saveNote, setSaveNote] = useState('');
  const saveGen = useRef(0);

  useEffect(() => {
    setTopIndex(0);
    setBottomIndex(0);
  }, [gender]);

  useEffect(() => {
    let cancelled = false;
    fashionAPI
      .internetTrends({ limit: 8 })
      .then((res) => {
        if (!cancelled) setTrendMatches(res.matches || []);
      })
      .catch(() => {
        if (!cancelled) setTrendMatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const top = tops[topIndex] || tops[0];
  const bottom = bottoms[bottomIndex] || bottoms[0];
  const garmentHint = `${top?.title || ''} ${bottom?.title || ''}`;
  const trendForLook = trendMatches[topIndex % Math.max(trendMatches.length, 1)] || null;
  const inspirationLine = inspirationContextLine(trendForLook, garmentHint);

  const nextTop = () => tops.length && setTopIndex((prev) => (prev + 1) % tops.length);
  const prevTop = () => tops.length && setTopIndex((prev) => (prev - 1 + tops.length) % tops.length);
  const nextBottom = () => bottoms.length && setBottomIndex((prev) => (prev + 1) % bottoms.length);
  const prevBottom = () => bottoms.length && setBottomIndex((prev) => (prev - 1 + bottoms.length) % bottoms.length);

  const handleShuffle = () => {
    if (tops.length) setTopIndex(Math.floor(Math.random() * tops.length));
    if (bottoms.length) setBottomIndex(Math.floor(Math.random() * bottoms.length));
  };

  const handleRockIt = () => {
    if (!top || !bottom) return;
    const imageUrl = garmentSrc(top);
    const title = `${top.title} + ${bottom.title}`;
    const pieces = [top.title, bottom.title];
    const gen = ++saveGen.current;
    handleShuffle();
    if (!imageUrl) {
      setSaveNote('That look has no photo to save.');
      return;
    }
    void fashionAPI
      .saveUpload({
        title,
        imageUrl,
        kind: 'look',
        group: 'Saved looks',
        event: 'date',
        pieces,
      })
      .then(() => {
        if (saveGen.current === gen) setSaveNote('Rocked it — saved to your wardrobe.');
      })
      .catch(() => {
        if (saveGen.current === gen) setSaveNote('Could not save that look.');
      });
  };

  const handleTryOn = () => {
    if (!top || !bottom) return;
    setShowMatchOverlay(true);
    onTryOn?.(top, bottom);
    window.setTimeout(() => setShowMatchOverlay(false), 2000);
  };

  return (
    <div className="clueless-root">
      <header className="clueless-header">
        <h2 className="clueless-title">CLUELESS</h2>
        <p className="clueless-sub">SPOTLIGHT &nbsp;|&nbsp; NEW &nbsp;|&nbsp; CLOTHING &nbsp;|&nbsp; SHOES &nbsp;|&nbsp; BAGS</p>
      </header>

      <div className="clueless-workspace">
        <aside className="clueless-sidebar">
          <img src={PATTERN} alt="" className="clueless-pattern" />
          <button type="button" className="clueless-side-btn" data-closet-tour="shuffle" onClick={handleShuffle}>
            SHUFFLE
          </button>
        </aside>

        <SwipeableOutfitWrapper onSwipeLeft={handleShuffle} onSwipeRight={handleRockIt}>
          <div className="clueless-stage" data-closet-tour="carousel">
            <p className="clueless-swipe-hint">Swipe right to rock it · swipe left for as if</p>
            <div className="clueless-inspiration-badge" role="note">
              {inspirationLine}
            </div>
            <div className="clueless-row">
              <button type="button" className="clueless-arrow" onClick={prevTop} aria-label="Previous top">
                {'<'}
              </button>
              {top ? (
                <img src={garmentSrc(top)} alt={top.title} className="clueless-garment" />
              ) : (
                <p className="clueless-empty">No tops yet</p>
              )}
              <button type="button" className="clueless-arrow" onClick={nextTop} aria-label="Next top">
                {'>'}
              </button>
            </div>
            {top && <p className="clueless-name">{top.title}</p>}

            <div className="clueless-row">
              <button type="button" className="clueless-arrow" onClick={prevBottom} aria-label="Previous bottom">
                {'<'}
              </button>
              {bottom ? (
                <img src={garmentSrc(bottom)} alt={bottom.title} className="clueless-garment" />
              ) : (
                <p className="clueless-empty">No bottoms yet</p>
              )}
              <button type="button" className="clueless-arrow" onClick={nextBottom} aria-label="Next bottom">
                {'>'}
              </button>
            </div>
            {bottom && <p className="clueless-name">{bottom.title}</p>}
            {saveNote && <p className="clueless-save-note">{saveNote}</p>}
          </div>
        </SwipeableOutfitWrapper>

        <aside className="clueless-sidebar">
          <img src={PATTERN} alt="" className="clueless-pattern" />
          <button type="button" className="clueless-side-btn" data-closet-tour="tryon" onClick={handleTryOn}>
            TRY ON
          </button>
        </aside>
      </div>

      {showMatchOverlay && (
        <div className="clueless-overlay" role="status">
          <div className="clueless-match">MATCH</div>
        </div>
      )}
    </div>
  );
}
