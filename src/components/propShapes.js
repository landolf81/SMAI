// 공통 컴포넌트 입력값: 광고 투표, 시장 집계, 뱃지와 차트 데이터 구조.
import PropTypes from 'prop-types';
export const identifierType = PropTypes.oneOfType([PropTypes.string, PropTypes.number]);
export const numericType = PropTypes.oneOfType([PropTypes.number, PropTypes.string]);
export const badgeType = PropTypes.shape({
 id: identifierType, icon_type: PropTypes.string, icon_value: PropTypes.string,
 icon_url: PropTypes.string, icon_background: PropTypes.string, badge_color: PropTypes.string,
 color: PropTypes.string, badge_name: PropTypes.string, name: PropTypes.string,
});
export const pollOptionType = PropTypes.shape({
 id: identifierType, poll_id: identifierType, option_text: PropTypes.string,
 display_order: PropTypes.number, vote_count: PropTypes.number,
});
export const adPollType = PropTypes.shape({
 id: identifierType, ad_poll_options: PropTypes.arrayOf(pollOptionType),
 expires_at: PropTypes.string, is_closed: PropTypes.bool, total_votes: PropTypes.number,
 question: PropTypes.string, is_multiple: PropTypes.bool, is_anonymous: PropTypes.bool,
});
export const marketType = PropTypes.shape({
 id: identifierType, name: PropTypes.string, error: PropTypes.bool,
 isTotal: PropTypes.bool, isWholesaleTotal: PropTypes.bool, isFinalized: PropTypes.bool,
 unit: PropTypes.string, totalQuantity: PropTypes.number, previousTotalQuantity: PropTypes.number,
 totalAmount: PropTypes.number, averagePrice: PropTypes.number, previousAveragePrice: PropTypes.number,
 maxPrice: PropTypes.number, previousMaxPrice: PropTypes.number,
 minPrice: PropTypes.number, previousMinPrice: PropTypes.number,
});
export const chartDatumType = PropTypes.shape({
 date: PropTypes.string, label: PropTypes.string, avg_price: PropTypes.number,
 total_boxes: PropTypes.number, seongju_boxes: PropTypes.number, wholesale_boxes: PropTypes.number,
 hasWholesale: PropTypes.bool, isFuture: PropTypes.bool,
});
export const gradeType = PropTypes.shape({
 market_name: PropTypes.string, grade: PropTypes.string, weight: numericType,
 boxes: numericType, avg_price: numericType, max_price: numericType, min_price: numericType,
});
