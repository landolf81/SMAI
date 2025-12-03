import React, { useState, useEffect, useMemo } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// 색상 정의
const COLORS = {
  mainGreen: '#154734',      // PANTONE 3435 C
  lightGreen: '#6CC24A',     // 농협 라이트 그린
  pointYellow: '#FFD400',    // 포인트 노랑
  neutralBg: '#F7F7F7',      // 중립 배경
  border: '#E1E4E8',         // 테두리
};

const DatePickerModal = ({ isOpen, onClose, selectedDate, onSelectDate, maxDate }) => {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  // 선택된 날짜로 초기화
  useEffect(() => {
    if (selectedDate) {
      const [year, month] = selectedDate.split('-').map(Number);
      setCurrentYear(year);
      setCurrentMonth(month - 1);
    }
  }, [selectedDate, isOpen]);

  // 요일 헤더
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  // 현재 월의 날짜들 계산
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days = [];

    // 이전 달 빈 칸
    for (let i = 0; i < startingDay; i++) {
      days.push({ day: null, isCurrentMonth: false });
    }

    // 현재 달 날짜
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        dateStr,
        isCurrentMonth: true,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === maxDate,
        isFuture: dateStr > maxDate,
      });
    }

    return days;
  }, [currentYear, currentMonth, selectedDate, maxDate]);

  // 이전 달로 이동
  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  // 다음 달로 이동
  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 날짜 선택
  const handleSelectDate = (dateStr) => {
    if (dateStr && dateStr <= maxDate) {
      onSelectDate(dateStr);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        style={{ maxHeight: '90vh' }}
      >
        {/* 헤더 */}
        <div
          className="px-4 py-4 flex items-center justify-between"
          style={{ backgroundColor: COLORS.mainGreen }}
        >
          <h2 className="text-lg font-bold text-white">날짜 선택</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <CloseIcon className="text-white" />
          </button>
        </div>

        {/* 월 네비게이션 */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: COLORS.neutralBg }}
        >
          <button
            onClick={goToPrevMonth}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          >
            <ChevronLeftIcon style={{ color: COLORS.mainGreen }} />
          </button>

          <span className="text-lg font-bold" style={{ color: COLORS.mainGreen }}>
            {currentYear}년 {currentMonth + 1}월
          </span>

          <button
            onClick={goToNextMonth}
            className="p-2 rounded-full hover:bg-gray-200 transition-colors"
          >
            <ChevronRightIcon style={{ color: COLORS.mainGreen }} />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div
          className="grid grid-cols-7 py-2 border-b"
          style={{ borderColor: COLORS.border }}
        >
          {weekDays.map((day, index) => (
            <div
              key={day}
              className={`text-center text-sm font-medium py-1 ${
                index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-600'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 달력 그리드 */}
        <div className="grid grid-cols-7 gap-1 p-3">
          {calendarDays.map((item, index) => (
            <button
              key={index}
              onClick={() => item.day && handleSelectDate(item.dateStr)}
              disabled={!item.day || item.isFuture}
              className={`
                aspect-square flex items-center justify-center rounded-full text-sm font-medium
                transition-all duration-200
                ${!item.day ? 'invisible' : ''}
                ${item.isFuture ? 'text-gray-300 cursor-not-allowed' : ''}
                ${item.isSelected ? 'text-white shadow-md' : ''}
                ${item.isToday && !item.isSelected ? 'font-bold' : ''}
                ${!item.isSelected && !item.isFuture && item.day ? 'hover:bg-gray-100' : ''}
                ${index % 7 === 0 && !item.isSelected && !item.isFuture ? 'text-red-500' : ''}
                ${index % 7 === 6 && !item.isSelected && !item.isFuture ? 'text-blue-500' : ''}
              `}
              style={{
                backgroundColor: item.isSelected ? COLORS.mainGreen : item.isToday ? COLORS.pointYellow + '40' : 'transparent',
                border: item.isToday && !item.isSelected ? `2px solid ${COLORS.pointYellow}` : 'none',
              }}
            >
              {item.day}
            </button>
          ))}
        </div>

        {/* 하단 버튼 */}
        <div
          className="px-4 py-3 flex gap-2 border-t"
          style={{ borderColor: COLORS.border }}
        >
          <button
            onClick={() => {
              onSelectDate(maxDate);
              onClose();
            }}
            className="flex-1 py-2.5 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: COLORS.lightGreen,
              color: 'white'
            }}
          >
            오늘
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg font-medium transition-colors border"
            style={{
              borderColor: COLORS.border,
              color: COLORS.mainGreen
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatePickerModal;
