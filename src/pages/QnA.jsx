import React from 'react';
import QnAList from '../components/QnAList';

const QnA = ({ hubMode = false, activeTab = 'qna' }) => {
  return <QnAList hubMode={hubMode} activeTab={activeTab} />;
};

export default QnA;