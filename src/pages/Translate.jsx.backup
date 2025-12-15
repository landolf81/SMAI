import React, { useState } from 'react';
import TranslateIcon from '@mui/icons-material/Translate';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import MicIcon from '@mui/icons-material/Mic';

const Translate = () => {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setIsTranslating(true);
    // TODO: AI 번역 API 연동
    // 임시 구현
    setTimeout(() => {
      setTranslatedText('번역 결과가 여기에 표시됩니다.');
      setIsTranslating(false);
    }, 1000);
  };

  const handleTTS = () => {
    // TODO: TTS 기능 구현
    console.log('TTS 실행');
  };

  const handleVoiceInput = () => {
    // TODO: 음성 입력 기능 구현
    console.log('음성 입력 시작');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <TranslateIcon className="text-indigo-600" fontSize="large" />
            <h1 className="text-xl font-bold text-gray-900">농촌 언어 번역</h1>
          </div>
          <p className="text-sm text-gray-600">
            농촌에서 사용하는 용어를 쉬운 말로 번역해드립니다.
          </p>
        </div>

        {/* 입력 영역 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            번역할 텍스트
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            placeholder="번역할 내용을 입력하세요..."
          />

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleTranslate}
              disabled={!inputText.trim() || isTranslating}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isTranslating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="loading loading-spinner loading-sm"></span>
                  번역 중...
                </span>
              ) : (
                '번역하기'
              )}
            </button>

            <button
              onClick={handleVoiceInput}
              className="px-4 py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              title="음성으로 입력"
            >
              <MicIcon />
            </button>
          </div>
        </div>

        {/* 결과 영역 */}
        {translatedText && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                번역 결과
              </label>
              <button
                onClick={handleTTS}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <VolumeUpIcon fontSize="small" />
                음성으로 듣기
              </button>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-800">{translatedText}</p>
            </div>
          </div>
        )}

        {/* 안내 문구 */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">사용 안내</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 농촌에서 자주 사용하는 전문 용어를 쉬운 말로 번역합니다</li>
            <li>• 음성 입력 버튼을 눌러 말로 입력할 수 있습니다</li>
            <li>• 번역 결과를 음성으로 들을 수 있습니다</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Translate;
