import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AddAlertIcon from '@mui/icons-material/AddAlert';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { marketService } from '../services';
import { AuthContext } from '../context/AuthContext';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [newAlert, setNewAlert] = useState({
    market_name: '',
    item_name: '참외',
    weight: '5kg',
    grade: '특품',
    alert_type: 'above',
    target_price: '',
    notification_type: 'web'
  });
  
  const { currentUser } = useContext(AuthContext);

  // 사용자 알림 목록 가져오기
  const fetchUserAlerts = async () => {
    try {
      const data = await marketService.getAlerts();
      setAlerts(data);
    } catch (error) {
      console.error('알림 목록 조회 실패:', error);
      if (error.message?.includes('인증')) {
        setError('로그인이 필요합니다.');
      } else {
        setError('알림 목록을 불러올 수 없습니다.');
      }
    }
  };

  // 사용가능한 시장 목록 가져오기
  const fetchAvailableMarkets = async () => {
    try {
      const markets = await marketService.getAvailableMarkets();
      setAvailableMarkets(markets);
    } catch (error) {
      console.error('시장 목록 조회 실패:', error);
    }
  };

  // 초기 데이터 로드
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    if (!currentUser) {
      setError('로그인이 필요합니다.');
      setLoading(false);
      return;
    }

    await Promise.all([
      fetchUserAlerts(),
      fetchAvailableMarkets()
    ]);
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // 알림 추가
  const handleAddAlert = async (e) => {
    e.preventDefault();

    try {
      await marketService.createAlert({
        marketName: newAlert.market_name,
        itemName: newAlert.item_name,
        weight: newAlert.weight,
        grade: newAlert.grade,
        alertType: newAlert.alert_type,
        targetPrice: parseInt(newAlert.target_price),
        notificationType: newAlert.notification_type
      });

      // 목록 새로고침
      await fetchUserAlerts();

      // 폼 초기화
      setNewAlert({
        market_name: '',
        item_name: '참외',
        weight: '5kg',
        grade: '특품',
        alert_type: 'above',
        target_price: '',
        notification_type: 'web'
      });
      setShowAddForm(false);

    } catch (error) {
      console.error('알림 추가 실패:', error);
      alert('알림 추가에 실패했습니다.');
    }
  };

  // 알림 수정
  const handleUpdateAlert = async (e) => {
    e.preventDefault();

    try {
      await marketService.updateAlert(editingAlert.id, {
        targetPrice: parseInt(editingAlert.target_price),
        isActive: editingAlert.is_active,
        notificationType: editingAlert.notification_type
      });

      // 목록 새로고침
      await fetchUserAlerts();

      setEditingAlert(null);

    } catch (error) {
      console.error('알림 수정 실패:', error);
      alert('알림 수정에 실패했습니다.');
    }
  };

  // 알림 삭제
  const handleDeleteAlert = async (alertId) => {
    if (!confirm('정말 이 알림을 삭제하시겠습니까?')) return;

    try {
      await marketService.deleteAlert(alertId);

      // 목록에서 제거
      setAlerts(alerts.filter(alert => alert.id !== alertId));

    } catch (error) {
      console.error('알림 삭제 실패:', error);
      alert('알림 삭제에 실패했습니다.');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR');
  };

  const formatPrice = (price) => {
    return price.toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-gray-600">알림 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="w-full max-w-screen-xl mx-auto p-4">
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                알림 목록을 불러올 수 없습니다
              </h3>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <div className="space-y-2">
                {!currentUser ? (
                  <Link to="/login" className="btn btn-primary">
                    로그인하기
                  </Link>
                ) : (
                  <button onClick={loadData} className="btn btn-primary">
                    다시 시도
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="w-full max-w-screen-xl mx-auto p-4">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
              <NotificationsIcon className="mr-3 text-blue-500" />
              가격 알림
            </h1>
            <p className="text-gray-600 mt-2">원하는 가격에 도달하면 알림을 받아보세요</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={loadData}
              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="새로고침"
            >
              <RefreshIcon fontSize="small" />
            </button>
            
            <button 
              onClick={() => setShowAddForm(true)}
              className="btn btn-primary flex items-center"
            >
              <AddAlertIcon className="mr-2" />
              알림 추가
            </button>
          </div>
        </div>

        {/* 알림 추가 폼 모달 */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">가격 알림 추가</h3>
              
              <form onSubmit={handleAddAlert} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시장명
                  </label>
                  <select
                    value={newAlert.market_name}
                    onChange={(e) => setNewAlert({...newAlert, market_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">시장을 선택하세요</option>
                    {availableMarkets.map(market => (
                      <option key={market} value={market}>{market}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    품목
                  </label>
                  <input
                    type="text"
                    value={newAlert.item_name}
                    onChange={(e) => setNewAlert({...newAlert, item_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="예: 참외"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      중량
                    </label>
                    <select
                      value={newAlert.weight}
                      onChange={(e) => setNewAlert({...newAlert, weight: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="5kg">5kg</option>
                      <option value="10kg">10kg</option>
                      <option value="15kg">15kg</option>
                      <option value="20kg">20kg</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      등급
                    </label>
                    <select
                      value={newAlert.grade}
                      onChange={(e) => setNewAlert({...newAlert, grade: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="특품">특품</option>
                      <option value="상품">상품</option>
                      <option value="보통">보통</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      알림 조건
                    </label>
                    <select
                      value={newAlert.alert_type}
                      onChange={(e) => setNewAlert({...newAlert, alert_type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="above">가격 이상</option>
                      <option value="below">가격 이하</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      목표 가격
                    </label>
                    <input
                      type="number"
                      value={newAlert.target_price}
                      onChange={(e) => setNewAlert({...newAlert, target_price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 35000"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="btn btn-outline"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    추가
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 알림 수정 폼 모달 */}
        {editingAlert && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">알림 수정</h3>
              
              <form onSubmit={handleUpdateAlert} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    목표 가격
                  </label>
                  <input
                    type="number"
                    value={editingAlert.target_price}
                    onChange={(e) => setEditingAlert({...editingAlert, target_price: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingAlert.is_active}
                      onChange={(e) => setEditingAlert({...editingAlert, is_active: e.target.checked})}
                      className="checkbox"
                    />
                    <span className="text-sm font-medium text-gray-700">알림 활성화</span>
                  </label>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingAlert(null)}
                    className="btn btn-outline"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    수정
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 알림 목록 */}
        {alerts.length > 0 ? (
          <div className="space-y-4">
            {alerts.map(alert => (
              <div key={alert.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-3 ${alert.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800">
                          {alert.market_name}
                        </h3>
                        <p className="text-gray-600">
                          {alert.item_name} {alert.weight} {alert.grade}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        alert.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {alert.is_active ? '활성' : '비활성'}
                      </span>
                      
                      <button 
                        onClick={() => setEditingAlert(alert)}
                        className="text-gray-400 hover:text-blue-500 transition-colors"
                        title="수정"
                      >
                        <EditIcon fontSize="small" />
                      </button>
                      
                      <button 
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <DeleteIcon fontSize="small" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-500 mb-1">알림 조건</p>
                      <div className="flex items-center justify-center">
                        {alert.alert_type === 'above' ? (
                          <TrendingUpIcon className="text-red-500 mr-1" />
                        ) : (
                          <TrendingDownIcon className="text-blue-500 mr-1" />
                        )}
                        <span className="font-semibold">
                          {alert.alert_type === 'above' ? '이상' : '이하'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-500 mb-1">목표 가격</p>
                      <p className="font-bold text-lg text-gray-800">
                        {formatPrice(alert.target_price)} 원
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <p>등록일: {formatDate(alert.created_at)}</p>
                    <p>알림 방식: {alert.notification_type === 'web' ? '웹' : '이메일'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <NotificationsIcon className="text-gray-300 text-6xl mb-4 mx-auto" />
            <h3 className="text-xl text-gray-500 mb-2">설정된 가격 알림이 없습니다</h3>
            <p className="text-gray-400 mb-6">원하는 가격에 도달하면 알림을 받아보세요</p>
            <button 
              onClick={() => setShowAddForm(true)}
              className="btn btn-primary"
            >
              첫 번째 알림 설정하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;