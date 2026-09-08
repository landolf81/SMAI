// 첫 화면 및 지연 로딩 순서에 관계없이 상대 날짜를 한국어로 표시한다.
import moment from 'moment';
import 'moment/locale/ko.js';

moment.locale('ko');
export default moment;
