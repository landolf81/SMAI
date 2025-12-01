import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import FavoriteIcon from '@mui/icons-material/Favorite';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import StoreIcon from '@mui/icons-material/Store';
import RefreshIcon from '@mui/icons-material/Refresh';
import { marketService } from '../services';
import { AuthContext } from '../context/AuthContext';

const Favorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [availableMarkets, setAvailableMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFavorite, setNewFavorite] = useState({
    market_name: '',
    item_name: '참외',
    weight: '5kg',
    grade: '특품'
  });
  
  const { currentUser } = useContext(AuthContext);

  // 사용자 관심 목록 가져오기
  const fetchUserFavorites = async () => {
    try {
      const data = await marketService.getFavorites();
      setFavorites(data);
    } catch (error) {
      console.error('관심 목록 조회 실패:', error);
      if (error.message?.includes('인증')) {
        setError('로그인이 필요합니다.');
      } else {
        setError('관심 목록을 불러올 수 없습니다.');
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
      fetchUserFavorites(),
      fetchAvailableMarkets()
    ]);
    
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // 관심 목록에서 제거
  const handleRemoveFavorite = async (favoriteId) => {
    try {
      await marketService.removeFromFavorites(favoriteId);

      // 목록에서 제거
      setFavorites(favorites.filter(fav => fav.id !== favoriteId));
    } catch (error) {
      console.error('관심 목록 제거 실패:', error);
      alert('관심 목록 제거에 실패했습니다.');
    }
  };

  // 관심 목록에 추가
  const handleAddFavorite = async (e) => {
    e.preventDefault();

    try {
      await marketService.addToFavorites({
        marketName: newFavorite.market_name,
        itemName: newFavorite.item_name,
        weight: newFavorite.weight,
        grade: newFavorite.grade
      });

      // 목록 새로고침
      await fetchUserFavorites();

      // 폼 초기화
      setNewFavorite({
        market_name: '',
        item_name: '참외',
        weight: '5kg',
        grade: '특품'
      });
      setShowAddForm(false);

    } catch (error) {
      console.error('관심 목록 추가 실패:', error);
      alert('관심 목록 추가에 실패했습니다.');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-gray-600">관심 목록을 불러오는 중...</p>
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
                관심 목록을 불러올 수 없습니다
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
              <FavoriteIcon className="mr-3 text-red-500" />
              관심 시장
            </h1>
            <p className="text-gray-600 mt-2">자주 확인하는 시장과 품목을 저장해두세요</p>
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
              <AddIcon className="mr-2" />
              관심 시장 추가
            </button>
          </div>
        </div>

        {/* 추가 폼 모달 */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">관심 시장 추가</h3>
              
              <form onSubmit={handleAddFavorite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시장명
                  </label>
                  <select
                    value={newFavorite.market_name}
                    onChange={(e) => setNewFavorite({...newFavorite, market_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                    value={newFavorite.item_name}
                    onChange={(e) => setNewFavorite({...newFavorite, item_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                      value={newFavorite.weight}
                      onChange={(e) => setNewFavorite({...newFavorite, weight: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                      value={newFavorite.grade}
                      onChange={(e) => setNewFavorite({...newFavorite, grade: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="특품">특품</option>
                      <option value="상품">상품</option>
                      <option value="보통">보통</option>
                    </select>
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

        {/* 관심 목록 */}
        {favorites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map(fav => (
              <div key={fav.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <FavoriteIcon className="text-red-500" />
                    <button 
                      onClick={() => handleRemoveFavorite(fav.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="관심 목록에서 제거"
                    >
                      <DeleteIcon fontSize="small" />
                    </button>
                  </div>
                  
                  <h3 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2">
                    <StoreIcon fontSize="small" className="text-green-600" />
                    {fav.market_name}
                  </h3>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <p><span className="font-medium">품목:</span> {fav.item_name}</p>
                    <p><span className="font-medium">등급:</span> {fav.grade}</p>
                    <p><span className="font-medium">중량:</span> {fav.weight}</p>
                    <p><span className="font-medium">등록일:</span> {formatDate(fav.created_at)}</p>
                  </div>
                  
                  <Link 
                    to={`/prices?market=${encodeURIComponent(fav.market_name)}`}
                    className="w-full btn btn-outline btn-sm"
                  >
                    가격 확인하기
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FavoriteIcon className="text-gray-300 text-6xl mb-4 mx-auto" />
            <h3 className="text-xl text-gray-500 mb-2">등록된 관심 시장이 없습니다</h3>
            <p className="text-gray-400 mb-6">자주 확인하는 시장을 추가해보세요</p>
            <button 
              onClick={() => setShowAddForm(true)}
              className="btn btn-primary"
            >
              첫 번째 관심 시장 추가하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;