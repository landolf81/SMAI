import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* 모달 헤더 */}
        <div className="flex items-center mb-4">
          <div className="bg-error bg-opacity-20 rounded-full p-3 mr-4">
            <FontAwesomeIcon 
              icon={faExclamationTriangle} 
              className="text-error text-xl" 
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">게시물 삭제</h3>
            <p className="text-sm text-gray-600">이 작업은 되돌릴 수 없습니다</p>
          </div>
        </div>

        {/* 모달 내용 */}
        <div className="mb-6">
          <p className="text-gray-700">
            정말로 이 게시물을 삭제하시겠습니까?
          </p>
          <p className="text-sm text-gray-500 mt-2">
            삭제된 게시물과 모든 댓글은 복구할 수 없습니다.
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-outline"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`btn btn-error ${loading ? 'loading' : ''}`}
          >
            {!loading && <FontAwesomeIcon icon={faTrash} className="mr-2" />}
            {loading ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;