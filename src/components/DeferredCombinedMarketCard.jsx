/** Load the below-the-fold summary/chart bundle only as it approaches the viewport. */
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const Card = lazy(() => import('./CombinedMarketCard'));
export default function DeferredCombinedMarketCard({ selectedDate, formatPrice }) {
  const root = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  const placeholder = <div className="min-h-[32rem] flex items-center justify-center" aria-label="종합 시세 차트 로딩 중"><span className="loading loading-spinner" /></div>;
  return <div ref={root} className="min-h-[32rem]">
    {visible ? <Suspense fallback={placeholder}><Card selectedDate={selectedDate} formatPrice={formatPrice} /></Suspense> : placeholder}
  </div>;
}
DeferredCombinedMarketCard.propTypes = {
  selectedDate: PropTypes.string,
  formatPrice: PropTypes.func,
};
